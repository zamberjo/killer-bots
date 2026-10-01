// Adaptador de `MapSource` que lee un mapa de un fichero JSON (`BOTS_MAP_FILE`):
// para el e2e y para trabajar sin red. Sustituye a OpenStreetMap —el mundo de
// fuera—, no a Supabase: igual que la posición fija del e2e de la app.

import { readFile } from 'node:fs/promises';
import type { MapSource } from '../application/ports.ts';
import type { CityMap } from '../domain/bot.ts';

export class FileMapSource implements MapSource {
  private readonly path: string;

  constructor(path: string) {
    this.path = path;
  }

  async fetch(): Promise<CityMap> {
    return JSON.parse(await readFile(this.path, 'utf8')) as CityMap;
  }
}
