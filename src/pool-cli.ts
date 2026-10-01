// `npm run pool [-- <tamaño>]`: da de alta los bots que falten y termina.

import { compose } from './composition.ts';
import { loadConfig } from './infrastructure/config.ts';

const config = loadConfig();
const size = process.argv[2] ? Number(process.argv[2]) : config.poolSize;
await compose(config).ensurePool.execute(size);
