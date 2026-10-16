// Adaptador de `ElevationSource` con la misma altura en todas partes
// (`BOTS_ELEVATION_M`): para el e2e y para trabajar sin red. Sustituye al
// modelo de elevación —el mundo de fuera—, no a Supabase, como `FileMapSource`
// sustituye a OpenStreetMap.

import type { ElevationSource } from '../application/ports.ts';
import type { GeoPoint } from '../domain/bot.ts';

export class FixedElevationSource implements ElevationSource {
  private readonly elevationM: number;

  constructor(elevationM: number) {
    this.elevationM = elevationM;
  }

  async fetch(points: readonly GeoPoint[]): Promise<number[]> {
    return points.map(() => this.elevationM);
  }
}
