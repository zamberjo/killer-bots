// El supervisor: mantiene a los bots conectados y les levanta un agente cuando
// el servidor los mete en una partida.
//
// Quién entra en una partida lo decide el servidor (game.fill_with_bots, al
// vencer la ventana); el supervisor solo se entera. Lo hace preguntando a cada
// bot, con su propia sesión, por su partida viva: no hay un canal por usuario
// que avise de que te han metido en una partida, y así cada consulta prueba
// además el camino de un cliente real.

import { Agent } from './agent.ts';
import { Bot } from './bot.ts';
import type { Config } from './config.ts';
import { log } from './log.ts';
import type { BotAccount } from './pool.ts';

export class Supervisor {
  private readonly config: Config;
  private readonly bots: Bot[] = [];
  /** Agente activo por username de bot. */
  readonly agents = new Map<string, Agent>();
  private timer: NodeJS.Timeout | null = null;
  private ticking = false;

  constructor(config: Config) {
    this.config = config;
  }

  async start(accounts: BotAccount[], pollMs = this.config.pollMs): Promise<void> {
    for (const account of accounts) {
      this.bots.push(await Bot.signIn(this.config, account));
    }
    log('supervisor', `${this.bots.length} bots conectados; mirando cada ${pollMs} ms`);
    await this.tick();
    this.timer = setInterval(() => void this.tick(), pollMs);
  }

  /** Una pasada: alta de agentes para los bots con partida, baja para los que ya no. */
  async tick(): Promise<void> {
    if (this.ticking) return;
    this.ticking = true;
    try {
      await Promise.all(this.bots.map((bot) => this.check(bot)));
    } finally {
      this.ticking = false;
    }
  }

  private async check(bot: Bot): Promise<void> {
    let live;
    try {
      live = await bot.liveMatch();
    } catch (e) {
      log(bot.username, (e as Error).message);
      return;
    }

    const current = this.agents.get(bot.username);
    if (current && current.matchId === live?.match.id) {
      current.status = live.match.status;
      return;
    }
    if (current) {
      await current.stop();
      this.agents.delete(bot.username);
      log(bot.username, `fuera de la partida ${current.matchId.slice(0, 8)}`);
    }
    if (live) {
      const agent = new Agent(bot, live);
      this.agents.set(bot.username, agent);
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
    for (const bot of this.bots) await bot.close();
    this.bots.length = 0;
  }
}
