// Raíz de composición: el único sitio que conoce a la vez los casos de uso y
// los adaptadores, y los conecta.

import { EnsurePool } from './application/ensure-pool.ts';
import { MatchMaps } from './application/match-maps.ts';
import type { MapSource } from './application/ports.ts';
import { Supervisor } from './application/supervisor.ts';
import type { Config } from './infrastructure/config.ts';
import { ConsoleLogger } from './infrastructure/console-logger.ts';
import { FileMapSource } from './infrastructure/file-map-source.ts';
import { HmacCredentials } from './infrastructure/hmac-credentials.ts';
import { MathRandom } from './infrastructure/math-random.ts';
import { OverpassMapSource } from './infrastructure/overpass-map-source.ts';
import { SupabaseBotRegistry } from './infrastructure/supabase/supabase-bot-registry.ts';
import { SupabaseGameGateway } from './infrastructure/supabase/supabase-game-gateway.ts';
import { SupabaseSimWorld } from './infrastructure/supabase/supabase-sim-world.ts';
import { SystemClock } from './infrastructure/system-clock.ts';

export interface App {
  ensurePool: EnsurePool;
  supervisor: Supervisor;
}

export function compose(config: Config): App {
  const logger = new ConsoleLogger();
  const credentials = new HmacCredentials(config.botsSecret);
  const world = new SupabaseSimWorld(config.url, config.secretKey);
  const source: MapSource = config.mapFile
    ? new FileMapSource(config.mapFile)
    : new OverpassMapSource(config.overpassUrl, logger);

  return {
    ensurePool: new EnsurePool(new SupabaseBotRegistry(config.url, config.secretKey), credentials, logger),
    supervisor: new Supervisor(new SupabaseGameGateway(config.url, config.publishableKey), credentials, {
      world,
      maps: new MatchMaps(world, source, logger),
      clock: new SystemClock(config.timeZone, config.forceHour),
      random: new MathRandom(),
      logger,
      tickMs: config.tickMs,
    }),
  };
}
