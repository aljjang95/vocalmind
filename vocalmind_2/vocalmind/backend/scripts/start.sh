#!/bin/bash
cd "$(dirname "$0")/.."
export CHROMA_DB_PATH="$HOME/Desktop/보컬커리큘럼/chroma_db"
uv run uvicorn main:app --host 0.0.0.0 --port 8001 --reload
