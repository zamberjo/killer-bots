// Raíz de composición: el único sitio que conoce a la vez los casos de uso y
// los adaptadores, y los conecta.

import { EnsurePool } from './application/ensure-pool.ts';
import { Supervisor } from './application/supervisor.ts';
import type { Config } from './infrastructure/config.ts';
import { ConsoleLogger } from './infrastructure/console-logger.ts';
import { HmacCredentials } from './infrastructure/hmac-credentials.ts';
import { SupabaseBotRegistry } from './infrastructure/supabase/supabase-bot-registry.ts';
import { SupabaseGameGateway } from './infrastructure/supabase/supabase-game-gateway.ts';

export interface App {
  ensurePool: EnsurePool;
  supervisor: Supervisor;
}

export function compose(config: Config): App {
  const logger = new ConsoleLogger();
  const credentials = new HmacCredentials(config.botsSecret);
  return {
    ensurePool: new EnsurePool(new SupabaseBotRegistry(config.url, config.secretKey), credentials, logger),
    supervisor: new Supervisor(new SupabaseGameGateway(config.url, config.publishableKey), credentials, logger),
  };
}
