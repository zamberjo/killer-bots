// `npm run pool [-- <tamaño>]`: da de alta los bots que falten y termina.

import { loadConfig } from './config.ts';
import { ensurePool } from './pool.ts';

const config = loadConfig();
const size = process.argv[2] ? Number(process.argv[2]) : config.poolSize;
await ensurePool(config, size);
