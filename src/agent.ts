// El agente de un bot dentro de una partida.
//
// En MB1 solo está presente: escucha el canal de la partida y registra lo que
// pasa. Moverse por la ciudad (MB2) necesita `rpc_report_position`, que llega
// con el hito M4; entonces aquí entra la máquina de estados
// EN_CASA → PASEANDO → PARADO → VOLVIENDO.

import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Bot, LiveMatch } from './bot.ts';
import { log } from './log.ts';

export class Agent {
  readonly bot: Bot;
  readonly matchId: string;
  status: string;
  private channel: RealtimeChannel | null = null;

  constructor(bot: Bot, live: LiveMatch) {
    this.bot = bot;
    this.matchId = live.match.id;
    this.status = live.match.status;
  }

  async start(): Promise<void> {
    const { data } = await this.bot.client.auth.getSession();
    if (data.session) await this.bot.client.realtime.setAuth(data.session.access_token);

    this.channel = this.bot.client
      .channel(`match:${this.matchId}`, { config: { private: true } })
      .on('broadcast', { event: 'match_updated' }, (msg) => {
        const status = (msg.payload as { status?: string }).status;
        if (status && status !== this.status) {
          this.status = status;
          log(this.bot.username, `partida ${this.matchId.slice(0, 8)}: ${status}`);
        }
      })
      .subscribe();

    log(this.bot.username, `en la partida ${this.matchId.slice(0, 8)} (${this.status})`);
  }

  async stop(): Promise<void> {
    if (this.channel) await this.bot.client.removeChannel(this.channel);
    this.channel = null;
  }
}
