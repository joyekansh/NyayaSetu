FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

RUN groupadd --gid 10001 app && useradd --uid 10001 --gid app --create-home --shell /usr/sbin/nologin app

COPY backend/requirements.txt ./requirements.txt
RUN pip install -r requirements.txt

COPY --chown=app:app backend/ ./

USER app

# Replace this placeholder with the task-runner command when worker code is added.
CMD ["sh", "-c", "trap 'exit 0' TERM INT; sleep infinity & wait"]
