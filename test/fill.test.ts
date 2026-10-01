// E2E del relleno con bots (docs/adr/0010, hito MB1), contra el Supabase local
// de verdad: el vigilante real de pg_cron, Auth real y una sesión por bot.
//
// Un humano crea una partida con relleno de bots; al vencer la ventana, el
// servidor mete a los bots y arranca, y el supervisor se entera con la sesión
// de cada bot. La clave de servicio solo prepara y limpia (alta de los bots,
// adelantar la ventana, borrar al humano): ninguna aserción se hace con ella.

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { compose } from '../src/composition.ts';
import { loadConfig } from '../src/infrastructure/config.ts';

// El mapa, de un fichero: el e2e no depende de que Overpass responda.
const config = { ...loadConfig(), mapFile: new URL('./fixtures/grid-map.json', import.meta.url).pathname };
const RUN = randomUUID().slice(0, 8);
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(config.url, config.secretKey, options);
// La aplicación de verdad, con sus adaptadores de verdad.
const { ensurePool, supervisor } = compose(config);

let host: SupabaseClient;
let hostId: string;

async function waitFor<T>(what: string, check: () => Promise<T | undefined | false>, ms = 30_000): Promise<T> {
  const until = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > until) throw new Error(`Timeout esperando ${what}`);
    await new Promise((r) => setTimeout(r, 250));
  }
}

before(async () => {
  const pool = await ensurePool.execute(config.poolSize);
  await supervisor.start(pool, 500);

  host = createClient(config.url, config.publishableKey, options);
  const { data, error } = await host.auth.signUp({
    email: `bots-e2e-${RUN}@test.dev`,
    password: `pw-${RUN}-x9`,
    options: { data: { username: `bots_e2e_${RUN}` } },
  });
  if (error || !data.user) throw new Error(`Alta del humano: ${error?.message}`);
  hostId = data.user.id;
});

after(async () => {
  await supervisor.stop();
  // Borrar al humano borra su partida en cascada y deja libres a los bots.
  if (hostId) await admin.auth.admin.deleteUser(hostId);
});

test('al vencer la ventana, los bots llenan los huecos y la partida arranca', async () => {
  const lon = -1.6 + Math.random() * 0.8;
  const lat = 37.6 + Math.random() * 0.6;
  const { data: created, error } = await host.rpc('rpc_create_match', {
    p_zone: {
      type: 'Polygon',
      coordinates: [[[lon, lat], [lon + 0.02, lat], [lon + 0.02, lat + 0.02], [lon, lat + 0.02], [lon, lat]]],
    },
    p_name: `bots ${RUN}`,
    p_max_players: 4,
    p_deadline_days: 1,
    p_host_username: 'humano',
    p_host_avatar_id: 'av01',
    p_recruitment_minutes: 60,
    p_fill_with_bots: true,
  });
  assert.equal(error, null, error?.message);
  const matchId: string = created.match.id;
  assert.equal(created.match.fill_with_bots, true);
  assert.equal(supervisor.agentsIn(matchId).length, 0, 'antes de vencer no entra ningún bot');

  // Que venza ya (preparación, con la clave de servicio): el que la resuelve
  // es el vigilante real, cada 5 s.
  const now = Date.now();
  const { error: expireError } = await admin
    .from('matches')
    .update({
      created_at: new Date(now - 60 * 60 * 1000).toISOString(),
      recruitment_deadline: new Date(now + 500).toISOString(),
    })
    .eq('id', matchId);
  assert.equal(expireError, null, expireError?.message);

  // --- Lo que ve el humano ---------------------------------------------------
  const live = await waitFor('el arranque de la partida', async () => {
    const { data } = await host.rpc('rpc_get_my_live_match');
    return data?.match.status === 'active' ? data : undefined;
  });
  assert.equal(live.target?.is_bot, true, 'el único humano caza a un bot, y lo sabe');

  const { data: players, error: playersError } = await host.rpc('rpc_get_match_players', {
    p_match_id: matchId,
  });
  assert.equal(playersError, null, playersError?.message);
  const bots = (players as { username: string; is_bot: boolean }[]).filter((p) => p.is_bot);
  assert.equal(players.length, 4, 'la partida se llena');
  assert.equal(bots.length, 3, 'con tres bots');
  assert.ok(bots.every((b) => b.username.startsWith('bot_')), 'que se reconocen por el nombre');

  // --- Lo que ve cada bot, con su propia sesión ------------------------------
  const agents = await waitFor('a los tres agentes', async () => {
    await supervisor.tick();
    const inMatch = supervisor.agentsIn(matchId);
    return inMatch.length === 3 ? inMatch : undefined;
  });
  for (const agent of agents) {
    const mine = await agent.session.liveMatch();
    assert.equal(mine?.matchId, matchId);
    assert.equal(mine?.isBot, true);
    assert.equal(mine?.status, 'active');
    assert.ok(mine?.hasTarget, `${agent.session.bot.username} tiene objetivo: está en la rueda`);
  }

  // --- Sin partida, el supervisor los suelta ---------------------------------
  await admin.auth.admin.deleteUser(hostId);
  hostId = '';
  await waitFor('que los bots queden libres', async () => {
    await supervisor.tick();
    return supervisor.agentsIn(matchId).length === 0;
  });
});
