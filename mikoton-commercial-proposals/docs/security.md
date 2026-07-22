# Security

## Controls

- Authenticated App routes require an application access token. Front code does
  not use API keys, local storage tokens, cookie scraping or secret variables.
- The document-service refuses to start without a secret of at least 32 bytes,
  compares credentials with `hmac.compare_digest`, and caps request bodies at
  `DOCUMENT_MAX_REQUEST_BYTES` (default 2 MiB).
- Production compose does not publish the document-service port. MinIO API is
  bound to the target LAN address and its console is loopback-only.
- MinIO bucket initialization keeps the bucket private and assigns a least
  privilege worker policy.
- Docker base images and GitHub Actions are pinned to immutable digests/SHAs.
- `yarn test:secrets` scans tracked files; CI also scans the built tarball.
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
