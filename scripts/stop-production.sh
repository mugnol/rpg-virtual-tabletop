#!/usr/bin/env bash
# Stop the background production server and port 80 forwarder.

set -euo pipefail

cd "$(dirname "$0")/.."

PID_FILE="server.pid"
FORWARD_PID_FILE="forward80.pid"
TUNNEL_PID_FILE="tunnel.pid"

if [ -f "$TUNNEL_PID_FILE" ]; then
  TUN_PID=$(cat "$TUNNEL_PID_FILE" 2>/dev/null || true)
  if [ -n "$TUN_PID" ] && kill -0 "$TUN_PID" 2>/dev/null; then
    echo "Stopping tunnel ($TUN_PID)..."
    kill "$TUN_PID" 2>/dev/null || true
  fi
  rm -f "$TUNNEL_PID_FILE"
fi
pkill -f "scripts/tunnel.cjs" 2>/dev/null || true

if [ -f "$FORWARD_PID_FILE" ]; then
  FWD_PID=$(cat "$FORWARD_PID_FILE" 2>/dev/null || true)
  if [ -n "$FWD_PID" ] && sudo kill -0 "$FWD_PID" 2>/dev/null; then
    echo "Stopping port 80 forwarder ($FWD_PID)..."
    sudo kill "$FWD_PID" 2>/dev/null || true
  fi
  rm -f "$FORWARD_PID_FILE"
fi

if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE" 2>/dev/null || true)
  if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
    echo "Stopping server process ($PID)..."
    kill "$PID" 2>/dev/null || true
    for _ in $(seq 1 10); do
      if ! kill -0 "$PID" 2>/dev/null; then
        break
      fi
      sleep 1
    done
    if kill -0 "$PID" 2>/dev/null; then
      echo "Force killing server process ($PID)..."
      kill -9 "$PID" 2>/dev/null || true
    fi
    echo "Server stopped."
  else
    echo "Process $PID is not running."
  fi
  rm -f "$PID_FILE"
else
  echo "No server.pid file found."
fi
