from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Etapa(Base):
    __tablename__ = "etapas"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    ordem: Mapped[int] = mapped_column(Integer, nullable=False)
    slug: Mapped[str] = mapped_column(String(80), unique=True, nullable=False, index=True)
    nome: Mapped[str] = mapped_column(String(120), nullable=False)

    visitas: Mapped[list["Visita"]] = relationship(
        back_populates="etapa_rel",
        foreign_keys="[Visita.etapa_id]",
    )


class Visita(Base):
    __tablename__ = "visitas"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    visita_id: Mapped[str] = mapped_column(String(120), unique=True, nullable=False, index=True)
    sessao_id: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    etapa_id: Mapped[int | None] = mapped_column(ForeignKey("etapas.id"), nullable=True, index=True)
    etapa: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    ordem: Mapped[int] = mapped_column(Integer, nullable=False)
    iniciada_em: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    atualizada_em: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    tempo_total_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    tempo_ativo_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    tempo_ocioso_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    tempo_oculto_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    resultado: Mapped[str] = mapped_column(String(32), nullable=False, default="em_andamento")
    overhead_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    dispositivo: Mapped[str] = mapped_column(String(40), nullable=False, default="desktop")
    cenario: Mapped[str | None] = mapped_column(String(80), nullable=True, default=None)
    sintetica: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    etapa_rel: Mapped[Etapa | None] = relationship(
        back_populates="visitas",
        foreign_keys=[etapa_id],
    )
