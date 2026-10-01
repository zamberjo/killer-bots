// Adaptador de `BotRegistry` sobre la API de administración de Auth.
//
// Es el ÚNICO uso de la clave de servicio (docs/adr/0010). La marca va en
// `app_metadata.is_bot`, que solo puede escribir la service_role; el backend
// la copia a `profiles.is_bot` (backend/supabase/migrations/00011_bots.sql).

import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { BotRegistry } from '../../application/ports.ts';
import type { BotProfile } from '../../domain/bot.ts';

const PAGE = 1000;

export class SupabaseBotRegistry implements BotRegistry {
  private readonly admin: SupabaseClient;

  constructor(url: string, secretKey: string) {
    this.admin = createClient(url, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async registeredEmails(): Promise<Set<string>> {
    const emails = new Set<string>();
    for (let page = 1; ; page++) {
      const { data, error } = await this.admin.auth.admin.listUsers({ page, perPage: PAGE });
      if (error) throw new Error(`No se pudo listar los usuarios: ${error.message}`);
      for (const user of data.users as User[]) {
        if (user.app_metadata?.is_bot === true && user.email) emails.add(user.email);
      }
      if (data.users.length < PAGE) return emails;
    }
  }

  async register(bot: BotProfile, password: string): Promise<void> {
    const { error } = await this.admin.auth.admin.createUser({
      email: bot.email,
      password,
      email_confirm: true,
      user_metadata: { username: bot.username },
      app_metadata: { is_bot: true },
    });
    if (error) throw new Error(`No se pudo dar de alta a ${bot.username}: ${error.message}`);
  }
}
