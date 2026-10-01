// Registro mínimo, una línea por suceso, para seguir a los bots en la terminal.

export function log(who: string, message: string): void {
  console.log(`${new Date().toISOString()} [${who}] ${message}`);
}
