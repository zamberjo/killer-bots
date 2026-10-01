// Adaptador de `GameGateway` / `GameSession` sobre supabase-js.
//
// Cada bot es un cliente de verdad: su propia sesión, su propio JWT y las
// mismas RPC que la app (docs/adr/0010). La clave publicable, no la de
// servicio. Aquí, y solo aquí, se traducen las respuestas del contrato
// (docs/rpc-contract.md) al dominio.

import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import type { GameGateway, GameSession, MatchWatch } from '../../application/ports.ts';
import type { BotProfile, MatchAssignment, MatchStatus } from '../../domain/bot.ts';

/** `{ match, me, target }` de `rpc_get_my_live_match`, lo que se usa. */
interface LiveMatchDto {
  match: { id: string; status: MatchStatus };
  me: { is_bot: boolean };
  target: { is_bot: boolean } | null;
}

export class SupabaseGameGateway implements GameGateway {
  private readonly url: string;
  private readonly publishableKey: string;

  constructor(url: string, publishableKey: string) {
    this.url = url;
    this.publishableKey = publishableKey;
  }

  async connect(bot: BotProfile, password: string): Promise<GameSession> {
    const client = createClient(this.url, this.publishableKey, {
      // Un proceso largo: la sesión se renueva sola. No se guarda en disco.
      auth: { persistSession: false, autoRefreshToken: true },
    });
    const { error } = await client.auth.signInWithPassword({ email: bot.email, password });
    if (error) throw new Error(`${bot.username} no pudo entrar: ${error.message}`);
    return new SupabaseGameSession(bot, client);
  }
}

class SupabaseGameSession implements GameSession {
  readonly bot: BotProfile;
  private readonly client: SupabaseClient;

  constructor(bot: BotProfile, client: SupabaseClient) {
    this.bot = bot;
    this.client = client;
  }

  async liveMatch(): Promise<MatchAssignment | null> {
    const { data, error } = await this.client.rpc('rpc_get_my_live_match');
    if (error) throw new Error(`rpc_get_my_live_match (${this.bot.username}): ${error.message}`);
    const live = data as LiveMatchDto | null;
    if (!live) return null;
    return {
      matchId: live.match.id,
      status: live.match.status,
      isBot: live.me.is_bot,
      hasTarget: live.target !== null,
      targetIsBot: live.target?.is_bot ?? null,
    };
  }

  async watchMatch(matchId: string, onStatus: (status: MatchStatus) => void): Promise<MatchWatch> {
    // El canal es privado: Realtime comprueba con el JWT del bot que juega
    // esa partida (docs/adr/0006).
    const { data } = await this.client.auth.getSession();
    if (data.session) await this.client.realtime.setAuth(data.session.access_token);

    const channel: RealtimeChannel = this.client
      .channel(`match:${matchId}`, { config: { private: true } })
      .on('broadcast', { event: 'match_updated' }, (msg) => {
        const status = (msg.payload as { status?: MatchStatus }).status;
        if (status) onStatus(status);
      })
      .subscribe();

    return {
      stop: async () => {
        await this.client.removeChannel(channel);
      },
    };
  }

  async close(): Promise<void> {
    await this.client.removeAllChannels();
    await this.client.auth.signOut({ scope: 'local' });
  }
}
