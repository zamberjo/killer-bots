// Un bot dentro de una partida (docs/adr/0010, MB2).
//
// Cada `tickMs` decide qué hace según su rutina (domain/routine.ts), pide al
// mundo simulado que lo mueva y envía la lectura de su GPS como cualquier
// cliente. Lo que el servidor responda —sobre todo, si está fuera de zona— es
// la entrada de la siguiente decisión. Todavía no mata (M6).

import type { MatchAssignment, MatchStatus, ReportOutcome, Zone } from '../domain/bot.ts';
import {
  movementFor, nextActivity, walkingSpeed, type Activity, type RoutineState,
} from '../domain/routine.ts';
import type { Clock, GameSession, Logger, MatchWatch, Random, SimWorld } from './ports.ts';
import type { MatchMaps } from './match-maps.ts';

export interface AgentDeps {
  readonly world: SimWorld;
  readonly maps: MatchMaps;
  readonly clock: Clock;
  readonly random: Random;
  readonly logger: Logger;
  /** Cada cuánto decide y reporta. */
  readonly tickMs: number;
}

export class Agent {
  readonly session: GameSession;
  readonly matchId: string;
  readonly playerId: string;
  status: MatchStatus;
  /** Lo último que dijo el servidor de su posición. */
  lastOutcome: ReportOutcome | null = null;
  /** Actividades por las que ha pasado, en orden. Para seguirlo (y probarlo). */
  readonly history: Activity[] = [];
  /** Lecturas enviadas y, de ellas, las que el servidor rechazó y por qué. */
  reports = 0;
  readonly rejections: string[] = [];

  private readonly zone: Zone;
  private readonly deps: AgentDeps;
  private readonly speed: number;
  private routine: RoutineState | null = null;
  private lastTickAt: number | null = null;
  private watch: MatchWatch | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private busy = false;

  constructor(session: GameSession, assignment: MatchAssignment, deps: AgentDeps) {
    this.session = session;
    this.matchId = assignment.matchId;
    this.playerId = assignment.playerId;
    this.status = assignment.status;
    this.zone = assignment.zone;
    this.deps = deps;
    this.speed = walkingSpeed(() => deps.random.next());
  }

  private get who(): string {
    return this.session.bot.username;
  }

  get activity(): Activity | null {
    return this.routine?.activity ?? null;
  }

  async start(): Promise<void> {
    this.watch = await this.session.watchMatch(this.matchId, (status) => {
      if (status === this.status) return;
      this.status = status;
      this.deps.logger.info(this.who, `partida ${this.matchId.slice(0, 8)}: ${status}`);
    });
    this.deps.logger.info(this.who, `en la partida ${this.matchId.slice(0, 8)} (${this.status})`);
    this.timer = setInterval(() => void this.tick(), this.deps.tickMs);
    await this.tick();
  }

  /** Una decisión y, si toca, un paso y una lectura. */
  async tick(): Promise<void> {
    if (this.busy || this.status !== 'active') return;
    this.busy = true;
    try {
      await this.deps.maps.ensure(this.matchId, this.zone);
      if (this.lastTickAt === null) await this.deps.world.spawn(this.playerId);

      const now = this.deps.clock.now();
      const elapsed = this.lastTickAt === null ? 0 : (now.getTime() - this.lastTickAt) / 1000;
      this.lastTickAt = now.getTime();

      const next = nextActivity(
        this.routine,
        { local: this.deps.clock.local(), now: now.getTime(), inZone: this.lastOutcome?.inZone ?? null },
        () => this.deps.random.next(),
      );
      if (next.activity !== this.routine?.activity) {
        this.history.push(next.activity);
        this.deps.logger.info(this.who, next.activity);
      }
      this.routine = next;

      const movement = movementFor(next.activity);
      if (movement === 'silent') return;

      const meters = movement === 'stay' ? 0 : this.speed * elapsed;
      const reading = await this.deps.world.step(this.playerId, meters, movement);
      this.lastOutcome = await this.session.reportPosition(this.matchId, reading, now);
      this.reports++;
      if (!this.lastOutcome.accepted) {
        this.rejections.push(this.lastOutcome.rejectedReason ?? '?');
        this.deps.logger.info(this.who, `lectura rechazada: ${this.lastOutcome.rejectedReason}`);
      }
    } catch (e) {
      // Un fallo de red no mata al bot: lo intenta en el siguiente paso.
      this.deps.logger.info(this.who, (e as Error).message);
    } finally {
      this.busy = false;
    }
  }

  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    await this.watch?.stop();
    this.watch = null;
  }
}
