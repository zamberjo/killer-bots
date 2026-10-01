// Puertos: lo que la aplicación necesita del mundo, sin saber quién se lo da.
// Los adaptadores de `infrastructure/` los implementan; la composición
// (`src/composition.ts`) los conecta.

import type { BotProfile, MatchAssignment, MatchStatus } from '../domain/bot.ts';

/** Dónde están dadas de alta las cuentas de los bots (Auth, con privilegios). */
export interface BotRegistry {
  /** Emails de las cuentas ya marcadas como bot. */
  registeredEmails(): Promise<Set<string>>;
  /** Da de alta la cuenta, marcada como bot. */
  register(bot: BotProfile, password: string): Promise<void>;
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
  close(): Promise<void>;
}

export interface MatchWatch {
  stop(): Promise<void>;
}

export interface Logger {
  info(who: string, message: string): void;
}
