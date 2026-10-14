#!/usr/bin/env bash
# El CI de este repositorio, en local (docs/adr/0017).
#
#   scripts/ci.sh fast   # pre-commit: tipos y capas
#   scripts/ci.sh full   # pre-push: lo mismo que .github/workflows/ci.yml
#
# `full` añade el e2e contra el Supabase local de ../backend (ya levantado, con
# las migraciones aplicadas). Comprueba el árbol de trabajo.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

mode="${1:-full}"
step() { printf '\n── %s\n' "$*"; }

[[ -d node_modules ]] || npm ci

step "Tipos"
npm run typecheck

step "Capas (hexagonal)"
npm run lint:arch

[[ "$mode" == "fast" ]] && exit 0

step "Supabase local"
if ! (cd ../backend && supabase status > /dev/null 2>&1); then
  echo "Supabase local no está arrancado: cd ../backend && supabase start" >&2
  exit 1
fi

step "E2E"
npm test
