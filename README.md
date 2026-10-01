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

Requiere el backend local arrancado (`supabase start` en `../backend`) y
Node ≥ 22.18, que ejecuta TypeScript sin compilar.

```bash
npm ci
npm run pool          # da de alta los bots que falten (30 por defecto) y termina
npm start             # los mantiene jugando hasta Ctrl+C
npm test              # e2e contra el Supabase local
npm run typecheck
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

## Estructura

| Fichero | Qué hace |
| --- | --- |
| `src/pool.ts` | El grupo de bots: alta idempotente con la clave de servicio. |
| `src/bot.ts` | Un bot: su sesión y sus llamadas, como un cliente cualquiera. |
| `src/supervisor.ts` | Conecta a los bots y levanta o retira agentes según lo que diga el servidor. |
| `src/agent.ts` | Un bot dentro de una partida. En MB2, su máquina de estados. |
| `test/fill.test.ts` | E2E: una partida con bots arranca con ellos y el supervisor se entera. |
