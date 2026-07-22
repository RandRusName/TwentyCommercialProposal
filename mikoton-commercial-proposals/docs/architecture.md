# Architecture

## Runtime

```text
Twenty front component
  -> authenticated App logic function
  -> CoreApiClient and App-owned metadata
  -> authenticated document-service
  -> private MinIO bucket
  -> XLSX/PDF attached back to CommercialProposal
```

Twenty core is not modified. The App is built and published privately through
the WSL release flow. Logic functions authorize through the application access
token and never receive the target API key from the browser.

`CommercialProposal` is the aggregate root. Items and stages are child custom
objects. Catalog values are copied as snapshots. Generation reads the canonical
saved aggregate, stores an immutable payload snapshot, and attaches generated
files to the proposal.

## Generation Claim

Same-proposal document generation is serialized by
`CommercialProposalGenerationClaim`:

- one claim row per proposal, enforced by a unique index on `proposalKey`
  (the CommercialProposal id);
- claim stores `operationId`, `ownerToken`, `editorRevision`, content
  `fingerprint`, and `leaseExpiresAt`;
- `operationId` = logical idempotent operation (client `idempotencyKey`);
- `ownerToken` = physical worker/execution token for fencing (minted per create);
- lease duration is **10 minutes** (`GENERATION_CLAIM_LEASE_MS`);
- owners renew the lease before/after document-service and before attachments;
- fencing: `assertGenerationClaimOwnership` before irreversible actions;
- `AcquireGenerationClaimResult`: `ACQUIRED` or `IN_PROGRESS` — parallel same
  `operationId` returns `IN_PROGRESS` (HTTP 409), not a second owner;
- after `leaseExpiresAt`, a new owner may replace the stale claim (new
  `ownerToken`); the old worker gets
  `COMMERCIAL_PROPOSAL_GENERATION_OWNERSHIP_LOST` and must not write `FAILED`,
  delete the claim, or attach files.

What this is **not**: Twenty SDK / Core API 2.20 does not expose App-level
compare-and-set, multi-object transactions, or linearizable multi-record
updates. The unique index on `proposalKey` plus ownership fencing is the
concurrency control for generation. Editor child saves and other multi-record
mutations remain best-effort relative to that platform limit.

## Catalog search and categories

- Search uses opaque cursor **v2** bound to a `filterFingerprint` of the
  current filters; `skip` must be an integer in `0..100`; `after` has length
  bounds. Filter mismatch or malformed cursors → `INVALID_INPUT`.
- Search responses return empty `categories` and per-page `pageCategories`.
- Complete category lists come from authenticated
  `POST /catalog-items/categories` (`PARTIAL` when the safety page limit is hit).
- Backend `normalizeCurrencyCode`: trim + upper; must match `[A-Z]{3}` or null.
- Catalog `itemType` is allowlisted on assignment; malformed types are not
  selectable in search (not substituted as selectable `SERVICE`).

## Trust Boundaries

- Front component input is untrusted and validated by logic functions.
- App routes require authentication and use workspace-scoped Core API access.
- `DOCUMENT_SERVICE_SECRET` exists only in server-side App variables and the
  document-service environment.
- MinIO uses a private bucket and worker credentials
  (`DOCUMENT_STORAGE_ACCESS_KEY` / `DOCUMENT_STORAGE_SECRET_KEY`) scoped by
  `document-service/minio-policy.json`. Root MinIO keys are not used by the
  worker; missing worker credentials fail closed.
- Signed URLs and authorization headers are excluded from structured logs.

## Production status

App `0.1.49` implements Phase 5.5 CORRECTIVE hardening. Verdict remains
**PHASE 5.5 INCOMPLETE — NOT READY FOR PRODUCTION** until CI and target/
operator evidence are recorded in `phase-5-5-production-acceptance.md`.
