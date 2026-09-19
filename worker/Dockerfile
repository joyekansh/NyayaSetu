FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends tesseract-ocr && rm -rf /var/lib/apt/lists/*
RUN groupadd --gid 10001 app && useradd --uid 10001 --gid app --create-home --shell /usr/sbin/nologin app

COPY backend/requirements.txt ./requirements.txt
RUN pip install -r requirements.txt

COPY --chown=app:app backend/ ./

USER app

CMD ["celery", "-A", "app.celery_app", "worker", "--loglevel=info", "-Q", "documents,celery"]
