// Configuración del simulador (adaptador de entrada: entorno y `supabase status`).
//
// Las claves llegan por entorno. En local, si no están, se leen de `supabase
// status` en el backend —igual que mobile/run_e2e.sh y backend/e2e—: ninguna
// clave se escribe en el repositorio (../AGENTS.md).

import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

export interface Config {
  url: string;
  publishableKey: string;
  /** Solo para dar de alta a los bots. Nunca para jugar (docs/adr/0010). */
  secretKey: string;
  /** De él se deriva la contraseña de cada bot: no se guarda ninguna. */
  botsSecret: string;
  poolSize: number;
  /** Cada cuánto mira cada bot si está en una partida. */
  pollMs: number;
  /** Cada cuánto decide y reporta un bot en partida. */
  tickMs: number;
  /** Zona horaria de la rutina de los bots. */
  timeZone: string;
  /** Hora local fija para la rutina (pruebas, desarrollo de noche), o null. */
  forceHour: number | null;
  /** Mapa de un fichero en vez de Overpass (pruebas, sin red), o null. */
  mapFile: string | null;
  overpassUrl: string;
}

function readStatus(backendDir: string): Record<string, string> {
  try {
    const raw = execSync('supabase status -o env', {
      cwd: backendDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return Object.fromEntries(
      raw
        .split('\n')
        .map((line) => line.match(/^([A-Z_]+)="?(.*?)"?$/))
        .filter((m): m is RegExpMatchArray => m !== null)
        .map((m) => [m[1], m[2]]),
    );
  } catch {
    return {};
  }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const fromEnv = env.SUPABASE_URL && env.SUPABASE_PUBLISHABLE_KEY && env.SUPABASE_SECRET_KEY;
  const status = fromEnv ? {} : readStatus(resolve(env.BACKEND_DIR ?? '../backend'));

  const url = env.SUPABASE_URL ?? status.API_URL;
  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY ?? status.PUBLISHABLE_KEY;
  const secretKey = env.SUPABASE_SECRET_KEY ?? status.SECRET_KEY;
  if (!url || !publishableKey || !secretKey) {
    throw new Error(
      'Faltan las claves de Supabase: arranca el backend (`supabase start` en ../backend) ' +
        'o define SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY y SUPABASE_SECRET_KEY.',
    );
  }

  // En local vale un secreto fijo: las cuentas de bot de una base local no
  // protegen nada. Fuera de local es obligatorio.
  const local = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/.test(url);
  const botsSecret = env.BOTS_SECRET ?? (local ? 'killer-bots-local-only' : undefined);
  if (!botsSecret) {
    throw new Error('Falta BOTS_SECRET: fuera de local, la contraseña de los bots no puede ser conocida.');
  }

  return {
    url,
    publishableKey,
    secretKey,
    botsSecret,
    poolSize: Number(env.BOTS_POOL_SIZE ?? 30),
    pollMs: Number(env.BOTS_POLL_MS ?? 15_000),
    tickMs: Number(env.BOTS_TICK_MS ?? 20_000),
    timeZone: env.BOTS_TIMEZONE ?? 'Europe/Madrid',
    forceHour: env.BOTS_FORCE_HOUR ? Number(env.BOTS_FORCE_HOUR) : null,
    mapFile: env.BOTS_MAP_FILE ?? null,
    overpassUrl: env.BOTS_OVERPASS_URL ?? 'https://overpass-api.de/api/interpreter',
  };
}
