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
- Ningún cálculo geométrico aquí (`AGENTS.md` §3): cuando los bots anden
  (hito MB2, tras M4), la siguiente posición la dará PostGIS.

## Estado

**MB1 — los bots entran en las partidas.** El supervisor mantiene conectados a
los bots y, cuando el servidor mete a uno en una partida, le levanta un agente
que escucha el canal de esa partida. Todavía no se mueven ni matan.

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

Ninguna clave se escribe en el repositorio.

## Estructura: hexagonal

Tres capas y una raíz de composición. Las dependencias apuntan siempre hacia
dentro: `infrastructure → application → domain`.

| Capa | Qué hay | Puede importar |
| --- | --- | --- |
| `src/domain/` | Qué es un bot (`BotProfile`, el grupo) y qué sabe de su partida (`MatchAssignment`). TypeScript puro. | Solo `domain/` |
| `src/application/` | Casos de uso (`EnsurePool`, `Supervisor`, `Agent`) y los **puertos** que necesitan (`ports.ts`: `BotRegistry`, `Credentials`, `GameGateway`/`GameSession`, `Logger`). | `domain/` y `application/` |
| `src/infrastructure/` | Adaptadores: Supabase (alta de bots con la clave de servicio, sesión de juego de cada bot), contraseñas por HMAC, configuración, log. | Todo |
| `src/composition.ts` | Conecta los casos de uso con sus adaptadores. `main.ts` y `pool-cli.ts` solo arrancan. | Todo |

`npm run lint:arch` (también en el CI) falla si `domain/` o `application/`
importan algo que no les toca, incluido cualquier paquete.

El e2e (`test/fill.test.ts`) prueba la aplicación compuesta de verdad contra
el Supabase local: una partida con bots arranca con ellos y el supervisor se
entera.
