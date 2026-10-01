// `npm start`: da de alta los bots que falten y los mantiene jugando hasta
// Ctrl+C.

import { compose } from './composition.ts';
import { loadConfig } from './infrastructure/config.ts';

const config = loadConfig();
const app = compose(config);
const pool = await app.ensurePool.execute(config.poolSize);
await app.supervisor.start(pool, config.pollMs);

const shutdown = async () => {
  await app.supervisor.stop();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
