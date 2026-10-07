// Puertos: lo que la aplicación necesita del mundo, sin saber quién se lo da.
// Los adaptadores de `infrastructure/` los implementan; la composición
// (`src/composition.ts`) los conecta.

import type {
  BotProfile, CityMap, MatchAssignment, MatchStatus, Reading, ReportOutcome, Zone,
} from '../domain/bot.ts';
import type { LocalTime, Movement } from '../domain/routine.ts';

/** Dónde están dadas de alta las cuentas de los bots (Auth, con privilegios). */
export interface BotRegistry {
  /** Emails de las cuentas ya marcadas como bot. */
  registeredEmails(): Promise<Set<string>>;
  /** Da de alta la cuenta, marcada como bot. */
  register(bot: BotProfile, password: string): Promise<void>;
}

/**
 * Cuentas de personas, con privilegios: dar o quitar el rol de probador
 * (docs/adr/0014). Como la marca de bot, va en `app_metadata`, que solo puede
 * escribir la clave de servicio.
 */
export interface AccountAdmin {
  /** Da o quita el rol. `false` si no existe ninguna cuenta con ese email. */
  setTester(email: string, on: boolean): Promise<boolean>;
}

/** De dónde sale la contraseña de cada bot. No se guarda en ningún sitio. */
export interface Credentials {
  passwordFor(bot: BotProfile): string;
}

/** La entrada al juego: abre la sesión de un bot como la abriría la app. */
export interface GameGateway {
  connect(bot: BotProfile, password: string): Promise<GameSession>;
}

/** Un bot dentro del juego, con su propia sesión y su propio JWT. */
export interface GameSession {
  readonly bot: BotProfile;
  /** La partida viva del bot, o null. La decide el servidor. */
  liveMatch(): Promise<MatchAssignment | null>;
  /** Escucha los cambios de estado de una partida. */
  watchMatch(matchId: string, onStatus: (status: MatchStatus) => void): Promise<MatchWatch>;
  /** Envía una lectura como cualquier cliente (`rpc_report_position`). */
  reportPosition(matchId: string, reading: Reading, measuredAt: Date): Promise<ReportOutcome>;
  close(): Promise<void>;
}

export interface MatchWatch {
  stop(): Promise<void>;
}

/**
 * El mundo simulado: calles, casas y el GPS de cada bot. Toda su geometría la
 * hace PostGIS (esquema `sim`); aquí no se mide nada (AGENTS.md §3).
 */
export interface SimWorld {
  hasMap(matchId: string): Promise<boolean>;
  loadMap(matchId: string, map: CityMap): Promise<void>;
  /** Pone al bot en el mapa (una casa, la calle más cercana). Idempotente. */
  spawn(playerId: string): Promise<Reading>;
  /** Mueve al bot `meters` según `movement` y devuelve la lectura de su GPS. */
  step(playerId: string, meters: number, movement: Exclude<Movement, 'silent'>): Promise<Reading>;
}

/** De dónde salen las calles y los edificios de una zona. */
export interface MapSource {
  /** Un mapa vacío si no hay datos: entonces los bots pasean en recto. */
  fetch(zone: Zone): Promise<CityMap>;
}

/** La hora: la real, para las lecturas, y la local, para la rutina. */
export interface Clock {
  now(): Date;
  local(): LocalTime;
}

/** Azar en [0, 1). */
export interface Random {
  next(): number;
}

export interface Logger {
  info(who: string, message: string): void;
}
