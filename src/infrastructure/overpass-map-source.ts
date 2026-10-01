// Adaptador de `MapSource` sobre la API de Overpass (OpenStreetMap).
//
// El filtro por la zona lo aplica Overpass (`poly:`), no este código: aquí solo
// se escribe la lista de vértices en el formato que pide. Los edificios vienen
// con su centro ya calculado (`out center`).
//
// La API pública vale para desarrollo, no para producción (docs/adr/0010). Si
// no responde, el mapa sale vacío y los bots pasean en recto entre casas al
// azar: peor paseo, pero ningún bot se queda parado.

import type { Logger, MapSource } from '../application/ports.ts';
import type { CityMap, Zone } from '../domain/bot.ts';

const WALKABLE =
  '^(footway|pedestrian|path|living_street|residential|service|unclassified|tertiary|secondary|primary|steps|cycleway|track)$';

interface OverpassElement {
  type: string;
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
  center?: { lat: number; lon: number };
}

export class OverpassMapSource implements MapSource {
  private readonly url: string;
  private readonly logger: Logger;

  constructor(url: string, logger: Logger) {
    this.url = url;
    this.logger = logger;
  }

  async fetch(zone: Zone): Promise<CityMap> {
    // Overpass quiere «lat lon lat lon …» del anillo exterior.
    const ring = zone.coordinates[0] ?? [];
    const poly = ring.map(([lon, lat]) => `${lat} ${lon}`).join(' ');
    const query = `[out:json][timeout:25];
      way["highway"~"${WALKABLE}"](poly:"${poly}");
      out geom;
      way["building"](poly:"${poly}");
      out center 2000;`;

    try {
      const response = await fetch(this.url, {
        method: 'POST',
        body: new URLSearchParams({ data: query }),
        headers: { 'User-Agent': 'killer-bots (simulador de desarrollo)' },
        signal: AbortSignal.timeout(40_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const { elements } = (await response.json()) as { elements: OverpassElement[] };

      const ways: [number, number][][] = [];
      const buildings: [number, number][] = [];
      for (const e of elements) {
        if (e.tags?.highway && e.geometry && e.geometry.length >= 2) {
          ways.push(e.geometry.map((p) => [p.lon, p.lat]));
        } else if (e.tags?.building && e.center) {
          buildings.push([e.center.lon, e.center.lat]);
        }
      }
      return { ways, buildings };
    } catch (e) {
      this.logger.info('mapa', `Overpass no responde (${(e as Error).message}): sin calles, paseo en recto`);
      return { ways: [], buildings: [] };
    }
  }
}
