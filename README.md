# Funil-Inteligente — FASTCAR

Sistema web completo de telemetria presencial para orçamentação automotiva em **5 etapas**, desenvolvido para o centro automotivo **FASTCAR** (Projeto Integrador de Sistemas Inteligentes III — Fatec Pompeia).

## Arquitetura

- **Backend:** Node.js 22 + TypeScript + Express + Zod (validação estrita LGPD) + Prisma ORM + Swagger/OpenAPI
- **Frontend:** React 19 + TypeScript + Vite (Orçamentador Tablet + Dashboard Gerencial)
- **Banco de Dados:** PostgreSQL 16 (modelo relacional normalizado, migrations versionadas e seeds)
- **Infraestrutura:** Docker Compose (`db`, `backend`, `frontend`)

## Fluxo Presencial FASTCAR (5 Etapas)

1. **Acolhimento** (`acolhimento`) — Recepção no balcão e identificação da demanda
2. **Diagnóstico Técnico** (`diagnostico`) — Avaliação de compatibilidade no veículo
3. **Cotação e Estoque** (`cotacao`) — Verificação de peças, valores e prazos
4. **Apresentação do Orçamento** (`apresentacao`) — Exposição das opções e condições
5. **Fechamento** (`fechamento`) — Decisão final e registro do desfecho padronizado

## Execução com Docker Compose (Recomendado)

```bash
cp .env.example .env
docker compose up -d --build
```

Acesse:
- **Orçamentador Tablet:** `http://localhost:5173/orcamentador`
- **Dashboard Gerencial:** `http://localhost:5173/dashboard`
- **Swagger / OpenAPI:** `http://localhost:3001/api/docs`
- **API REST v1:** `http://localhost:3001/api/v1/saude`

## Execução em Desenvolvimento (Local)

### 1. Banco de Dados PostgreSQL
```bash
docker compose up -d db
```

### 2. Backend
```bash
cd backend
npm install
npx prisma generate
npx prisma migrate deploy
npm run prisma:seed
npm run dev
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```

## Testes Automatizados

### Backend (Vitest + Supertest — CT-01 a CT-14 e RNF01)
```bash
cd backend
npm test
```

### Frontend (Vitest + Testing Library)
```bash
cd frontend
npm test
```

## Principais Endpoints (`/api/v1`)

| Grupo | Rota | Descrição |
|---|---|---|
| Saúde | `GET /api/v1/saude` | Status da API |
| Etapas | `GET /api/v1/etapas` | Lista as 5 etapas da FASTCAR |
| Atendimentos | `POST /api/v1/atendimentos` | Inicia atendimento anônimo (ID numérico) |
| Atendimentos | `GET /api/v1/atendimentos` | Listagem paginada com filtros e segregação |
| Atendimentos | `GET /api/v1/atendimentos/:id` | Detalhes temporais do atendimento |
| Atendimentos | `PATCH /api/v1/atendimentos/:id` | Atualiza estado permitido |
| Atendimentos | `POST /api/v1/atendimentos/:id/finalizar` | Finaliza atendimento |
| Telemetria | `POST /api/v1/telemetria/visitas` | Ingestão idempotente por `visitaId` (`sendBeacon` compatível) |
| Telemetria | `POST /api/v1/telemetria/eventos` | Ingestão idempotente por `eventoId` |
| Pausas | `POST /api/v1/atendimentos/:id/pausas/iniciar` | Inicia pausa operacional com motivo fechado |
| Pausas | `POST /api/v1/atendimentos/:id/pausas/finalizar` | Finaliza pausa operacional |
| Oficina | `POST /api/v1/atendimentos/:id/espera-oficina/iniciar` | Inicia espera técnica da oficina |
| Oficina | `POST /api/v1/atendimentos/:id/espera-oficina/finalizar` | Finaliza espera técnica da oficina |
| Desfechos | `POST /api/v1/atendimentos/:id/desfecho` | Registra desfecho e motivo fechado (LGPD) |
| Analytics | `GET /api/v1/analytics/funil` | Funil completo, tempos, anomalias e motivos |
| Analytics | `GET /api/v1/analytics/exportar.csv` | Exportação CSV anonimizada |
| Simulação | `POST /api/v1/admin/simular` | Gera sessões sintéticas e calcula precisão/revocação |
| Admin | `DELETE /api/v1/admin/dados?escopo=sinteticos` | Remove apenas dados sintéticos |

## LGPD e Privacidade (Privacy by Design)

- Zero campos de identificação pessoal (sem nome, CPF, telefone, e-mail ou placa).
- Rejeição estrita de campos extras na API (`HTTP 422` via Zod `.strict()`).
- Segregação lógica obrigatória via campo booleano `sintetica` (`true` vs `false`).
- Operações administrativas protegidas por `FUNIL_PERMITIR_ADMIN` e `FUNIL_ADMIN_TOKEN`.
