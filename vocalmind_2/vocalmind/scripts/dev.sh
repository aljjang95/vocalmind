#!/bin/bash
cd "$(dirname "$0")/.."

# 백엔드
(cd backend && bash scripts/start.sh) &
BACKEND_PID=$!

# 프론트엔드
npm run dev &
FRONTEND_PID=$!

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT
wait
