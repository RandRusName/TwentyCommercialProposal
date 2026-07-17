# Document Generation

Phase 4 uses an external document-service. Twenty App logic functions do not edit Excel files directly and never run VBA.

Flow:

```text
CommercialProposal DRAFT / FAILED
-> authenticated app route
-> status GENERATING
-> external document-service
-> patched XLSM
-> LibreOffice PDF export from that XLSM
-> storage metadata and download URLs
-> Twenty file upload and CommercialProposal attachments
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

The generator patches only `xl/worksheets/sheet1.xml` and copies all other XLSM ZIP parts unchanged. This preserves VBA, drawings, control properties, printer settings, styles, merged cells, formulas and print area.

## PDF

Production PDF generation uses:

```text
generated.xlsm -> LibreOffice headless -> generated.pdf
```

ReportLab is not used for the production target flow. `/readyz` reports `pdfEngine: false` when the configured LibreOffice binary is unavailable.

## Storage And Files

The document-service supports:

- `DOCUMENT_STORAGE_TYPE=local`
- `DOCUMENT_STORAGE_TYPE=s3-compatible`

Target deployment uses MinIO/S3-compatible storage. `resultMetadata.files` stores browser-usable download metadata plus Twenty file attachment metadata:

```json
{
  "format": "xlsm",
  "fileName": "КП-010-от-17.07.2026-company.xlsm",
  "contentType": "application/vnd.ms-excel.sheet.macroEnabled.12",
  "size": 123456,
  "sha256": "...",
  "storageKey": "commercial-proposals/<proposal-id>/<generation-id>/<file>",
  "downloadUrl": "https://...",
  "downloadUrlExpiresAt": "...",
  "twentyFileId": "uuid",
  "twentyFileUrl": "https://..."
}
```

No `file://` URL or container path is returned by the target storage flow.

After the document-service returns XLSM/PDF files, the app logic function downloads them server-side, validates `size` and `sha256`, uploads them through the Twenty metadata file upload API for the standard `Attachment.file` field, and creates standard `Attachment` records with `targetCommercialProposalId`. This fills the CommercialProposal record `Files` tab. DOCX is not generated and there is no DOCX URL field in the app metadata.

The target smoke on 2026-07-17 confirmed two generated attachments for `CommercialProposal 7d623e71-35a2-4b33-ac3a-a950bdba05fe`:

- `КП-010-от-17.07.2026-SMOKE-Files-Linked-2026-07-17T13-19-51-386Z.xlsm`
- `КП-010-от-17.07.2026-SMOKE-Files-Linked-2026-07-17T13-19-51-386Z.pdf`

## App Configuration

Application variables:

- `DOCUMENT_SERVICE_URL`: server-side URL, for example `http://document-service:8010`.
- `DOCUMENT_SERVICE_SECRET`: secret bearer token, server-side only.
- `TWENTY_FILE_UPLOAD_API_KEY`: server-side API key used only by the logic function to upload generated files into Twenty metadata storage.

The front component never receives `DOCUMENT_SERVICE_SECRET`, `TWENTY_FILE_UPLOAD_API_KEY`, or any API key.

## Status Transitions

Implemented transitions:

- `DRAFT -> GENERATING`
- `FAILED -> GENERATING`
- `GENERATING -> GENERATED`
- `GENERATING -> FAILED`

`GENERATED -> GENERATING` is intentionally not implemented in Phase 4.

## Idempotency

The generation route accepts an operation UUID `idempotencyKey`. If the same key already produced a `GENERATED` result stored in `resultMetadata`, the route returns the existing result instead of regenerating files or creating duplicate attachments.

The document-service also derives deterministic storage keys from:

```text
CommercialProposal.id + generation idempotency key + templateVersion
```

Final customer-facing numbers are assigned at generation time using a yearly sequence: `КП-001 от DD.MM.YYYY` through `КП-999 от DD.MM.YYYY`. DRAFT records keep a technical `DRAFT-<idempotencyKey>` number until generation succeeds or fails.
