// Caso de uso: que la partida tenga mapa antes de que sus bots anden, y
// terreno en cuanto se pueda.
//
// Varios bots de una misma partida arrancan a la vez: el mapa se pide una sola
// vez por partida y proceso, y el servidor, además, no duplica si dos procesos
// lo cargan a la vez (`sim.load_map` y `sim.load_terrain` son idempotentes).
//
// El terreno (docs/TODO.md §22) va aparte del mapa, y en segundo plano: el
// modelo de elevación tiene un cupo por minuto y puede tardar, y mientras
// tanto los bots ya andan, con la altitud fija; en cuanto llega, su lectura
// sigue al suelo. Una partida cuyo mapa se cargó antes de que existiera el
// terreno lo recibe igual al volver a arrancar. Si el modelo no responde, no
// se reintenta hasta el siguiente arranque del simulador.

import type { TerrainSample, Zone } from '../domain/bot.ts';
import type { ElevationSource, Logger, MapSource, SimWorld } from './ports.ts';

export class MatchMaps {
  private readonly world: SimWorld;
  private readonly source: MapSource;
  private readonly elevation: ElevationSource;
  private readonly logger: Logger;
  private readonly loading = new Map<string, Promise<void>>();

  constructor(world: SimWorld, source: MapSource, elevation: ElevationSource, logger: Logger) {
    this.world = world;
    this.source = source;
    this.elevation = elevation;
    this.logger = logger;
  }

  ensure(matchId: string, zone: Zone): Promise<void> {
    let pending = this.loading.get(matchId);
    if (!pending) {
      pending = this.load(matchId, zone).catch((e: unknown) => {
        // Si falla, que el siguiente bot lo vuelva a intentar.
        this.loading.delete(matchId);
        throw e;
      });
      this.loading.set(matchId, pending);
    }
    return pending;
  }

  private async load(matchId: string, zone: Zone): Promise<void> {
    if (!(await this.world.hasMap(matchId))) {
      const map = await this.source.fetch(zone);
      await this.world.loadMap(matchId, map);
      this.logger.info('mapa', `partida ${matchId.slice(0, 8)}: ${map.ways.length} calles, ${map.buildings.length} edificios`);
    }
    if (!(await this.world.hasTerrain(matchId))) {
      void this.loadTerrain(matchId).catch((e: unknown) => {
        this.logger.info('mapa', `partida ${matchId.slice(0, 8)}: sin terreno (${(e as Error).message})`);
      });
    }
  }

  private async loadTerrain(matchId: string): Promise<void> {
    const points = await this.world.elevationPoints(matchId);
    const elevations = await this.elevation.fetch(points);
    if (!elevations) {
      this.logger.info('mapa', `partida ${matchId.slice(0, 8)}: sin terreno, altitud fija`);
      return;
    }
    const samples: TerrainSample[] = [];
    points.forEach((p, i) => {
      const elevationM = elevations[i];
      if (elevationM != null) samples.push({ ...p, elevationM });
    });
    const loaded = await this.world.loadTerrain(matchId, samples);
    this.logger.info('mapa', `partida ${matchId.slice(0, 8)}: terreno de ${loaded} puntos`);
  }
}
