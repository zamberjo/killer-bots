// Caso de uso: dar o quitar el rol de probador a una persona (docs/adr/0014).
//
// Con él, en una partida donde los demás son bots, la app de desarrollo puede
// ver dónde están los bots. El servidor exige además que no haya más humanos:
// el rol solo no basta para ver a nadie.

import type { AccountAdmin, Logger } from './ports.ts';

export class GrantTester {
  private readonly accounts: AccountAdmin;
  private readonly logger: Logger;

  constructor(accounts: AccountAdmin, logger: Logger) {
    this.accounts = accounts;
    this.logger = logger;
  }

  async execute(email: string, on: boolean): Promise<void> {
    if (!(await this.accounts.setTester(email, on))) {
      throw new Error(`No hay ninguna cuenta con el email ${email}.`);
    }
    this.logger.info('probador', `${email}: ${on ? 'rol concedido' : 'rol retirado'}`);
  }
}
