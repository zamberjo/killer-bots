// Dominio: qué es un bot y qué sabe de su partida. TypeScript puro: no importa
// Supabase, ni Node, ni nada de fuera (ver CLAUDE.md, «Capas»).

/** Un bot del grupo. La contraseña no es del dominio: la da un puerto. */
export interface BotProfile {
  /** Número en el grupo, desde 1. Lo identifica de forma estable. */
  readonly n: number;
  readonly email: string;
  /** Username global. Empieza por `bot_`: los bots se ven (docs/adr/0010). */
  readonly username: string;
}

export type MatchStatus = 'recruiting' | 'active' | 'finished' | 'cancelled';

/**
 * La partida viva de un bot, tal como la cuenta el servidor
 * (`rpc_get_my_live_match`). Solo lo que el bot necesita para comportarse.
 */
export interface MatchAssignment {
  readonly matchId: string;
  readonly status: MatchStatus;
  readonly isBot: boolean;
  /** Tiene víctima asignada: está en la rueda. Su identidad no hace falta aún. */
  readonly hasTarget: boolean;
  readonly targetIsBot: boolean | null;
}

const NAMES = [
  'ana', 'bruno', 'carla', 'dario', 'elena', 'fermin', 'gala', 'hugo',
  'irene', 'jorge', 'kira', 'lucas', 'marta', 'nico', 'olga', 'pablo',
  'quima', 'rocio', 'sergio', 'tania', 'ulises', 'vera', 'walter', 'ximena',
  'yago', 'zoe', 'alba', 'blas', 'celia', 'dani',
];

/**
 * El bot número `n`. El username cumple el formato del servidor
 * (`^[A-Za-z0-9_]{3,20}$`); más allá de la lista de nombres, lleva número.
 * Dentro de una partida el servidor le añade un sufijo si alguien ya usa el
 * suyo.
 */
export function botProfile(n: number): BotProfile {
  const base = NAMES[(n - 1) % NAMES.length]!;
  const round = Math.floor((n - 1) / NAMES.length);
  return {
    n,
    email: `bot-${String(n).padStart(3, '0')}@bots.killer.invalid`,
    username: round === 0 ? `bot_${base}` : `bot_${base}_${round + 1}`,
  };
}

/** Los bots 1…`size`. */
export function botPool(size: number): BotProfile[] {
  return Array.from({ length: size }, (_, i) => botProfile(i + 1));
}
