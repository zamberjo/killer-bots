// `npm start`: da de alta los bots que falten y los mantiene jugando hasta
// Ctrl+C.

import { loadConfig } from './config.ts';
import { log } from './log.ts';
import { ensurePool } from './pool.ts';
import { Supervisor } from './supervisor.ts';

const config = loadConfig();
const accounts = await ensurePool(config);
const supervisor = new Supervisor(config);
await supervisor.start(accounts);

const shutdown = async () => {
  log('supervisor', 'parando');
  await supervisor.stop();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
