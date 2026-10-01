# CLAUDE.md

Las reglas del proyecto están en `../AGENTS.md` y mandan sobre este fichero; la
decisión que define este repositorio es el ADR 0010 (`../docs/adr/0010-bots.md`).

- **El servidor decide quién juega.** Este programa nunca mete a un bot en una
  partida ni cambia estado de juego con la clave de servicio: esa clave solo
  da de alta cuentas (`src/pool.ts`). Todo lo demás, con la sesión del bot.
- **Ninguna geometría en TypeScript** (`../AGENTS.md` §3). El siguiente paso
  de cada bot y el ruido de su GPS los da PostGIS (`sim_step`); aquí solo se
  decide *qué* hace el bot (`domain/routine.ts`), nunca *dónde* acaba.
- **Tests e2e contra el Supabase local**, sin mocks (`../AGENTS.md` §6). La
  clave de servicio solo prepara y limpia; ninguna aserción se hace con ella.
- Identificadores y comentarios en inglés salvo los comentarios explicativos,
  que van en español como en el resto del proyecto. Conventional Commits con
  ámbito de módulo (`feat(supervisor):`, `fix(pool):`).

## Capas

Arquitectura hexagonal (ver `README.md`, «Estructura»):

- `src/domain/` — TypeScript puro. Sin paquetes, sin `node:*`.
- `src/application/` — casos de uso y los **puertos** (`ports.ts`). Solo
  importa `domain/`. Un caso de uso nuevo pide lo que necesita como puerto;
  nunca un cliente de Supabase.
- `src/infrastructure/` — los adaptadores. La traducción del contrato RPC
  (`docs/rpc-contract.md`) al dominio vive aquí y solo aquí.
- `src/composition.ts` — el único sitio que conecta adaptadores y casos de uso.

`npm run lint:arch` lo vigila.

```bash
./bots.sh check && ./bots.sh test   # en Docker, sin Node; requiere `supabase start` en ../backend
npm ci && npm run typecheck && npm run lint:arch && npm test   # lo mismo con Node instalado
```

En Docker (`compose.yaml`), el contenedor se une a la red
`supabase_network_<project_id>` y habla con `supabase_kong_<project_id>:8000`;
las claves las exporta `bots.sh` desde `supabase status`.
