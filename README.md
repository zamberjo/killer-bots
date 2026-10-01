# killer-bots

Simulador de teléfonos de Killer: **bots** que juegan como clientes reales.
Decidido en el [ADR 0010](https://github.com/zamberjo/killer-docs/blob/main/adr/0010-bots.md)
del repositorio `docs`.

La idea que lo gobierna todo: **el servidor decide quién juega; este programa
solo hace lo que haría un teléfono.**

- Que un bot entre en una partida lo decide el backend: al vencer la ventana
  de reclutamiento de una partida creada con «rellenar con bots»,
  `game.sweep_recruitment()` ocupa los huecos con bots libres y arranca, en la
  misma transacción. Este programa no mete a nadie en ninguna partida.
- Cada bot es una cuenta de Auth de verdad, marcada con `app_metadata.is_bot`.
  Juega con **su propia sesión y su propio JWT**, por las mismas RPC que la
  app. La clave de servicio solo se usa para dar de alta a los bots.
- Ningún cálculo geométrico aquí (`AGENTS.md` §3): el siguiente paso de cada
  bot, y el ruido de su GPS, los da PostGIS (esquema `sim` del backend).

## Estado

**MB2 — los bots andan.** El supervisor mantiene conectados a los bots y,
cuando el servidor mete a uno en una partida, le levanta un agente. El agente
sigue una rutina sencilla según la hora local (`domain/routine.ts`):

| Hora (laborable · fin de semana) | Qué hace |
| --- | --- |
| 9–19 · 10–21 | Pasea por las calles 5–25 min, se para 2–10 min, y vuelta a empezar |
| 8–9 y 19–23 · 8–10 y 21–23 | En casa: vuelve andando y se queda |
| 23–8 | Dormido: el móvil ni reporta |

Y en cualquier momento, si el servidor le dice que está **fuera de zona**,
vuelve a la calle más cercana. Cada paso lo da PostGIS y cada lectura la envía
el bot con su sesión por `rpc_report_position`, que la valida como la de
cualquiera: un bot no tiene ventajas. Todavía no matan (M6).

Las calles y los edificios salen de OpenStreetMap (Overpass), filtrados por la
zona. Si Overpass no responde, los bots pasean en recto entre casas al azar.

## Uso

### Con Docker (sin instalar Node)

Requiere Docker y el backend local arrancado (`supabase start` en
`../backend`). `bots.sh` lee las claves de `supabase status` y se las pasa al
contenedor por entorno; el contenedor se une a la red de Supabase y le habla
por dentro de Docker.

```bash
./bots.sh up          # bots conectados, en segundo plano
./bots.sh logs        # sus logs (Ctrl+C para salir)
./bots.sh down        # pararlos
./bots.sh pool [N]    # dar de alta los bots que falten y salir
./bots.sh test        # e2e contra el Supabase local
./bots.sh check       # tipos y capas, lo que exige el CI
```

Para verlos pasear a cualquier hora: `BOTS_FORCE_HOUR=11 ./bots.sh up`.

El código se monta en el contenedor: un cambio en `src/` o `test/` no obliga a
reconstruir la imagen. Un cambio de dependencias, sí (`bots.sh` reconstruye en
`up`, `pool`, `test` y `check`).

### Con Node instalado

Node ≥ 22.18, que ejecuta TypeScript sin compilar.

```bash
npm ci
npm run pool          # da de alta los bots que falten (30 por defecto) y termina
npm start             # los mantiene jugando hasta Ctrl+C
npm test              # e2e contra el Supabase local
npm run typecheck && npm run lint:arch
```

Las claves se leen de `supabase status` en `../backend` (o en `BACKEND_DIR`).
También pueden llegar por entorno:

| Variable | Para qué |
| --- | --- |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` | El proyecto de Supabase. La secreta solo da de alta bots. |
| `BOTS_SECRET` | De él se deriva la contraseña de cada bot, que no se guarda en ningún sitio. Obligatorio fuera de local. |
| `BOTS_POOL_SIZE` | Cuántos bots hay en el grupo (30). |
| `BOTS_POLL_MS` | Cada cuánto mira cada bot si está en una partida (15 000). |
| `BOTS_TICK_MS` | Cada cuánto decide y reporta un bot en partida (20 000). |
| `BOTS_TIMEZONE` | Zona horaria de la rutina (`Europe/Madrid`). |
| `BOTS_FORCE_HOUR` | Hora local fija para la rutina, p. ej. `11` para verlos pasear de noche. |
| `BOTS_MAP_FILE` | Mapa de un fichero JSON en vez de Overpass (sin red, pruebas). |
| `BOTS_OVERPASS_URL` | Otra instancia de Overpass. |

Ninguna clave se escribe en el repositorio.

## Estructura: hexagonal

Tres capas y una raíz de composición. Las dependencias apuntan siempre hacia
dentro: `infrastructure → application → domain`.

| Capa | Qué hay | Puede importar |
| --- | --- | --- |
| `src/domain/` | Qué es un bot (`BotProfile`, el grupo) y qué sabe de su partida (`MatchAssignment`). TypeScript puro. | Solo `domain/` |
| `src/application/` | Casos de uso (`EnsurePool`, `Supervisor`, `Agent`, `MatchMaps`) y los **puertos** que necesitan (`ports.ts`: `BotRegistry`, `Credentials`, `GameGateway`/`GameSession`, `SimWorld`, `MapSource`, `Clock`, `Random`, `Logger`). | `domain/` y `application/` |
| `src/infrastructure/` | Adaptadores: Supabase (alta de bots y mundo simulado con la clave de servicio; sesión de juego de cada bot), Overpass o un fichero para el mapa, reloj, azar, contraseñas por HMAC, configuración, log. | Todo |
| `src/composition.ts` | Conecta los casos de uso con sus adaptadores. `main.ts` y `pool-cli.ts` solo arrancan. | Todo |

`npm run lint:arch` (también en el CI) falla si `domain/` o `application/`
importan algo que no les toca, incluido cualquier paquete.

Los e2e prueban la aplicación compuesta de verdad contra el Supabase local, uno
detrás de otro (comparten el grupo de bots):

- `test/fill.test.ts` — una partida con bots arranca con ellos y el supervisor
  se entera.
- `test/walk.test.ts` — a las 11 de un laborable los bots pasean, el servidor
  acepta cada lectura sin un solo `too_fast`, y uno colocado fuera de la zona
  vuelve cuando el servidor se lo dice.

El mapa de los e2e es un fichero (`test/fixtures/grid-map.json`): no dependen
de que Overpass responda.
