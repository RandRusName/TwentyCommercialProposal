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

## Trust Boundaries

- Front component input is untrusted and validated by logic functions.
- App routes require authentication and use workspace-scoped Core API access.
- `DOCUMENT_SERVICE_SECRET` exists only in server-side App variables and the
  document-service environment.
- MinIO uses a private bucket and worker credentials scoped by
  `document-service/minio-policy.json`.
- Signed URLs and authorization headers are excluded from structured logs.
