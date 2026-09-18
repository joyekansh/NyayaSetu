from celery import Celery

from app.config import Settings, get_settings


def create_celery_app(settings: Settings | None = None) -> Celery:
    resolved = settings or get_settings()
    celery = Celery("nyayasetu", broker=resolved.redis_url, backend=resolved.redis_url)
    celery.conf.update(task_track_started=True, task_serializer="json", result_serializer="json", accept_content=["json"])
    return celery


celery_app = create_celery_app()

