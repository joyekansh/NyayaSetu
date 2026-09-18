from sqlalchemy import text


def test_session_factory_uses_configured_database_url() -> None:
    from app.config import Settings
    from app.db import create_engine_from_settings

    engine = create_engine_from_settings(Settings(database_url="sqlite://"))

    with engine.connect() as connection:
        assert connection.execute(text("SELECT 1")).scalar_one() == 1
