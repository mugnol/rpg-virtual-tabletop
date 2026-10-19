#!/usr/bin/env bash
# Start the unified production server completely detached (no hanging pipes).
# Logs are written to /tmp/rpg-vtt.log and process ID is saved in server.pid.

set -euo pipefail

cd "$(dirname "$0")/.."

PID_FILE="server.pid"
LOG_FILE="/tmp/rpg-vtt.log"

if [ -f "$PID_FILE" ]; then
  OLD_PID=$(cat "$PID_FILE" 2>/dev/null || true)
  if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then
    echo "Stopping existing server process ($OLD_PID)..."
    kill "$OLD_PID" 2>/dev/null || true
    sleep 2
  fi
  rm -f "$PID_FILE"
fi

export NODE_ENV="production"
export PORT="${PORT:-3001}"
export HOST="${HOST:-0.0.0.0}"
export DATABASE_URL="${DATABASE_URL:-file:./prod.db}"
export JWT_SECRET="${JWT_SECRET:-prod-droplet-secret-key-2026-vtt-secure}"
export COOKIE_SECURE="${COOKIE_SECURE:-false}"

echo "Starting RPG Virtual Tabletop on ${HOST}:${PORT} (env: ${NODE_ENV})..."

nohup setsid env NODE_ENV="$NODE_ENV" PORT="$PORT" HOST="$HOST" DATABASE_URL="$DATABASE_URL" JWT_SECRET="$JWT_SECRET" COOKIE_SECURE="$COOKIE_SECURE" node server/dist/index.js > "$LOG_FILE" 2>&1 < /dev/null &
SERVER_PID=$!
echo "$SERVER_PID" > "$PID_FILE"

echo "Server started with PID ${SERVER_PID}. Waiting for health check..."

for i in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1; then
    echo "Server is healthy on http://${HOST}:${PORT} (PID ${SERVER_PID})!"
    exit 0
  fi
  sleep 1
done

echo "Error: Server failed to start or did not become healthy within 30 seconds." >&2
echo "Last 20 log lines from ${LOG_FILE}:" >&2
tail -n 20 "$LOG_FILE" >&2
exit 1
