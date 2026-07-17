FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/document-service \
    DOCUMENT_SERVICE_HOST=0.0.0.0 \
    DOCUMENT_SERVICE_PORT=8010 \
    DOCUMENT_STORAGE_TYPE=local \
    DOCUMENT_STORAGE_PATH=/var/lib/mikoton-document-service/storage \
    DOCUMENT_TEMP_PATH=/tmp/mikoton-document-service \
    LIBREOFFICE_BINARY=libreoffice \
    PDF_ENGINE=libreoffice \
    GENERATION_TIMEOUT_SECONDS=90

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
      libreoffice-calc \
      libreoffice-writer \
      fonts-dejavu \
      fonts-liberation \
      curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY document-service/requirements.txt /app/document-service/requirements.txt
RUN pip install --no-cache-dir -r /app/document-service/requirements.txt

COPY document-service /app/document-service
COPY templates /app/templates

RUN useradd --create-home --uid 10001 appuser \
    && mkdir -p /var/lib/mikoton-document-service/storage /tmp/mikoton-document-service \
    && chown -R appuser:appuser /var/lib/mikoton-document-service /tmp/mikoton-document-service /app

USER appuser

EXPOSE 8010

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8010/readyz >/dev/null || exit 1

CMD ["python", "-m", "mikoton_document_service.server"]
