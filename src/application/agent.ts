// Un bot dentro de una partida.
//
// En MB1 solo está presente: escucha la partida y registra lo que pasa.
// Moverse por la ciudad (MB2) necesita `rpc_report_position`, que llega con el
// hito M4; entonces aquí entra la máquina de estados
// EN_CASA → PASEANDO → PARADO → VOLVIENDO.

import type { MatchAssignment, MatchStatus } from '../domain/bot.ts';
import type { GameSession, Logger, MatchWatch } from './ports.ts';

export class Agent {
  readonly session: GameSession;
  readonly matchId: string;
  status: MatchStatus;
  private readonly logger: Logger;
  private watch: MatchWatch | null = null;

  constructor(session: GameSession, assignment: MatchAssignment, logger: Logger) {
    this.session = session;
    this.matchId = assignment.matchId;
    this.status = assignment.status;
    this.logger = logger;
  }

  private get who(): string {
    return this.session.bot.username;
  }

  async start(): Promise<void> {
    this.watch = await this.session.watchMatch(this.matchId, (status) => {
      if (status === this.status) return;
      this.status = status;
      this.logger.info(this.who, `partida ${this.matchId.slice(0, 8)}: ${status}`);
    });
    this.logger.info(this.who, `en la partida ${this.matchId.slice(0, 8)} (${this.status})`);
  }

  async stop(): Promise<void> {
    await this.watch?.stop();
    this.watch = null;
  }
}
