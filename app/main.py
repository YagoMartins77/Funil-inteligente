"""API do Funil Inteligente.

Executar:  uvicorn app.main:app --reload
Docs interativas (Swagger): http://localhost:8000/docs
"""
import csv
import io
from contextlib import asynccontextmanager
from typing import Literal

from fastapi import Depends, FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select
from sqlalchemy.orm import Session

from .analytics import agora_utc, analisar_funil, resultado_efetivo
from .config import CORS_ORIGENS, FRONTEND, JANELA_PADRAO, K_DESVIOS, PERMITIR_ADMIN
from .db import get_db, inicializar_banco
from .models import Etapa
from .schemas import VisitaIn
from .servicos import EtapaDesconhecida, carregar_visitas, registrar_visita, resetar_dados
from .simulacao import gerar_e_inserir


@asynccontextmanager
async def lifespan(_app: FastAPI):
    inicializar_banco()
    yield


app = FastAPI(
    title="Funil Inteligente - API de telemetria",
    description="Recebe o tempo gasto em cada etapa de um fluxo web e calcula funil, "
                "abandono e anomalias temporais (média, mediana, desvio-padrão).",
    version="1.0.0",
    lifespan=lifespan,
)
app.add_middleware(CORSMiddleware, allow_origins=CORS_ORIGENS, allow_methods=["GET", "POST", "DELETE"],
                   allow_headers=["*"])


def _exigir_admin() -> None:
    if not PERMITIR_ADMIN:
        raise HTTPException(status_code=403, detail="Operações administrativas desativadas (FUNIL_PERMITIR_ADMIN=0).")


# ----------------------------------------------------------------------------- telemetria
@app.post("/api/v1/telemetria/visitas", status_code=202, tags=["telemetria"])
def receber_visita(dados: VisitaIn, db: Session = Depends(get_db)):
    """Recebe (ou atualiza) a visita a uma etapa. Idempotente por `visita_id`."""
    try:
        registrar_visita(db, dados)
    except EtapaDesconhecida as exc:
        raise HTTPException(status_code=422, detail=f"Etapa desconhecida: {exc}") from exc
    return {"ok": True}


@app.get("/api/v1/etapas", tags=["telemetria"])
def listar_etapas(db: Session = Depends(get_db)):
    etapas = db.scalars(select(Etapa).order_by(Etapa.ordem))
    return [{"ordem": e.ordem, "slug": e.slug, "nome": e.nome} for e in etapas]


@app.get("/api/v1/saude", tags=["telemetria"])
def saude():
    return {"status": "ok"}


# ----------------------------------------------------------------------------- análise
@app.get("/api/v1/analytics/funil", tags=["analytics"])
def funil(
    janela: int = Query(JANELA_PADRAO, ge=0, le=100_000, description="Nº de sessões recentes comparadas ao histórico"),
    k: float = Query(K_DESVIOS, gt=0, le=10, description="Nº de desvios-padrão do limiar de anomalia"),
    sinteticas: bool = Query(True, description="Incluir sessões sintéticas (simulação)"),
    cenario: str | None = Query(None, max_length=40),
    db: Session = Depends(get_db),
):
    """Funil, abandono, estatística por etapa, anomalias, relação tempo × abandono e overhead."""
    visitas = carregar_visitas(db, incluir_sinteticas=sinteticas, cenario=cenario)
    return analisar_funil(visitas, janela=janela, k=k)


@app.get("/api/v1/analytics/exportar.csv", tags=["analytics"])
def exportar_csv(sinteticas: bool = True, db: Session = Depends(get_db)):
    """Dataset de visitas (uma linha por visita a etapa), pronto para a etapa de Machine Learning."""
    visitas = carregar_visitas(db, incluir_sinteticas=sinteticas)
    agora = agora_utc()
    saida = io.StringIO()
    w = csv.writer(saida)
    w.writerow(["sessao_id", "etapa", "ordem", "iniciada_em", "hora_do_dia", "tempo_total_ms",
                "tempo_ativo_ms", "tempo_ocioso_ms", "tempo_oculto_ms", "resultado",
                "resultado_efetivo", "dispositivo", "cenario", "sintetica", "overhead_ms"])
    for v in visitas:
        w.writerow([v.sessao_id, v.etapa, v.ordem, v.iniciada_em.isoformat(), v.iniciada_em.hour,
                    v.tempo_total_ms, v.tempo_ativo_ms, v.tempo_ocioso_ms, v.tempo_oculto_ms,
                    v.resultado, resultado_efetivo(v, agora), v.dispositivo, v.cenario or "",
                    int(v.sintetica), "" if v.overhead_ms is None else v.overhead_ms])
    return Response(content=saida.getvalue(), media_type="text/csv; charset=utf-8",
                    headers={"Content-Disposition": 'attachment; filename="visitas_funil.csv"'})


# ----------------------------------------------------------------------------- administração
@app.post("/api/v1/admin/simular", tags=["admin"], dependencies=[Depends(_exigir_admin)])
def simular(
    total: int = Query(100, ge=10, le=2000),
    lentas: int = Query(20, ge=0, le=2000),
    semente: int = Query(42),
    limpar: bool = Query(True, description="Apagar antes as sessões sintéticas existentes"),
    db: Session = Depends(get_db),
):
    """Gera sessões de teste: `total - lentas` padrão e `lentas` com lentidão na etapa 2."""
    if lentas > total:
        raise HTTPException(status_code=422, detail="`lentas` não pode ser maior que `total`.")
    return gerar_e_inserir(db, total=total, lentas=lentas, semente=semente, limpar=limpar)


@app.delete("/api/v1/admin/dados", tags=["admin"], dependencies=[Depends(_exigir_admin)])
def apagar_dados(escopo: Literal["sinteticos", "tudo"] = "sinteticos", db: Session = Depends(get_db)):
    return {"visitas_removidas": resetar_dados(db, escopo)}


# ----------------------------------------------------------------------------- front-end estático
@app.get("/", include_in_schema=False)
def raiz():
    return FileResponse(FRONTEND / "index.html")


for _rota, _pasta in (("/tracker", "tracker"), ("/loja", "loja"), ("/dashboard", "dashboard")):
    if (FRONTEND / _pasta).is_dir():
        app.mount(_rota, StaticFiles(directory=FRONTEND / _pasta, html=True), name=_pasta)
