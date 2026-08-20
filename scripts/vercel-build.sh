#!/usr/bin/env bash
set -euo pipefail

echo "[vercel-build] Starting Vercel build pipeline"

if [[ "${SKIP_DB_MIGRATION:-0}" == "1" ]]; then
  echo "[vercel-build] SKIP_DB_MIGRATION=1, skipping database migration"
else
  if [[ -z "${DATABASE_URL:-}" ]]; then
    echo "[vercel-build] ERROR: DATABASE_URL is not set"
    exit 1
  fi

  echo "[vercel-build] Running Drizzle migrations"
  npx drizzle-kit migrate

fi
