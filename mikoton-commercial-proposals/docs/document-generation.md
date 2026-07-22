# Document Generation

## Prompt 5.5 Guarantees

Generation validates the canonical aggregate, including customer contact,
before reserving a final number or mutating status/snapshot. The final number
uses the Europe/Moscow business date and a database-backed unique
`finalNumberKey`. A network-ambiguous retry reuses its operation only while the
proposal id, revision and canonical fingerprint are unchanged.

## Generation Claim

Same-proposal concurrency is serialized by
`CommercialProposalGenerationClaim`:

1. Compute content fingerprint from the canonical draft + aggregate.
2. `acquireGenerationClaim` creates a row with unique `proposalKey` (proposal
   id), storing `operationId`, `editorRevision`, `fingerprint`, and
   `leaseExpiresAt` (now + 5 minutes).
3. Unique-index conflict:
   - same `operationId` + revision + fingerprint → reuse claim (same-op replay);
   - different owner, lease unexpired →
     `COMMERCIAL_PROPOSAL_GENERATION_IN_PROGRESS` (HTTP 409);
   - lease expired → delete stale claim and create a new one (stale-lock
     recovery).
4. Before calling the document-service, re-read revision + fingerprint; if they
   no longer match the claim, abort without generating (pre-document-service
   re-check).
5. On terminal success or failure paths, `releaseGenerationClaim` deletes the
   claim row (best-effort).

Aggregate proposals use macro-free XLSX template v2 and schema `2.0`. It supports 50 items and 10 stages, keeps percentage formulas and server-calculated cached totals, and is exported to PDF by LibreOffice. Legacy proposals keep the v1 path.

Twenty attachment is checkpointed after each format. Retry matches `generationId + format + sha256` and attaches only a missing format.

Phase 4 uses an external document-service. Twenty App logic functions do not edit Excel files directly and never run VBA.

Flow:

```text
CommercialProposal DRAFT / FAILED
-> authenticated app route
-> acquire generation claim (unique proposalKey)
-> status GENERATING
-> pre-call re-check of editorRevision + fingerprint
-> external document-service
-> patched XLSX without VBA/macros
-> LibreOffice PDF export from that XLSX
-> storage metadata and download URLs
-> Twenty file upload and CommercialProposal attachments
-> resultMetadata
-> status GENERATED / FAILED
-> release generation claim
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

The source template remains the user-provided `.xlsm`, but generated Excel artifacts are normal `.xlsx` files. The generator patches `xl/worksheets/sheet1.xml`, removes VBA/control parts, converts the workbook content type to non-macro XLSX, and preserves the workbook layout, drawings, printer settings, styles, merged cells, formulas and print area where they are compatible with `.xlsx`.

## PDF

Production PDF generation uses:

```text
generated.xlsx -> LibreOffice headless -> generated.pdf
```

ReportLab is not used for the production target flow. `/readyz` reports `pdfEngine: false` when the configured LibreOffice binary is unavailable.

## Storage And Files

The document-service supports:

- `DOCUMENT_STORAGE_TYPE=local`
- `DOCUMENT_STORAGE_TYPE=s3-compatible`

Target deployment uses MinIO/S3-compatible storage with required worker
credentials `DOCUMENT_STORAGE_ACCESS_KEY` / `DOCUMENT_STORAGE_SECRET_KEY`
(fail-closed; no `MINIO_ACCESS_KEY` fallback). `resultMetadata.files` stores
browser-usable download metadata plus Twenty file attachment metadata:

```json
{
  "format": "xlsx",
  "fileName": "КП-010-от-17.07.2026-company.xlsx",
  "contentType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
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

After the document-service returns XLSX/PDF files, the app logic function downloads them server-side, validates `size` and `sha256`, uploads them through the Twenty metadata file upload API for the standard `Attachment.file` field, and creates standard `Attachment` records with `targetCommercialProposalId`. This fills the CommercialProposal record `Files` tab. DOCX is not generated and there is no DOCX URL field in the app metadata.

Historical target smoke evidence (pre-5.5 claim) for attachments is retained in
older smoke reports; re-verify on the `0.1.48` target install before acceptance.

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

Same-operation claim replay (identical `idempotencyKey` / `operationId` with
unchanged revision and fingerprint) reuses the generation claim instead of
returning 409.

The document-service also derives deterministic storage keys from:

```text
CommercialProposal.id + generation idempotency key + templateVersion
```

Final customer-facing numbers are assigned at generation time using a yearly sequence: `КП-001 от DD.MM.YYYY` through `КП-999 от DD.MM.YYYY`. DRAFT records keep a technical `DRAFT-<idempotencyKey>` number until generation succeeds or fails.
