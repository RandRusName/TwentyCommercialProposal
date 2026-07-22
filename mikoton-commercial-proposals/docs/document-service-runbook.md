# Document Service Runbook

## Production Security Baseline

`DOCUMENT_SERVICE_SECRET` must contain at least 32 bytes. Missing configuration
fails closed. Requests are limited by `DOCUMENT_MAX_REQUEST_BYTES` (2 MiB by
default), authentication uses constant-time comparison, and production compose
does not publish the service port. `/readyz` must pass template, mapping,
LibreOffice, writable-temp and storage checks before generation is enabled.

## Local Python Run

From `mikoton-commercial-proposals/`:

```powershell
$env:PYTHONPATH = (Resolve-Path .\document-service).Path
$env:DOCUMENT_SERVICE_SECRET = "<local-secret>"
$env:DOCUMENT_STORAGE_TYPE = "local"
$env:DOCUMENT_PUBLIC_BASE_URL = "http://localhost:8010/documents"
py -m mikoton_document_service.server
```

Default address:

```text
http://127.0.0.1:8010
```

Checks:

```powershell
curl http://127.0.0.1:8010/healthz
curl http://127.0.0.1:8010/readyz
```

## Docker Build

```powershell
docker build `
  -f .\document-service\Dockerfile `
  -t mikoton-commercial-proposals/document-service:local `
  .
```

## Compose With MinIO

The compose file pins MinIO to `RELEASE.2025-09-07T16-13-09Z` and the client to `RELEASE.2025-08-13T08-35-41Z`; do not replace these with `latest` without a separate compatibility check.

The provided compose file expects the existing Docker network shared with the
target Twenty compose:

```text
twenty_default
```

Start:

```powershell
$env:DOCUMENT_SERVICE_SECRET = "<generated-secret>"
$env:MINIO_ACCESS_KEY = "<minio-access-key>"
$env:MINIO_SECRET_KEY = "<minio-secret-key>"
docker compose -f .\docker-compose.document-service.yml up -d --build
```

Target service URL for application variables:

```text
http://document-service:8010
```

From the Twenty container, verify:

```bash
curl http://document-service:8010/healthz
curl http://document-service:8010/readyz
```

`readyz` checks:

- template exists;
- mapping exists;
- temp directory writable;
- storage reachable;
- LibreOffice binary available.

## Environment Variables

Document service:

- `DOCUMENT_SERVICE_HOST`
- `DOCUMENT_SERVICE_PORT`
- `DOCUMENT_SERVICE_SECRET`
- `DOCUMENT_STORAGE_TYPE`
- `DOCUMENT_STORAGE_PATH`
- `DOCUMENT_PUBLIC_BASE_URL`
- `DOCUMENT_TEMP_PATH`
- `LIBREOFFICE_BINARY`
- `PDF_ENGINE`
- `GENERATION_TIMEOUT_SECONDS`
- `DOCUMENT_SIGNED_URL_TTL_SECONDS`

MinIO/S3:

- `MINIO_ENDPOINT`
- `MINIO_ACCESS_KEY`
- `MINIO_SECRET_KEY`
- `MINIO_BUCKET`
- `MINIO_SECURE`
- `MINIO_PUBLIC_BASE_URL`

`MINIO_ENDPOINT` is used for upload/storage access from the document-service
container. `MINIO_PUBLIC_BASE_URL`, when set, is used to create the presigned
download URL, so it must be the browser-reachable endpoint. Do not rewrite the
host after signing; S3 signatures include the host.

## Security

- Do not expose the service publicly without network controls.
- Set `DOCUMENT_SERVICE_SECRET`.
- Twenty App sends `Authorization: Bearer <DOCUMENT_SERVICE_SECRET>`.
- Do not log the secret or request Authorization header.
- Do not accept template paths from clients.
- Keep the bucket private.
- Use expiring presigned URLs or a private authenticated proxy.

## PDF Diagnostics

If `/readyz` reports `pdfEngine: false`, verify:

```bash
which libreoffice
libreoffice --headless --version
```

If generation fails with `PDF_EXPORT_FAILED`, inspect document-service logs for
the request id and generation id. Do not log the full payload or bearer secret.
