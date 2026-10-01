#!/usr/bin/env bash
# El simulador en Docker, sin instalar Node.
#
#   ./bots.sh up        # bots conectados, en segundo plano
#   ./bots.sh logs      # sus logs (Ctrl+C para salir)
#   ./bots.sh down      # pararlos
#   ./bots.sh pool [N]  # dar de alta los bots que falten y salir
#   ./bots.sh test      # e2e contra el Supabase local
#   ./bots.sh check     # tipos y capas (lo que exige el CI)
#
# Requiere Docker y el backend arrancado (`supabase start` en ../backend). Las
# claves se leen de `supabase status` y pasan al contenedor por entorno: no se
# escriben en ningún fichero.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="${BACKEND_DIR:-$HERE/../backend}"
cd "$HERE"

if ! status=$(cd "$BACKEND" && supabase status -o env 2>/dev/null); then
  echo "Supabase local no está arrancado. Ejecuta:  cd $BACKEND && supabase start" >&2
  exit 1
fi
eval "$(grep -E '^(PUBLISHABLE_KEY|SECRET_KEY)=' <<<"$status")"
export SUPABASE_PUBLISHABLE_KEY="$PUBLISHABLE_KEY" SUPABASE_SECRET_KEY="$SECRET_KEY"
SUPABASE_PROJECT="$(sed -nE 's/^project_id *= *"([^"]+)".*/\1/p' "$BACKEND/supabase/config.toml")"
export SUPABASE_PROJECT

cmd="${1:-up}"
shift || true
case "$cmd" in
  up)    docker compose up -d --build bots ;;
  logs)  docker compose logs -f bots ;;
  down)  docker compose down ;;
  pool)  docker compose run --rm --build tools npm run pool -- "$@" ;;
  test)  docker compose run --rm --build tools npm test ;;
  check) docker compose run --rm --build tools sh -c 'npm run typecheck && npm run lint:arch' ;;
  *)     sed -n '2,10p' "$0"; exit 2 ;;
esac
