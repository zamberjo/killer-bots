// Caso de uso: que exista el grupo de bots.

import { botPool, type BotProfile } from '../domain/bot.ts';
import type { BotRegistry, Credentials, Logger } from './ports.ts';

export class EnsurePool {
  private readonly registry: BotRegistry;
  private readonly credentials: Credentials;
  private readonly logger: Logger;

  constructor(registry: BotRegistry, credentials: Credentials, logger: Logger) {
    this.registry = registry;
    this.credentials = credentials;
    this.logger = logger;
  }

  /** Da de alta los bots 1…`size` que falten y los devuelve. Idempotente. */
  async execute(size: number): Promise<BotProfile[]> {
    const pool = botPool(size);
    const existing = await this.registry.registeredEmails();

    let created = 0;
    for (const bot of pool) {
      if (existing.has(bot.email)) continue;
      await this.registry.register(bot, this.credentials.passwordFor(bot));
      created++;
    }

    this.logger.info('pool', `${size} bots listos (${created} nuevos)`);
    return pool;
  }
}
