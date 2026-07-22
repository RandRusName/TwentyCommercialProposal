# Security

## Controls

- Authenticated App routes require an application access token. Front code does
  not use API keys, local storage tokens, cookie scraping or secret variables.
- The document-service refuses to start without a secret of at least 32 bytes,
  compares credentials with `hmac.compare_digest`, and caps request bodies at
  `DOCUMENT_MAX_REQUEST_BYTES` (default 2 MiB).
- For `DOCUMENT_STORAGE_TYPE` of `s3` / `s3-compatible` / `minio`,
  `DOCUMENT_STORAGE_ACCESS_KEY` and `DOCUMENT_STORAGE_SECRET_KEY` are required.
  There is no silent fallback to `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` or
  MinIO root credentials. Missing worker credentials fail closed
  (`SERVICE_NOT_READY`).
- Production compose does not publish the document-service port. MinIO API and
  console bindings are operator-controlled; keep the console loopback-only in
  production.
- MinIO bucket initialization keeps the bucket private and assigns a least
  privilege worker policy.
- Docker base images and GitHub Actions are pinned to immutable digests/SHAs.
- `yarn test:secrets` scans tracked files; CI also scans the built tarball.
- `yarn test:private-urls` fails on hardcoded private/LAN URLs in tracked
  sources and docs that should use `$TWENTY_API_URL` or placeholders.
- Logs contain identifiers, statuses, duration and safe error codes only. They
  exclude payloads, tokens, secrets, signed URLs and raw SDK exceptions.

## Credential Operations

Credential rotation is an operator action: create replacement App API and
document-storage credentials, update runtime secret stores, restart affected
services, verify readiness and revoke the old credentials. Never place values
in Git, release manifests or acceptance reports.

The historical credential rotation required by Prompt 5.5 is not considered
verified until the operator records the rotation timestamp and successful
post-rotation smoke without exposing the value.
