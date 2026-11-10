from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from .analytics import Visita as VisitaAnalitica
from .config import ETAPAS
from .models import Etapa, Visita
from .schemas import VisitaIn


class EtapaDesconhecida(ValueError):
    pass


def _etapa_valida(etapa_slug: str) -> str:
    slugs = {slug for _, slug, _ in ETAPAS}
    if etapa_slug not in slugs:
        raise EtapaDesconhecida(etapa_slug)
    return etapa_slug


def registrar_visita(db: Session, dados: VisitaIn) -> Visita:
    etapa_slug = _etapa_valida(dados.etapa)
    etapa_ref = db.scalar(select(Etapa).where(Etapa.slug == etapa_slug))
    agora = datetime.now(timezone.utc).replace(tzinfo=None)
    payload = {
        "visita_id": dados.visita_id,
        "sessao_id": dados.sessao_id,
        "etapa_id": etapa_ref.id if etapa_ref is not None else None,
        "etapa": etapa_slug,
        "ordem": dados.ordem,
        "iniciada_em": dados.iniciada_em or agora,
        "atualizada_em": dados.atualizada_em or agora,
        "tempo_total_ms": int(dados.tempo_total_ms),
        "tempo_ativo_ms": int(dados.tempo_ativo_ms),
        "tempo_ocioso_ms": int(dados.tempo_ocioso_ms),
        "tempo_oculto_ms": int(dados.tempo_oculto_ms),
        "resultado": dados.resultado,
        "overhead_ms": dados.overhead_ms,
        "dispositivo": dados.dispositivo,
        "cenario": dados.cenario,
        "sintetica": bool(dados.sintetica),
    }

    existente = db.scalar(select(Visita).where(Visita.visita_id == dados.visita_id))
    if existente is None:
        registro = Visita(**payload)
        db.add(registro)
    else:
        for campo, valor in payload.items():
            setattr(existente, campo, valor)
        db.add(existente)
    db.commit()
    return existente if existente is not None else db.scalar(select(Visita).where(Visita.visita_id == dados.visita_id))


def carregar_visitas(db: Session, incluir_sinteticas: bool = True, cenario: str | None = None) -> list[VisitaAnalitica]:
    stmt = select(Visita)
    if not incluir_sinteticas:
        stmt = stmt.where(Visita.sintetica.is_(False))
    if cenario is not None:
        stmt = stmt.where(Visita.cenario == cenario)
    stmt = stmt.order_by(Visita.iniciada_em.asc(), Visita.id.asc())

    resultados = db.scalars(stmt).all()
    return [
        VisitaAnalitica(
            sessao_id=r.sessao_id,
            etapa=r.etapa,
            ordem=r.ordem,
            iniciada_em=r.iniciada_em,
            atualizada_em=r.atualizada_em,
            tempo_total_ms=int(r.tempo_total_ms),
            tempo_ativo_ms=int(r.tempo_ativo_ms),
            tempo_ocioso_ms=int(r.tempo_ocioso_ms),
            tempo_oculto_ms=int(r.tempo_oculto_ms),
            resultado=r.resultado,
            overhead_ms=r.overhead_ms,
            dispositivo=r.dispositivo,
            cenario=r.cenario,
            sintetica=bool(r.sintetica),
        )
        for r in resultados
    ]


def resetar_dados(db: Session, escopo: str = "sinteticos") -> int:
    if escopo == "tudo":
        stmt = delete(Visita)
    else:
        stmt = delete(Visita).where(Visita.sintetica.is_(True))
    result = db.execute(stmt)
    db.commit()
    return int(result.rowcount or 0)
