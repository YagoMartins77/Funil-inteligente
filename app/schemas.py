from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, field_validator

from .config import ETAPAS


class VisitaIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    visita_id: str
    sessao_id: str
    etapa: str
    ordem: int
    iniciada_em: datetime | None = None
    atualizada_em: datetime | None = None
    tempo_total_ms: int = 0
    tempo_ativo_ms: int = 0
    tempo_ocioso_ms: int = 0
    tempo_oculto_ms: int = 0
    resultado: Literal["avancou", "concluiu", "abandonou", "em_andamento"] = "em_andamento"
    dispositivo: str = "desktop"
    cenario: str | None = None
    sintetica: bool = False
    overhead_ms: float | None = None

    @field_validator("etapa")
    @classmethod
    def etapa_valida(cls, valor: str) -> str:
        etapas_validas = {slug for _, slug, _ in ETAPAS}
        if valor not in etapas_validas:
            raise ValueError(f"Etapa desconhecida: {valor}")
        return valor

    @field_validator("ordem")
    @classmethod
    def ordem_valida(cls, valor: int) -> int:
        if valor < 1 or valor > 4:
            raise ValueError("A ordem da etapa deve estar entre 1 e 4.")
        return valor
