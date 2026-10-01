// Usernames globales de los bots. Cumplen el formato del username
// (`^[A-Za-z0-9_]{3,20}$`) y empiezan por `bot_`: así no le quitan un nombre a
// nadie y, como los bots se ven (docs/adr/0010), se reconocen hasta en un log.
// Dentro de una partida el servidor les añade un sufijo si alguien ya usa el
// suyo.

const NAMES = [
  'ana', 'bruno', 'carla', 'dario', 'elena', 'fermin', 'gala', 'hugo',
  'irene', 'jorge', 'kira', 'lucas', 'marta', 'nico', 'olga', 'pablo',
  'quima', 'rocio', 'sergio', 'tania', 'ulises', 'vera', 'walter', 'ximena',
  'yago', 'zoe', 'alba', 'blas', 'celia', 'dani',
];

/** Username del bot número `n` (desde 1). Más allá de la lista, con número. */
export function botUsername(n: number): string {
  const base = NAMES[(n - 1) % NAMES.length]!;
  const round = Math.floor((n - 1) / NAMES.length);
  return round === 0 ? `bot_${base}` : `bot_${base}_${round + 1}`;
}

export function botEmail(n: number): string {
  return `bot-${String(n).padStart(3, '0')}@bots.killer.invalid`;
}
