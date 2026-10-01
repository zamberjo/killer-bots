// E2E de los bots que andan (docs/adr/0010, hito MB2), contra el Supabase
// local de verdad.
//
// Una partida con bots en la zona de la rejilla de test/fixtures/grid-map.json.
// Con la rutina a las 11 de un día laborable, los bots salen a pasear: cada
// paso lo da PostGIS (esquema sim) y cada lectura la envían con su sesión por
// `rpc_report_position`, que las valida como las de cualquiera. A uno se le
// coloca fuera de la zona antes de empezar: el servidor se lo dice y vuelve.
//
// La clave de servicio solo prepara y limpia (adelantar la ventana, colocar al
// bot, borrar al humano): ninguna aserción se hace con ella.

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Agent } from '../src/application/agent.ts';
import { compose } from '../src/composition.ts';
import { loadConfig } from '../src/infrastructure/config.ts';

const MAP_FILE = new URL('./fixtures/grid-map.json', import.meta.url).pathname;
const ZONE = {
  type: 'Polygon',
  coordinates: [[[-1.14, 37.98], [-1.11, 37.98], [-1.11, 38.0], [-1.14, 38.0], [-1.14, 37.98]]],
};
// ~25 m al este del borde de la zona: más que el error del GPS simulado.
const OUTSIDE = { lat: 37.99, lon: -1.10972 };

const config = { ...loadConfig(), mapFile: MAP_FILE, forceHour: 11, tickMs: 1000 };
const RUN = randomUUID().slice(0, 8);
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(config.url, config.secretKey, options);
const { ensurePool, supervisor } = compose(config);

let host: SupabaseClient;
let hostId = '';

async function waitFor<T>(what: string, check: () => Promise<T | undefined | false> | T | undefined | false,
                          ms = 60_000): Promise<T> {
  const until = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > until) throw new Error(`Timeout esperando ${what}`);
    await new Promise((r) => setTimeout(r, 250));
  }
}

before(async () => {
  host = createClient(config.url, config.publishableKey, options);
  const { data, error } = await host.auth.signUp({
    email: `walk-e2e-${RUN}@test.dev`,
    password: `pw-${RUN}-x9`,
    options: { data: { username: `walk_e2e_${RUN}` } },
  });
  if (error || !data.user) throw new Error(`Alta del humano: ${error?.message}`);
  hostId = data.user.id;
});

after(async () => {
  await supervisor.stop();
  if (hostId) await admin.auth.admin.deleteUser(hostId);
});

test('de día, los bots pasean por las calles y el que se sale vuelve', async () => {
  const pool = await ensurePool.execute(config.poolSize);

  const { data: created, error } = await host.rpc('rpc_create_match', {
    p_zone: ZONE, p_name: `walk ${RUN}`, p_max_players: 3, p_deadline_days: 1,
    p_host_username: 'paseante', p_host_avatar_id: 'av01', p_recruitment_minutes: 60,
    p_fill_with_bots: true,
  });
  assert.equal(error, null, error?.message);
  const matchId: string = created.match.id;

  // La espera vence ya; la resuelve el vigilante real.
  const now = Date.now();
  await admin.from('matches').update({
    created_at: new Date(now - 60 * 60 * 1000).toISOString(),
    recruitment_deadline: new Date(now + 500).toISOString(),
  }).eq('id', matchId);
  await waitFor('el arranque', async () => {
    const { data } = await host.rpc('rpc_get_my_live_match');
    return data?.match.status === 'active';
  }, 30_000);

  const { data: players } = await host.rpc('rpc_get_match_players', { p_match_id: matchId });
  const bots = (players as { id: string; is_bot: boolean }[]).filter((p) => p.is_bot);
  assert.equal(bots.length, 2);
  const strayId = bots[0]!.id;

  // Preparación: el mapa de la rejilla y un bot colocado fuera de la zona.
  const map = JSON.parse(await (await import('node:fs/promises')).readFile(MAP_FILE, 'utf8'));
  await admin.rpc('sim_load_map', { p_match_id: matchId, p_ways: map.ways, p_buildings: map.buildings });
  const { error: placeError } = await admin.rpc('sim_place', {
    p_player_id: strayId, p_lat: OUTSIDE.lat, p_lon: OUTSIDE.lon,
  });
  assert.equal(placeError, null, placeError?.message);

  await supervisor.start(pool, 500);
  const agents = await waitFor('a los dos agentes', () => {
    const inMatch = supervisor.agentsIn(matchId);
    return inMatch.length === 2 ? inMatch : undefined;
  }, 30_000);
  const stray = agents.find((a) => a.playerId === strayId)!;
  const walker = agents.find((a) => a.playerId !== strayId)!;

  // --- El que se salió: el servidor se lo dice y vuelve ----------------------
  await waitFor('que el servidor le diga que está fuera', () => stray.lastOutcome?.inZone === false);
  await waitFor('que vuelva', () => stray.history.includes('returning'));
  await waitFor('que esté otra vez dentro', () => stray.lastOutcome?.inZone === true);
  await waitFor('que retome el paseo', () => stray.history.at(-1) === 'walking');

  // --- El otro pasea: el servidor acepta cada lectura -----------------------
  await waitFor('varias lecturas', () => walker.reports >= 10);
  assert.deepEqual(walker.history.slice(0, 1), ['walking'], 'a las 11 de un laborable, a pasear');
  assert.equal(walker.lastOutcome?.inZone, true, 'paseando, dentro de la zona');
  assertNoTeleports(walker);
  assertNoTeleports(stray);
});

/** Ninguna lectura de un bot parece un teletransporte: anda como una persona. */
function assertNoTeleports(agent: Agent) {
  assert.deepEqual(
    agent.rejections.filter((r) => r === 'too_fast'), [],
    `${agent.session.bot.username} nunca va demasiado rápido`,
  );
}
