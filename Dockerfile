# Container image of the API service (api/), built from the repository root.
#
# Why it lives here and not in api/: Railway builds a service from its root
# directory, which defaults to the repository root. Finding a Dockerfile there,
# it builds this image; finding none, it falls back to autodetection, sees the
# npm workspace in package.json, looks for a Node start command and fails.
# Keep the service's Root Directory empty so this file is the one that is found.
FROM python:3.12-slim

WORKDIR /srv
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

COPY api/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY api/rithmos_api ./rithmos_api
COPY api/schema ./schema

# Railway injects PORT; the default keeps `docker run` and compose working.
ENV PORT=8000
EXPOSE 8000

# Migrations run before the server, so a fresh database is ready on first boot.
CMD ["sh", "-c", "python -m rithmos_api.migrate && exec uvicorn rithmos_api.main:app --host 0.0.0.0 --port ${PORT}"]
