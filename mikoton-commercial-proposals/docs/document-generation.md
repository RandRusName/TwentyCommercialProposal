# Document Generation

Phase 4 introduces an external document-service. Twenty App logic functions do
not edit Excel files and do not run VBA.

Flow:

```text
CommercialProposal DRAFT / FAILED
→ authenticated app route
→ status GENERATING
→ external document-service
→ XLSM + PDF files
→ resultMetadata
→ status GENERATED
```

## Current Implementation

- Template asset: `templates/mikoton-commercial-proposal-v1.xlsm`.
- Mapping config: `templates/mikoton-commercial-proposal-v1.mapping.json`.
- Worker code: `document-service/mikoton_document_service`.
- HTTP endpoint: `POST /v1/commercial-proposals/generate`.
- Health endpoint: `GET /healthz`.
- Readiness endpoint: `GET /readyz`.

The generator patches only `xl/worksheets/sheet1.xml` and copies all other XLSM
ZIP parts unchanged. This was chosen because `openpyxl(load_workbook(...,
keep_vba=True))` preserved `xl/vbaProject.bin` but dropped
`xl/drawings/drawing1.xml` and `xl/printerSettings/printerSettings1.bin` in a
round-trip spike.

## App Configuration

Application variables:

- `DOCUMENT_SERVICE_URL`: server-side URL, for example `http://127.0.0.1:8010`.
- `DOCUMENT_SERVICE_SECRET`: secret bearer token, server-side only.

The front component never receives `DOCUMENT_SERVICE_SECRET`.

## Status Transitions

Implemented transitions:

- `DRAFT → GENERATING`
- `FAILED → GENERATING`
- `GENERATING → GENERATED`
- `GENERATING → FAILED`

`GENERATED → GENERATING` is intentionally not implemented in Phase 4.

## Idempotency

The generation route accepts an operation UUID `idempotencyKey`. If the same key
already produced a `GENERATED` result stored in `resultMetadata`, the route
returns the existing result instead of regenerating files.

