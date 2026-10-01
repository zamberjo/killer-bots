// Adaptador de `Logger`: una línea por suceso, para seguir a los bots en la
// terminal.

import type { Logger } from '../application/ports.ts';

export class ConsoleLogger implements Logger {
  info(who: string, message: string): void {
    console.log(`${new Date().toISOString()} [${who}] ${message}`);
  }
}
