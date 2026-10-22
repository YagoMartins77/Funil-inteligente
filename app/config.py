"""Configuração central (valores lidos de variáveis de ambiente quando existirem)."""
import os
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
FRONTEND = RAIZ / "frontend"

DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{(RAIZ / 'funil.db').as_posix()}")
CORS_ORIGENS = [o.strip() for o in os.getenv("FUNIL_CORS_ORIGENS", "*").split(",") if o.strip()]
PERMITIR_ADMIN = os.getenv("FUNIL_PERMITIR_ADMIN", "1") == "1"

# Fluxo monitorado (Proposta Individual, seção 7): 4 etapas padronizadas.
ETAPAS = (
    (1, "identificacao", "Identificação / Login"),
    (2, "dados-entrega", "Dados de Entrega"),
    (3, "pagamento", "Seleção de Pagamento"),
    (4, "confirmacao", "Confirmação / Sucesso"),
)

# Regras analíticas (Proposta Individual, seções 2 e 8).
K_DESVIOS = 2.0                 # anomalia: média da janela > mediana histórica + K * desvio-padrão
JANELA_PADRAO = 20              # nº de sessões mais recentes comparadas ao histórico
MIN_BASELINE = 10               # mínimo de visitas históricas por etapa para comparar
MIN_JANELA = 3                  # mínimo de visitas na janela recente por etapa
LIMITE_OVERHEAD_MS = 50.0       # critério de sucesso: overhead de coleta < 50 ms
TIMEOUT_EM_ANDAMENTO_S = 30 * 60  # visita "em andamento" sem atualização vira abandono
