// Adaptador de `SimWorld` sobre los puertos `public.sim_*` del backend
// (migración 00013_sim.sql), que solo ejecuta la service_role.
//
// Es el mundo, no el juego: mueve al bot y le da una lectura de GPS. Lo que
// esa lectura valga lo decide después `rpc_report_position`, con la sesión
// del propio bot, como para cualquier humano.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { SimWorld } from '../../application/ports.ts';
import type { CityMap, Reading } from '../../domain/bot.ts';
import type { Movement } from '../../domain/routine.ts';

interface ReadingDto {
  lat: number;
  lon: number;
  accuracy_m: number;
  altitude_m: number;
}

export class SupabaseSimWorld implements SimWorld {
  private readonly admin: SupabaseClient;

  constructor(url: string, secretKey: string) {
    this.admin = createClient(url, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async hasMap(matchId: string): Promise<boolean> {
    return (await this.call<boolean>('sim_has_map', { p_match_id: matchId })) === true;
  }

  async loadMap(matchId: string, map: CityMap): Promise<void> {
    await this.call('sim_load_map', { p_match_id: matchId, p_ways: map.ways, p_buildings: map.buildings });
  }

  async spawn(playerId: string): Promise<Reading> {
    return toReading(await this.call<ReadingDto>('sim_spawn', { p_player_id: playerId }));
  }

  async step(playerId: string, meters: number, movement: Exclude<Movement, 'silent'>): Promise<Reading> {
    return toReading(
      await this.call<ReadingDto>('sim_step', { p_player_id: playerId, p_meters: meters, p_mode: movement }),
    );
  }

  private async call<T>(fn: string, args: object): Promise<T> {
    const { data, error } = await this.admin.rpc(fn, args);
    if (error) throw new Error(`${fn}: ${error.message}`);
    return data as T;
  }
}

function toReading(r: ReadingDto): Reading {
  return { lat: r.lat, lon: r.lon, accuracyM: r.accuracy_m, altitudeM: r.altitude_m };
}
