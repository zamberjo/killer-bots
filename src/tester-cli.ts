// `npm run tester -- <email> [--revoke]`: da (o quita) el rol de probador a
// una persona (docs/adr/0014) y termina.

import { compose } from './composition.ts';
import { loadConfig } from './infrastructure/config.ts';

const args = process.argv.slice(2);
const email = args.find((a) => !a.startsWith('--'));
if (!email) {
  console.error('Uso: npm run tester -- <email> [--revoke]');
  process.exit(2);
}
await compose(loadConfig()).grantTester.execute(email, !args.includes('--revoke'));
