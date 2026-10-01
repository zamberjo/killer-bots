// Un bot es un cliente de verdad: su propia sesión, su propio JWT y las mismas
// RPC que la app (docs/adr/0010). Nada de la service_role a partir de aquí.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Config } from './config.ts';
import type { BotAccount } from './pool.ts';

/** Lo que devuelve `rpc_get_my_live_match` (docs/rpc-contract.md). */
export interface LiveMatch {
  match: { id: string; code: string; name: string | null; status: string; fill_with_bots: boolean };
  me: { id: string; username: string; avatar_id: string; status: string; is_bot: boolean };
  target: { id: string; username: string; avatar_id: string; is_bot: boolean } | null;
}

export class Bot {
  readonly account: BotAccount;
  readonly client: SupabaseClient;

  private constructor(account: BotAccount, client: SupabaseClient) {
    this.account = account;
    this.client = client;
  }

  get username(): string {
    return this.account.username;
  }

  static async signIn(config: Config, account: BotAccount): Promise<Bot> {
    const client = createClient(config.url, config.publishableKey, {
      // Un proceso largo: la sesión se renueva sola. No se guarda en disco.
      auth: { persistSession: false, autoRefreshToken: true },
    });
    const { error } = await client.auth.signInWithPassword({
      email: account.email,
      password: account.password,
    });
    if (error) throw new Error(`${account.username} no pudo entrar: ${error.message}`);
    return new Bot(account, client);
  }

  /** La partida viva del bot, o null. La decide el servidor. */
  async liveMatch(): Promise<LiveMatch | null> {
    const { data, error } = await this.client.rpc('rpc_get_my_live_match');
    if (error) throw new Error(`rpc_get_my_live_match (${this.username}): ${error.message}`);
    return (data as LiveMatch | null) ?? null;
  }

  async close(): Promise<void> {
    await this.client.removeAllChannels();
    await this.client.auth.signOut({ scope: 'local' });
  }
}
