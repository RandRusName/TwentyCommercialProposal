# Document Generation

## Prompt 5.5 Guarantees

Generation validates the canonical aggregate, including customer contact,
before reserving a final number or mutating status/snapshot. The final number
uses the Europe/Moscow business date and a database-backed unique
`finalNumberKey`. A network-ambiguous retry reuses its operation only while the
proposal id, revision and canonical fingerprint are unchanged.

## Generation Claim

Same-proposal concurrency is serialized by
`CommercialProposalGenerationClaim` (unique index on `proposalKey`).

### `operationId` vs `ownerToken`

| Field | Role |
|---|---|
| `operationId` | Logical idempotent operation id (client `idempotencyKey`). Identifies the user-facing generation attempt. |
| `ownerToken` | Physical worker/execution token (UUID minted on create). Used for lease fencing; distinct from `operationId`. |

Twenty SDK 2.20 does **not** provide App-level transactions or linearizability.
Atomicity for ownership is the unique `proposalKey` index plus fencing checks.

### Acquire result

`acquireGenerationClaim` returns `AcquireGenerationClaimResult`:

- `ACQUIRED` — this worker created the claim and holds `ownerToken`.
- `IN_PROGRESS` — a live claim already exists (including **parallel same
  `operationId`**). The second caller does **not** become a second owner; the
  route maps this to `COMMERCIAL_PROPOSAL_GENERATION_IN_PROGRESS` (HTTP 409),
  unless the proposal already has a matching `GENERATED` result for that key.

### Lease, renew, fencing

1. Lease duration is **10 minutes** (`GENERATION_CLAIM_LEASE_MS`).
2. Owner renews the lease (after ownership assert) before calling the
   document-service, after the document-service returns, and before each
   attachment checkpoint.
3. Before irreversible actions (status → `GENERATING`, document-service call,
   attachments, terminal `GENERATED`/`FAILED` writes), the owner runs
   `assertGenerationClaimOwnership` (re-read claim; match `id`, `proposalKey`,
   `operationId`, `ownerToken`).

### Stale takeover

If `leaseExpiresAt` has passed, a new acquire may delete the stale row and
create a claim with a **new** `ownerToken`. The previous worker then fails
fencing with `COMMERCIAL_PROPOSAL_GENERATION_OWNERSHIP_LOST` (HTTP 409).

### Ownership lost behavior

On `COMMERCIAL_PROPOSAL_GENERATION_OWNERSHIP_LOST` the losing worker:

- does **not** write `FAILED`;
- does **not** delete the claim (new owner keeps it);
- does **not** attach files.

### Flow

```text
CommercialProposal DRAFT / FAILED
-> authenticated app route
-> acquireGenerationClaim (ACQUIRED | IN_PROGRESS)
-> assert ownership
-> status GENERATING
-> renew lease
-> pre-call re-check of editorRevision + fingerprint
-> external document-service
-> renew lease
-> assert ownership per attachment
-> resultMetadata / status GENERATED
-> releaseGenerationClaim (owner only)
```

Aggregate proposals use macro-free XLSX template v2 and schema `2.0`. It supports 50 items and 10 stages, keeps percentage formulas and server-calculated cached totals, and is exported to PDF by LibreOffice. Legacy proposals keep the v1 path.

Twenty attachment is checkpointed after each format. Retry matches `generationId + format + sha256` and attaches only a missing format. Attachments run only while ownership is held.

Phase 4 uses an external document-service. Twenty App logic functions do not edit Excel files directly and never run VBA.

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

Target attachment evidence for App `0.1.49` is **NOT DONE** — see
`phase-5-5-production-acceptance.md`.

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

Ownership-lost paths do not perform the `GENERATING -> FAILED` write.

`GENERATED -> GENERATING` is intentionally not implemented in Phase 4.

## Idempotency

The generation route accepts an operation UUID `idempotencyKey` (stored as claim
`operationId`). If the same key already produced a `GENERATED` result stored in
`resultMetadata`, the route returns the existing result instead of regenerating
files or creating duplicate attachments.

A **live** claim for the same `operationId` held by another physical
`ownerToken` is `IN_PROGRESS` (409), not a second `ACQUIRED` owner.

The document-service also derives deterministic storage keys from:

```text
CommercialProposal.id + generation idempotency key + templateVersion
```

Final customer-facing numbers are assigned at generation time using a yearly sequence: `КП-001 от DD.MM.YYYY` through `КП-999 от DD.MM.YYYY`. DRAFT records keep a technical `DRAFT-<idempotencyKey>` number until generation succeeds or fails.
