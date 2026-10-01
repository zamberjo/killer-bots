// El supervisor: mantiene a los bots conectados y les levanta un agente cuando
// el servidor los mete en una partida.
//
// Quién entra en una partida lo decide el servidor (game.fill_with_bots, al
// vencer la ventana); el supervisor solo se entera. Lo hace preguntando a cada
// bot, con su propia sesión, por su partida viva: no hay un canal por usuario
// que avise de que te han metido en una partida, y así cada consulta prueba
// además el camino de un cliente real.

import type { BotProfile } from '../domain/bot.ts';
import { Agent, type AgentDeps } from './agent.ts';
import type { Credentials, GameGateway, GameSession, Logger } from './ports.ts';

export class Supervisor {
  private readonly gateway: GameGateway;
  private readonly credentials: Credentials;
  private readonly logger: Logger;
  private readonly agentDeps: AgentDeps;
  private readonly sessions: GameSession[] = [];
  /** Agente activo por username de bot. */
  private readonly agents = new Map<string, Agent>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private ticking = false;

  constructor(gateway: GameGateway, credentials: Credentials, agentDeps: AgentDeps) {
    this.gateway = gateway;
    this.credentials = credentials;
    this.logger = agentDeps.logger;
    this.agentDeps = agentDeps;
  }

  async start(pool: BotProfile[], pollMs: number): Promise<void> {
    for (const bot of pool) {
      this.sessions.push(await this.gateway.connect(bot, this.credentials.passwordFor(bot)));
    }
    this.logger.info('supervisor', `${this.sessions.length} bots conectados; mirando cada ${pollMs} ms`);
    await this.tick();
    this.timer = setInterval(() => void this.tick(), pollMs);
  }

  /** Una pasada: alta de agentes para los bots con partida, baja para los que ya no. */
  async tick(): Promise<void> {
    if (this.ticking) return;
    this.ticking = true;
    try {
      await Promise.all(this.sessions.map((session) => this.check(session)));
    } finally {
      this.ticking = false;
    }
  }

  private async check(session: GameSession): Promise<void> {
    const who = session.bot.username;
    let assignment;
    try {
      assignment = await session.liveMatch();
    } catch (e) {
      this.logger.info(who, (e as Error).message);
      return;
    }

    const current = this.agents.get(who);
    if (current && current.matchId === assignment?.matchId) {
      current.status = assignment.status;
      return;
    }
    if (current) {
      await current.stop();
      this.agents.delete(who);
      this.logger.info(who, `fuera de la partida ${current.matchId.slice(0, 8)}`);
    }
    if (assignment) {
      const agent = new Agent(session, assignment, this.agentDeps);
      this.agents.set(who, agent);
      await agent.start();
    }
  }

  /** Agentes en una partida concreta. */
  agentsIn(matchId: string): Agent[] {
    return [...this.agents.values()].filter((a) => a.matchId === matchId);
  }

  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    for (const agent of this.agents.values()) await agent.stop();
    this.agents.clear();
    for (const session of this.sessions) await session.close();
    this.sessions.length = 0;
  }
}
