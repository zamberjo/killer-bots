// Adaptador de `Random` sobre Math.random: el azar de las decisiones de rutina.

import type { Random } from '../application/ports.ts';

export class MathRandom implements Random {
  next(): number {
    return Math.random();
  }
}
