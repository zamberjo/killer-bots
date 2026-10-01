// La rutina de un bot: qué hace a cada hora (docs/adr/0010, MB2).
//
// Una persona con el móvil en el bolsillo: de día sale y pasea, con paradas;
// a última hora está en casa; de noche, el móvil ni reporta. Y si el servidor
// le dice que se ha salido de la zona, vuelve. Muy poca lógica a propósito.
//
// Dominio puro: la hora y el azar entran como argumentos, así que la misma
// entrada da siempre la misma decisión.

/** Lo que está haciendo el bot. */
export type Activity = 'asleep' | 'home' | 'walking' | 'paused' | 'returning';

/** Cómo se mueve en el mundo simulado mientras hace eso. */
export type Movement = 'silent' | 'stay' | 'walk' | 'return' | 'home';

/** La hora local del bot: día de la semana (0 = domingo) y hora con decimales. */
export interface LocalTime {
  readonly weekday: number;
  readonly hour: number;
}

export interface RoutineState {
  readonly activity: Activity;
  /** Hasta cuándo dura (ms de época). Solo en paseo y en pausa. */
  readonly until: number | null;
}

export interface RoutineInput {
  readonly local: LocalTime;
  /** Instante actual, en ms de época. */
  readonly now: number;
  /** Lo que dijo el servidor de la última lectura: null si aún no hay. */
  readonly inZone: boolean | null;
}

const MINUTE = 60_000;

/** Franja del día según la hora local. */
export function partOfDay(local: LocalTime): 'out' | 'home' | 'night' {
  const weekend = local.weekday === 0 || local.weekday === 6;
  const [outFrom, outTo] = weekend ? [10, 21] : [9, 19];
  if (local.hour >= outFrom && local.hour < outTo) return 'out';
  if (local.hour >= 8 && local.hour < 23) return 'home';
  return 'night';
}

/** Duración al azar entre `min` y `max` minutos. */
function minutes(min: number, max: number, random: () => number): number {
  return (min + (max - min) * random()) * MINUTE;
}

/** La siguiente actividad. `random` da números en [0, 1). */
export function nextActivity(
  current: RoutineState | null,
  input: RoutineInput,
  random: () => number,
): RoutineState {
  const part = partOfDay(input.local);

  // Fuera de zona manda el servidor: se vuelve, salvo que el móvil duerma.
  if (part !== 'night' && input.inZone === false) {
    return { activity: 'returning', until: null };
  }

  if (part === 'night') return { activity: 'asleep', until: null };
  if (part === 'home') return { activity: 'home', until: null };

  // De día: paseos de 5–25 min con paradas de 2–10 min.
  const activity = current?.activity;
  const expired = current?.until != null && input.now >= current.until;
  if (activity === 'walking' && !expired) return current!;
  if (activity === 'paused' && !expired) return current!;
  if (activity === 'walking') {
    return { activity: 'paused', until: input.now + minutes(2, 10, random) };
  }
  return { activity: 'walking', until: input.now + minutes(5, 25, random) };
}

/** Cómo se mueve el bot en cada actividad. */
export function movementFor(activity: Activity): Movement {
  switch (activity) {
    case 'asleep':
      return 'silent';
    case 'home':
      return 'home';
    case 'walking':
      return 'walk';
    case 'paused':
      return 'stay';
    case 'returning':
      return 'return';
  }
}

/** Velocidad de paseo de un bot: entre 1,2 y 1,5 m/s, fija para cada uno. */
export function walkingSpeed(random: () => number): number {
  return 1.2 + 0.3 * random();
}
