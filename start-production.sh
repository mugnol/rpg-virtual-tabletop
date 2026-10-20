#!/bin/bash
# Production deploy for rpg-virtual-tabletop.
# Executed automatically by the devbox entrypoint (server-docker-boostrap-agy)
# on every container start — no agent required.
# Idempotent: safe to re-run on container restarts and fresh droplets.
set -euo pipefail
cd "$(dirname "$0")"

export NODE_ENV=production
export PORT=3001

# --- Secrets / database (persisted in the devbox-projects volume) ---
# Priority: container env > existing .env > generate once and persist.
if [ -z "${JWT_SECRET:-}" ]; then
  if [ -f .env ] && grep -q '^JWT_SECRET=' .env; then
    export JWT_SECRET="$(grep '^JWT_SECRET=' .env | cut -d= -f2-)"
  else
    export JWT_SECRET="$(openssl rand -hex 32)"
    printf 'JWT_SECRET=%s\nDATABASE_URL=file:./prod.db\n' "$JWT_SECRET" >> .env
    echo "Generated new JWT_SECRET into .env"
  fi
fi
export DATABASE_URL="${DATABASE_URL:-file:./prod.db}"

# --- Deploy ---
npm install --include=dev   # NODE_ENV=production is set, force devDeps for build
npm run build        # tsc + vite build
npm run db:push      # ensure schema (no-op after first run)
npm run db:seed      # seed built-in systems/themes (idempotent upserts)

# --- (Re)start ---
pkill -f 'node server/dist/index.js' 2>/dev/null || true
sleep 1
nohup npm start > /home/dev/projects/vtt-production.log 2>&1 &

echo "rpg-virtual-tabletop deployed on :3001 (log: ~/projects/vtt-production.log)"
