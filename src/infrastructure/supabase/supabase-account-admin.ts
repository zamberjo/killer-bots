// Adaptador de `AccountAdmin` sobre la API de administración de Auth, con la
// clave de servicio. El rol va en `app_metadata.is_tester`, que el backend
// copia a `profiles.is_tester` (migración 00016) y el cliente no puede escribir.

import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { AccountAdmin } from '../../application/ports.ts';

const PAGE = 1000;

export class SupabaseAccountAdmin implements AccountAdmin {
  private readonly admin: SupabaseClient;

  constructor(url: string, secretKey: string) {
    this.admin = createClient(url, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async setTester(email: string, on: boolean): Promise<boolean> {
    const user = await this.findByEmail(email.trim().toLowerCase());
    if (!user) return false;
    const { error } = await this.admin.auth.admin.updateUserById(user.id, {
      app_metadata: { ...user.app_metadata, is_tester: on },
    });
    if (error) throw new Error(`No se pudo cambiar el rol de ${email}: ${error.message}`);
    return true;
  }

  private async findByEmail(email: string): Promise<User | null> {
    for (let page = 1; ; page++) {
      const { data, error } = await this.admin.auth.admin.listUsers({ page, perPage: PAGE });
      if (error) throw new Error(`No se pudo listar los usuarios: ${error.message}`);
      const found = (data.users as User[]).find((u) => u.email?.toLowerCase() === email);
      if (found) return found;
      if (data.users.length < PAGE) return null;
    }
  }
}
