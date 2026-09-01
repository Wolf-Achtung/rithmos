#!/usr/bin/env bash
# Dump the Rithmos database to infra/dumps/<timestamp>.sql.gz.
# Requires DATABASE_URL in the environment (see .env.example) and pg_dump on PATH.
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL is not set}"
dir="$(cd "$(dirname "$0")" && pwd)/dumps"
mkdir -p "$dir"
out="$dir/$(date -u +%Y%m%dT%H%M%SZ).sql.gz"
pg_dump --no-owner --no-privileges "$DATABASE_URL" | gzip > "$out"
echo "$out"
