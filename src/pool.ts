// El grupo de bots: cuentas de verdad en Auth, marcadas como bot.
//
// La marca va en `app_metadata.is_bot`, que solo puede escribir la
// service_role; el trigger de alta la copia a `profiles.is_bot`
// (backend/supabase/migrations/00011_bots.sql). Es el único uso de la clave de
// servicio: a partir de aquí cada bot juega con su propia sesión.

import { createHmac } from 'node:crypto';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { Config } from './config.ts';
import { log } from './log.ts';
import { botEmail, botUsername } from './names.ts';

export interface BotAccount {
  n: number;
  email: string;
  username: string;
  password: string;
}

/** La contraseña del bot se deriva del secreto: no hay que guardarla. */
export function botPassword(config: Config, email: string): string {
  return createHmac('sha256', config.botsSecret).update(email).digest('base64url');
}

export function account(config: Config, n: number): BotAccount {
  const email = botEmail(n);
  return { n, email, username: botUsername(n), password: botPassword(config, email) };
}

function adminClient(config: Config): SupabaseClient {
  return createClient(config.url, config.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function existingBotEmails(admin: SupabaseClient): Promise<Set<string>> {
  const emails = new Set<string>();
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`No se pudo listar los usuarios: ${error.message}`);
    for (const user of data.users as User[]) {
      if (user.app_metadata?.is_bot === true && user.email) emails.add(user.email);
    }
    if (data.users.length < 1000) return emails;
  }
}

/**
 * Se asegura de que existan los bots 1…`size` y los devuelve. Idempotente: los
 * que ya existen no se tocan.
 */
export async function ensurePool(config: Config, size = config.poolSize): Promise<BotAccount[]> {
  const admin = adminClient(config);
  const existing = await existingBotEmails(admin);
  const accounts = Array.from({ length: size }, (_, i) => account(config, i + 1));

  let created = 0;
  for (const bot of accounts) {
    if (existing.has(bot.email)) continue;
    const { error } = await admin.auth.admin.createUser({
      email: bot.email,
      password: bot.password,
      email_confirm: true,
      user_metadata: { username: bot.username },
      app_metadata: { is_bot: true },
    });
    if (error) throw new Error(`No se pudo dar de alta a ${bot.username}: ${error.message}`);
    created++;
  }

  log('pool', `${size} bots listos (${created} nuevos)`);
  return accounts;
}
