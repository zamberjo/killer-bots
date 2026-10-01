# CLAUDE.md

Las reglas del proyecto están en `../AGENTS.md` y mandan sobre este fichero; la
decisión que define este repositorio es el ADR 0010 (`../docs/adr/0010-bots.md`).

- **El servidor decide quién juega.** Este programa nunca mete a un bot en una
  partida ni cambia estado de juego con la clave de servicio: esa clave solo
  da de alta cuentas (`src/pool.ts`). Todo lo demás, con la sesión del bot.
- **Ninguna geometría en TypeScript** (`../AGENTS.md` §3). Cuando los bots
  anden (MB2), la siguiente posición la da PostGIS (`sim.step`).
- **Tests e2e contra el Supabase local**, sin mocks (`../AGENTS.md` §6). La
  clave de servicio solo prepara y limpia; ninguna aserción se hace con ella.
- Identificadores y comentarios en inglés salvo los comentarios explicativos,
  que van en español como en el resto del proyecto. Conventional Commits con
  ámbito de módulo (`feat(supervisor):`, `fix(pool):`).

```bash
npm ci && npm run typecheck && npm test   # requiere `supabase start` en ../backend
```
