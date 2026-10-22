"""Conexão com o banco (SQLite por padrão; PostgreSQL via DATABASE_URL)."""
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from .config import DATABASE_URL, ETAPAS
from .models import Base, Etapa

_connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=_connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def inicializar_banco() -> None:
    """Cria as tabelas (se não existirem) e garante as 4 etapas do fluxo."""
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        existentes = {e.slug for e in db.scalars(select(Etapa))}
        for ordem, slug, nome in ETAPAS:
            if slug not in existentes:
                db.add(Etapa(ordem=ordem, slug=slug, nome=nome))
        db.commit()


def get_db():
    """Dependência do FastAPI: uma sessão de banco por requisição."""
    with SessionLocal() as db:
        yield db
