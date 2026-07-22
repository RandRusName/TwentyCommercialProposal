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
- claim stores `operationId`, `editorRevision`, content `fingerprint`, and
  `leaseExpiresAt`;
- lease duration is 5 minutes (`GENERATION_CLAIM_LEASE_MS`);
- same-operation replay (identical `operationId` + revision + fingerprint)
  reuses the existing claim;
- a different operation against an unexpired lease raises
  `COMMERCIAL_PROPOSAL_GENERATION_IN_PROGRESS` (HTTP 409);
- after `leaseExpiresAt`, a new owner may delete the stale claim and create its
  own (stale-lock recovery for crashed workers).

What this is **not**: Twenty SDK / Core API 2.20 does not expose App-level
compare-and-set or multi-object transactions. The unique index on `proposalKey`
is the atomic concurrency control for generation ownership. Editor child saves
and other multi-record mutations remain best-effort relative to that platform
limit.

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
