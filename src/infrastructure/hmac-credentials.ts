// Adaptador de `Credentials`: la contraseña de cada bot se deriva de un secreto
// con HMAC, así que no hay que guardarla en ningún sitio.

import { createHmac } from 'node:crypto';
import type { Credentials } from '../application/ports.ts';
import type { BotProfile } from '../domain/bot.ts';

export class HmacCredentials implements Credentials {
  private readonly secret: string;

  constructor(secret: string) {
    this.secret = secret;
  }

  passwordFor(bot: BotProfile): string {
    return createHmac('sha256', this.secret).update(bot.email).digest('base64url');
  }
}
