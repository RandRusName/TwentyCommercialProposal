# Document Generation

Phase 4 uses an external document-service. Twenty App logic functions do not
edit Excel files directly and never run VBA.

Flow:

```text
CommercialProposal DRAFT / FAILED
-> authenticated app route
-> status GENERATING
-> external document-service
-> patched XLSM
-> LibreOffice PDF export from that XLSM
-> storage metadata and download URLs
-> resultMetadata
-> status GENERATED / FAILED
```

## Current Implementation

- Template asset: `templates/mikoton-commercial-proposal-v1.xlsm`.
- Mapping config: `templates/mikoton-commercial-proposal-v1.mapping.json`.
- Worker code: `document-service/mikoton_document_service`.
- HTTP endpoint: `POST /v1/commercial-proposals/generate`.
- Health endpoint: `GET /healthz`.
- Readiness endpoint: `GET /readyz`.
- Container: `document-service/Dockerfile`.
- Compose: `docker-compose.document-service.yml`.

The generator patches only `xl/worksheets/sheet1.xml` and copies all other XLSM
ZIP parts unchanged. This preserves VBA, drawings, control properties, printer
settings, styles, merged cells, formulas and print area.

## PDF

Production PDF generation uses:

```text
generated.xlsm -> LibreOffice headless -> generated.pdf
```

ReportLab is no longer used for the production target flow. `/readyz` reports
`pdfEngine: false` when the configured LibreOffice binary is unavailable.

## Storage

The document-service supports:

- `DOCUMENT_STORAGE_TYPE=local`
- `DOCUMENT_STORAGE_TYPE=s3-compatible`

Target deployment should use MinIO/S3-compatible storage. `resultMetadata.files`
stores browser-usable download metadata:

```json
{
  "format": "xlsm",
  "fileName": "CP-....xlsm",
  "contentType": "application/vnd.ms-excel.sheet.macroEnabled.12",
  "size": 123456,
  "sha256": "...",
  "storageKey": "commercial-proposals/<proposal-id>/<generation-id>/<file>",
  "downloadUrl": "https://...",
  "downloadUrlExpiresAt": "..."
}
```

No `file://` URL or container path is returned by the target storage flow.

## App Configuration

Application variables:

- `DOCUMENT_SERVICE_URL`: server-side URL, for example `http://document-service:8010`.
- `DOCUMENT_SERVICE_SECRET`: secret bearer token, server-side only.

The front component never receives `DOCUMENT_SERVICE_SECRET`.

## Status Transitions

Implemented transitions:

- `DRAFT -> GENERATING`
- `FAILED -> GENERATING`
- `GENERATING -> GENERATED`
- `GENERATING -> FAILED`

`GENERATED -> GENERATING` is intentionally not implemented in Phase 4.

## Idempotency

The generation route accepts an operation UUID `idempotencyKey`. If the same key
already produced a `GENERATED` result stored in `resultMetadata`, the route
returns the existing result instead of regenerating files.

The document-service also derives deterministic storage keys from:

```text
CommercialProposal.id + generation idempotency key + templateVersion
```

