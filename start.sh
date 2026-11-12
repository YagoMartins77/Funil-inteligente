#!/usr/bin/env bash
set -euo pipefail

echo "Iniciando Funil-Inteligente FASTCAR..."
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Arquivo .env criado a partir de .env.example"
fi

docker compose up -d --build
echo "Sistema disponível:"
echo "  - Orçamentador Tablet: http://localhost:5173/orcamentador"
echo "  - Dashboard Gerencial: http://localhost:5173/dashboard"
echo "  - API REST v1:         http://localhost:3001/api/v1"
echo "  - Swagger Docs:        http://localhost:3001/api/docs"
