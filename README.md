# Funil Inteligente

Projeto Integrador de Sistemas Inteligentes III (Fatec Pompeia, equipe 5, "Process Mining").
Mede o **tempo ativo em cada etapa** de um fluxo web de 4 etapas (Identificação, Dados de Entrega,
Pagamento, Confirmação), calcula funil, abandono e anomalias temporais e exibe tudo em um dashboard.

Escopo desta entrega: banco de dados, API (back-end), loja demo com script de rastreamento, dashboard e
simulação para validação. O módulo de Machine Learning **não** está implementado (veja o fim deste arquivo).

## Como rodar

```bash
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Abra `http://localhost:8000/`. Os dados ficam em `funil.db` (SQLite). Para usar PostgreSQL:

```bash
docker compose up -d
export DATABASE_URL=postgresql+psycopg://funil:funil@localhost:5432/funil
pip install "psycopg[binary]"
```

| Endereço | O que é |
|---|---|
| `/` | Página inicial |
| `/loja/etapa1-identificacao.html` | Fluxo simulado de 4 etapas, com o tracker |
| `/dashboard/` | Dashboard (funil, abandono, tempo, anomalias) |
| `/docs` | Documentação interativa da API (Swagger) |

Teste rápido: clique em **Gerar 100 sessões de teste** no dashboard (ou rode `python scripts/simular_sessoes.py`).

## Estrutura

```
app/            API (FastAPI + SQLAlchemy)
  analytics.py    regras estatísticas (funções puras)
  simulacao.py    gerador das 100 sessões de validação
  servicos.py     gravação idempotente e consultas
db/schema.sql   DDL PostgreSQL normalizado + view de resumo
frontend/
  tracker/        funil-tracker.js (JS nativo, sem dependências)
  loja/           4 etapas do checkout simulado
  dashboard/      painel em JS puro + SVG
scripts/simular_sessoes.py   gera e confere a validação do gargalo induzido
tests/          pytest (analítica e API) e tracker_test.js (Node)
```

Banco: `etapas` 1──N `visitas_etapa` N──1 `sessoes`. Nenhuma coluna guarda conteúdo digitado.

## API

| Método e rota | Função |
|---|---|
| `POST /api/v1/telemetria/visitas` | Recebe (ou atualiza) uma visita a uma etapa. Idempotente por `visita_id` |
| `GET /api/v1/etapas` | Lista as etapas |
| `GET /api/v1/analytics/funil?janela=20&k=2&sinteticas=true` | Funil, abandono, média, mediana, desvio, anomalias, tempo × abandono e overhead |
| `GET /api/v1/analytics/exportar.csv` | Dataset de visitas (insumo do Machine Learning) |
| `POST /api/v1/admin/simular?total=100&lentas=20` | Gera sessões sintéticas |
| `DELETE /api/v1/admin/dados?escopo=sinteticos` | Apaga dados (`tudo` apaga também os reais) |

Os endpoints `/admin` podem ser desligados com `FUNIL_PERMITIR_ADMIN=0`. O contrato rejeita (422) qualquer
campo fora do esperado, o que impede o envio acidental de conteúdo digitado.

## Como o tempo é medido (tracker)

```html
<script src="/tracker/funil-tracker.js" data-etapa="dados-entrega" defer></script>
<!-- última etapa: acrescente data-final="true" -->
```

Depois de validar o formulário, chame `FunilTracker.avancar()` antes de navegar.

- **Início:** `DOMContentLoaded`. **Fim:** `avancar()` (transição bem-sucedida) ou `pagehide`.
- **Segundo plano:** Page Visibility API. O tempo com a aba escondida vai para `oculto`.
- **Ociosidade:** sem `mousemove`, `keydown`, `scroll` ou toque por mais de 30 s, o **excedente** vai para `ocioso`
  (os primeiros 30 s contam como leitura). Configurável em `data-idle-ms`.
- **Tempo ativo** = total − oculto − ocioso. É a métrica usada em todo o dashboard.
- Envia por `sendBeacon` (com `fetch keepalive` de reserva): entrada, parcial ao esconder a aba e final.
  Visitas `em_andamento` sem atualização por 30 min passam a contar como abandono.

## Regra de anomalia

Uma etapa é sinalizada quando a **média do tempo ativo da janela recente** (as N sessões mais recentes,
padrão 20) é **maior que a mediana histórica + 2 desvios-padrão** (histórico = todas as sessões anteriores,
desvio-padrão amostral). Exige 10 visitas históricas e 3 recentes por etapa. Ajuste a janela no dashboard.

## Validação (seção 8 da Proposta Individual)

1. **Gargalo induzido:** `python scripts/simular_sessoes.py` (ou `--url http://localhost:8000` para enviar
   pela API). Gera 80 sessões padrão e 20 com lentidão na etapa 2 e imprime precisão e revocação.
   Também dá para fazer manualmente: marque "Injetar lentidão" no painel de teste da loja e percorra o fluxo.
   As sessões lentas vêm por último, como uma regressão de desempenho publicada depois de um período normal.
2. **Overhead < 50 ms** (protocolo da proposta). O script se auto-mede (aparece no dashboard), mas a
   verificação oficial usa o Chrome DevTools:
   - Performance Profiler, CPU throttling 4x e rede Fast 3G;
   - Desktop (Linux/Debian) e emulação de Moto G (Android intermediário);
   - compare cada etapa da loja **com** e **sem** o script (`?funil=off` desativa o tracker);
   - repita ao menos 10 vezes por cenário e compare o tempo de script (média e p95).
3. **Tempo × abandono:** o dashboard mostra a taxa de abandono por faixa de tempo e a correlação de Pearson.

Limitação a registrar no relatório: tempo alto não prova que a interface causou a desistência, e pausas
reflexivas legítimas podem parecer lentidão.

## Testes

```bash
python -m pytest            # analítica, simulação e API
node tests/tracker_test.js  # tracker (DOM simulado, sem dependências)
```

## Próximo passo: Machine Learning (não implementado)

1. Exporte o dataset em `/api/v1/analytics/exportar.csv`.
2. Monte as variáveis: tempo ativo, ocioso e oculto, razão ativo/total, etapa, dispositivo, hora do dia e
   tempos das etapas anteriores da mesma sessão. O alvo é `resultado_efetivo == "abandonou"`.
3. Separe treino e teste **por tempo** (as sessões mais antigas treinam, as mais recentes testam).
4. Comece com uma baseline simples (regressão logística) e compare com árvores (Random Forest ou Gradient Boosting).
5. Avalie com ROC-AUC, precisão e revocação da classe "abandonou" e importância das variáveis.
6. Para detectar gargalos sem rótulo, teste Isolation Forest por etapa e compare com a regra estatística.
7. Salve o modelo (`joblib`) e exponha um endpoint `/api/v1/ml/prever`.

Dados sintéticos servem para montar o pipeline, mas não para concluir nada sobre comportamento real.
