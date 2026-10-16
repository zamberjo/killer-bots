// Adaptador de `ElevationSource` sobre la API de elevación de Open-Meteo
// (https://open-meteo.com/en/docs/elevation-api): el modelo Copernicus DEM
// GLO-90, alturas sobre el nivel del mar a 90 m, sin clave.
//
// Aquí no se mide nada: los puntos los elige el servidor
// (`sim_elevation_points`) y la interpolación también es suya (`sim.terrain_at`).
// Este adaptador solo los pregunta, de 100 en 100, que es lo que admite cada
// petición. La API pública cuenta cada punto como una llamada, con un cupo de
// 600 por minuto y 10.000 al día: vale para desarrollo, como Overpass
// (docs/adr/0010). Al pasarse del cupo por minuto, espera y sigue; con
// cualquier otro fallo no hay terreno, y los bots pasean igual, con la
// altitud fija.

import type { ElevationSource, Logger } from '../application/ports.ts';
import type { GeoPoint } from '../domain/bot.ts';

const BATCH = 100;
const RATE_LIMIT_WAIT_MS = 61_000;
const RATE_LIMIT_RETRIES = 5;

export class OpenMeteoElevationSource implements ElevationSource {
  private readonly url: string;
  private readonly logger: Logger;

  constructor(url: string, logger: Logger) {
    this.url = url;
    this.logger = logger;
  }

  async fetch(points: readonly GeoPoint[]): Promise<(number | null)[] | null> {
    const elevations: (number | null)[] = [];
    try {
      for (let i = 0; i < points.length; i += BATCH) {
        const batch = points.slice(i, i + BATCH);
        const query = new URLSearchParams({
          latitude: batch.map((p) => p.lat).join(','),
          longitude: batch.map((p) => p.lon).join(','),
        });
        const { elevation } = await this.request(query);
        if (!Array.isArray(elevation) || elevation.length !== batch.length) {
          throw new Error('respuesta sin una altura por punto');
        }
        for (const e of elevation) elevations.push(typeof e === 'number' && Number.isFinite(e) ? e : null);
      }
      return elevations;
    } catch (e) {
      this.logger.info('mapa', `Open-Meteo no responde (${(e as Error).message}): sin terreno`);
      return null;
    }
  }

  private async request(query: URLSearchParams): Promise<{ elevation?: unknown[] }> {
    for (let attempt = 0; ; attempt++) {
      const response = await fetch(`${this.url}?${query}`, {
        headers: { 'User-Agent': 'killer-bots (simulador de desarrollo)' },
        signal: AbortSignal.timeout(20_000),
      });
      if (response.ok) return (await response.json()) as { elevation?: unknown[] };
      const body = await response.text();
      // Solo el cupo por minuto se recupera esperando; el diario, no.
      if (response.status !== 429 || !body.includes('Minutely') || attempt >= RATE_LIMIT_RETRIES) {
        throw new Error(`HTTP ${response.status}`);
      }
      this.logger.info('mapa', 'Open-Meteo: cupo por minuto agotado, espero');
      await new Promise((r) => setTimeout(r, RATE_LIMIT_WAIT_MS));
    }
  }
}
