#!/usr/bin/env bash
# End-to-end acceptance test runner (Robot Framework against the real
# production-like build). Recreates a fresh SQLite database, builds client
# + server, starts the server on :3100, waits for health, runs robot.
#
# Prerequisites: npm install (root), python venv at .venv with
# e2e/requirements.txt installed and `rfbrowser init` done.
set -euo pipefail

cd "$(dirname "$0")/.."

export NODE_ENV=test
export PORT=3100
export BASE_URL="http://localhost:3100"
export DATABASE_URL="file:./e2e.db"
export JWT_SECRET="e2e-insecure-secret"

rm -f server/prisma/e2e.db server/prisma/e2e.db-journal
(cd server && npx prisma db push --skip-generate)

npm run build

node server/dist/index.js &
server_pid=$!
trap 'kill "${server_pid}" 2>/dev/null || true' EXIT

for _ in $(seq 1 60); do
  if curl -sf "${BASE_URL}/api/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! curl -sf "${BASE_URL}/api/health" >/dev/null 2>&1; then
  echo "E2E server did not become healthy on ${BASE_URL}" >&2
  exit 1
fi

# No `exec` here: it would replace the shell and the EXIT trap above would
# never kill the server. `set -e` propagates robot's exit code either way.
cd e2e
../.venv/bin/robot --outputdir output tests
