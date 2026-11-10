#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-8000}"
VENV_DIR="$ROOT_DIR/.venv"

if [[ ! -d "$VENV_DIR" ]]; then
  echo "[start] Criando ambiente virtual em $VENV_DIR"
  python3 -m venv "$VENV_DIR"
fi

source "$VENV_DIR/bin/activate"

echo "[start] Verificando dependências"
python -m pip install --upgrade pip >/dev/null
if [[ -f requirements.txt ]]; then
  python -m pip install -r requirements.txt
fi

echo "[start] Iniciando Funil Inteligente em http://$HOST:$PORT"
exec python -m uvicorn app.main:app --host "$HOST" --port "$PORT" --reload
