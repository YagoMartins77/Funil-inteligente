from __future__ import annotations

import random
from datetime import datetime, timedelta

from sqlalchemy import delete
from sqlalchemy.orm import Session

from .config import ETAPAS
from .models import Etapa, Visita


def gerar_e_inserir(db: Session, *, total: int = 100, lentas: int = 20, semente: int = 42,
                   limpar: bool = True) -> dict:
    rng = random.Random(semente)
    if limpar:
        db.execute(delete(Visita).where(Visita.sintetica.is_(True)))

    agora = datetime.utcnow()
    etapa_map = {slug: db.query(Etapa).filter_by(slug=slug).one().id for _, slug, _ in ETAPAS}
    registros: list[Visita] = []
    for idx in range(total):
        sessao_id = f"sim-{semente}-{idx+1}"
        etapa_extra = 0 if idx < total - lentas else 800  # gargalo artificial na etapa 2
        base = agora - timedelta(minutes=idx % 12)
        for ordem, slug, nome in ETAPAS:
            inicio = base + timedelta(seconds=ordem * 5)
            atual = inicio + timedelta(milliseconds=600 + rng.randint(200, 1200) + (800 if ordem == 2 and idx >= total - lentas else 0))
            resultado = "concluiu" if ordem == 4 else "avancou"
            visita_id = f"{sessao_id}:{slug}"
            registros.append(
                Visita(
                    visita_id=visita_id,
                    sessao_id=sessao_id,
                    etapa_id=etapa_map[slug],
                    etapa=slug,
                    ordem=ordem,
                    iniciada_em=inicio,
                    atualizada_em=atual,
                    tempo_total_ms=max(1, int((atual - inicio).total_seconds() * 1000)),
                    tempo_ativo_ms=max(1, int((atual - inicio).total_seconds() * 1000) - 150 - etapa_extra // 4),
                    tempo_ocioso_ms=80,
                    tempo_oculto_ms=0,
                    resultado=resultado,
                    overhead_ms=0.0,
                    dispositivo="desktop" if (idx % 2) == 0 else "mobile",
                    cenario="simulacao",
                    sintetica=True,
                )
            )
    db.add_all(registros)
    db.commit()
    return {"ok": True, "geradas": len(registros), "sessoes": total, "lentas": lentas}
