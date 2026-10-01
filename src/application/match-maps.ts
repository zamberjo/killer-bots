// Caso de uso: que la partida tenga mapa antes de que sus bots anden.
//
// Varios bots de una misma partida arrancan a la vez: el mapa se pide una sola
// vez por partida y proceso, y el servidor, además, no duplica si dos procesos
// lo cargan a la vez (`sim.load_map` es idempotente).

import type { Zone } from '../domain/bot.ts';
import type { Logger, MapSource, SimWorld } from './ports.ts';

export class MatchMaps {
  private readonly world: SimWorld;
  private readonly source: MapSource;
  private readonly logger: Logger;
  private readonly loading = new Map<string, Promise<void>>();

  constructor(world: SimWorld, source: MapSource, logger: Logger) {
    this.world = world;
    this.source = source;
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
    if (await this.world.hasMap(matchId)) return;
    const map = await this.source.fetch(zone);
    await this.world.loadMap(matchId, map);
    this.logger.info('mapa', `partida ${matchId.slice(0, 8)}: ${map.ways.length} calles, ${map.buildings.length} edificios`);
  }
}
