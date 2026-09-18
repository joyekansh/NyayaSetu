from collections.abc import Generator

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.config import Settings, get_settings


def create_engine_from_settings(settings: Settings) -> Engine:
    return create_engine(settings.database_url, pool_pre_ping=True)


def create_session_factory(settings: Settings | None = None) -> sessionmaker[Session]:
    active_settings = settings or get_settings()
    return sessionmaker(bind=create_engine_from_settings(active_settings), autoflush=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    session = create_session_factory()()
    try:
        yield session
    finally:
        session.close()
