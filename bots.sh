#!/usr/bin/env bash
# El simulador en Docker, sin instalar Node.
#
#   ./bots.sh [--linked] up        # bots conectados, en segundo plano
#   ./bots.sh [--linked] logs      # sus logs (Ctrl+C para salir)
#   ./bots.sh [--linked] down      # pararlos
#   ./bots.sh [--linked] pool [N]  # dar de alta los bots que falten y salir
#   ./bots.sh test                 # e2e contra el Supabase local
#   ./bots.sh check                # tipos y capas (lo que exige el CI)
#
# Sin --linked: contra el Supabase LOCAL (`supabase start` en ../backend).
# Con --linked: contra el proyecto enlazado con `supabase link` en ../backend.
#
# Las claves se leen de la CLI de Supabase y pasan al contenedor por entorno:
# no se escriben en ningún fichero. Lo único que se guarda es, en remoto, el
# secreto del que se derivan las contraseñas de los bots (.env.linked, fuera de
# git): tiene que ser siempre el mismo, o los bots ya creados no podrán entrar.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="${BACKEND_DIR:-$HERE/../backend}"
cd "$HERE"

linked=false
if [[ "${1:-}" == "--linked" ]]; then
  linked=true
  shift
fi
cmd="${1:-up}"
shift || true

if $linked; then
  case "$cmd" in
    test|check)
      echo "'$cmd' solo se ejecuta en local: los e2e borran usuarios y adelantan ventanas." >&2
      exit 2 ;;
  esac

  ref_file="$BACKEND/supabase/.temp/project-ref"
  if [[ ! -s "$ref_file" ]]; then
    echo "No hay proyecto enlazado. Ejecuta:  cd $BACKEND && supabase link --project-ref <ref>" >&2
    exit 1
  fi
  ref="$(cat "$ref_file")"

  keys="$(cd "$BACKEND" && supabase projects api-keys --project-ref "$ref" --reveal -o json 2>/dev/null)" || {
    echo "No se pudieron leer las claves de $ref. ¿Has hecho 'supabase login'?" >&2
    exit 1
  }
  pick() { # pick <tipo>: la clave de ese tipo (publishable | secret)
    if command -v jq > /dev/null; then
      jq -r --arg t "$1" 'map(select(.type == $t)) | .[0].api_key // empty' <<<"$keys"
    else
      python3 -c 'import json,sys; ks=[k for k in json.load(sys.stdin) if k.get("type")==sys.argv[1]]; print(ks[0]["api_key"] if ks else "")' "$1" <<<"$keys"
    fi
  }
  export SUPABASE_URL="https://$ref.supabase.co"
  SUPABASE_PUBLISHABLE_KEY="$(pick publishable)"
  SUPABASE_SECRET_KEY="$(pick secret)"
  if [[ -z "$SUPABASE_PUBLISHABLE_KEY" || -z "$SUPABASE_SECRET_KEY" ]]; then
    echo "El proyecto $ref no tiene claves publishable y secret (Settings → API Keys)." >&2
    exit 1
  fi
  export SUPABASE_PUBLISHABLE_KEY SUPABASE_SECRET_KEY

  # El secreto de las contraseñas de los bots: se genera una vez y se conserva.
  if [[ ! -s .env.linked ]]; then
    umask 077
    printf 'BOTS_SECRET=%s\n' "$(head -c 32 /dev/urandom | base64 | tr -d '/+=\n')" > .env.linked
    echo "Generado .env.linked con el secreto de los bots de $ref. Consérvalo." >&2
  fi
  export BOTS_SECRET="$(sed -n 's/^BOTS_SECRET=//p' .env.linked)"

  compose=(docker compose -p killer-bots-linked -f compose.yaml)
  echo "→ proyecto enlazado $ref" >&2
else
  if ! status=$(cd "$BACKEND" && supabase status -o env 2>/dev/null); then
    echo "Supabase local no está arrancado. Ejecuta:  cd $BACKEND && supabase start" >&2
    exit 1
  fi
  eval "$(grep -E '^(PUBLISHABLE_KEY|SECRET_KEY)=' <<<"$status")"
  export SUPABASE_URL="local" SUPABASE_PUBLISHABLE_KEY="$PUBLISHABLE_KEY" SUPABASE_SECRET_KEY="$SECRET_KEY"
  # En local vale un secreto fijo: las cuentas de una base local no protegen
  # nada, y así coincide con el de `npm start` fuera de Docker.
  export BOTS_SECRET="${BOTS_SECRET:-killer-bots-local-only}"
  SUPABASE_PROJECT="$(sed -nE 's/^project_id *= *"([^"]+)".*/\1/p' "$BACKEND/supabase/config.toml")"
  export SUPABASE_PROJECT
  compose=(docker compose -f compose.yaml -f compose.local.yaml)
fi

case "$cmd" in
  up)    "${compose[@]}" up -d --build bots ;;
  logs)  "${compose[@]}" logs -f bots ;;
  down)  "${compose[@]}" down ;;
  pool)  "${compose[@]}" run --rm --build tools npm run pool -- "$@" ;;
  test)  "${compose[@]}" run --rm --build tools npm test ;;
  check) "${compose[@]}" run --rm --build tools sh -c 'npm run typecheck && npm run lint:arch' ;;
  *)     sed -n '2,12p' "$0"; exit 2 ;;
esac
