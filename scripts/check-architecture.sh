#!/usr/bin/env bash
# Guardián de capas (CLAUDE.md, «Capas»). Falla si una capa importa de otra
# que no le toca:
#   domain/       solo de domain/
#   application/  de domain/ y application/
# Ni domain/ ni application/ importan paquetes (ni Supabase ni node:*).
set -euo pipefail
cd "$(dirname "$0")/.."

fail=0
check() {
  local layer=$1 allowed=$2
  while IFS= read -r line; do
    file=${line%%:*}
    spec=$(sed -E "s/.*from '([^']+)'.*/\1/" <<<"$line")
    if [[ ! $spec =~ ^\.\.?/ ]]; then
      echo "✗ $file importa el paquete '$spec': $layer/ no depende de nada de fuera"; fail=1; continue
    fi
    target=$(realpath -m --relative-to=src "$(dirname "$file")/$spec")
    if [[ ! $target =~ ^($allowed)/ ]]; then
      echo "✗ $file importa '$spec' ($target): $layer/ solo puede usar $allowed"; fail=1
    fi
  done < <(grep -rn --include='*.ts' -E "^\s*(import|export) .* from '" "src/$layer" | sed -E 's/^([^:]+):[0-9]+:/\1:/')
}

check domain 'domain'
check application 'domain|application'

if [[ $fail -eq 0 ]]; then echo "✓ capas en orden"; fi
exit $fail
