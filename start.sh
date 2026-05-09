#!/bin/bash
# PACQ App — Start Script
# Starts both backend (port 3001) and frontend (port 3000) concurrently.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Check if node_modules exist
if [ ! -d "$SCRIPT_DIR/server/node_modules" ] || [ ! -d "$SCRIPT_DIR/client/node_modules" ]; then
  echo "Dependencies not installed. Running setup first..."
  bash "$SCRIPT_DIR/setup.sh"
fi

echo "Starting PACQ App..."
echo "  Backend:  http://localhost:3001"
echo "  Frontend: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop"
echo ""

# Start both processes
(cd "$SCRIPT_DIR/server" && node index.js) &
SERVER_PID=$!

(cd "$SCRIPT_DIR/client" && npx vite --port 3000) &
CLIENT_PID=$!

# Wait for both
trap "kill $SERVER_PID $CLIENT_PID 2>/dev/null; exit" INT TERM
wait
