# Testing

## Prompt 5.5 Final Gate

Run from a clean checkout:

```bash
yarn install --immutable
yarn lint
yarn typecheck
yarn test:unit
yarn test:document-service
yarn test:integration
yarn test:secrets
yarn test:private-urls
```

`test:integration` is a hard gate in ephemeral mode and must fail when its
temporary Twenty credentials are missing. Target smoke is separate and must
never uninstall the App. Production tarball validation runs only in WSL and
verifies unique idempotency, final-number, and generation-claim indexes in
`manifest.json`.

`yarn test:private-urls` (`scripts/scan-private-network-urls.mjs`) fails on
hardcoded private/LAN URLs in tracked sources and docs; use `$TWENTY_API_URL`
or placeholders such as `https://your-twenty-instance.example`.

CI requires repository secret `TWENTY_EPHEMERAL_API_KEY` for the seeded ephemeral Twenty v2.20.0 image. The value is masked and is not stored in workflow source. Pull requests from forks do not receive this secret and therefore cannot run the authenticated vertical-slice job without maintainer approval.

CI also runs `yarn test:document-service`. MinIO images are pinned to `minio/minio:RELEASE.2025-09-07T16-13-09Z` and `minio/mc:RELEASE.2025-08-13T08-35-41Z`.

Exact pass counts, tarball SHA-256, image digest and CI run ids for App
`0.1.49` are **Pending** — record only at the final release commit. Do not
invent them.

## Local Tests

Run from `mikoton-commercial-proposals/`:

```powershell
yarn.cmd install --immutable
yarn.cmd lint
yarn.cmd typecheck
yarn.cmd test:unit
yarn.cmd test:document-service
yarn.cmd test:secrets
yarn.cmd test:private-urls
yarn.cmd twenty dev:build .
yarn.cmd twenty dev:build --tarball .
```

Unit and document-service coverage for Phase 5.5 CORRECTIVE (`0.1.49`) includes:

- generation claim: `operationId` vs `ownerToken`; `ACQUIRED` / `IN_PROGRESS`;
- parallel same `operationId` → second `IN_PROGRESS` (not second owner);
- fencing / `COMMERCIAL_PROPOSAL_GENERATION_OWNERSHIP_LOST` (no FAILED / no
  claim delete / no attachments on loser);
- 10-minute lease renewal checkpoints;
- stale takeover after `leaseExpiresAt`;
- currency normalization (`normalizeCurrencyCode`: trim+upper, `[A-Z]{3}`);
- catalog cursor v2 (`filterFingerprint`, `skip` 0..100, `after` bounds);
- categories route completeness (`COMPLETE` / `PARTIAL`); search empty
  `categories` + `pageCategories`;
- `itemType` allowlist on assignment; malformed type disabled in search;
- private URL scan (`test:private-urls`);
- worker storage credentials fail-closed (no `MINIO_ACCESS_KEY` silent fallback).

Broader unit coverage still includes:

- `generatedAt = null` for drafts;
- technical DRAFT numbers and final `КП-### от DD.MM.YYYY` number format;
- new `source/templateCode/language/idempotencyKey` request contract;
- unsupported source structured error;
- invalid idempotency key structured error;
- sequential idempotency;
- duplicate-conflict recovery;
- simulated parallel duplicate request;
- final number allocation, yearly sequence limit and duplicate-conflict retry;
- safe wrapping of draft create failures;
- Opportunity amount decimal, zero, string micros and micros normalization;
- no fallback currency when Opportunity has no `currencyCode`.
- generated file checksum validation, Twenty upload and Attachment creation;
- UUID-only idempotency key generation;
- readable error when `crypto.randomUUID` is unavailable;
- stable idempotency key reuse for retries;
- UI amount formatting;
- disabled create states for loading, submitting, success and missing key;
- safe filtering of internal/stack-like UI error messages;
- `CATALOG_ITEM_NOT_FOUND` / `CATALOG_ITEM_NOT_SELECTABLE` on assignment.

## Ephemeral Integration Tests

Used by GitHub CI only. Requires an ephemeral Twenty instance:

```powershell
$env:TWENTY_TEST_INSTANCE_MODE = "ephemeral"
$env:TWENTY_API_URL = "<ephemeral-url>"
$env:TWENTY_API_KEY = "<ephemeral-api-key>"
yarn.cmd test:integration
```

In `ephemeral` mode, setup may sync the app and uninstall it during cleanup.
The test fails if credentials are missing. The integration test exercises
the backend vertical slice: create Company, create Opportunity, call context
route, call draft route, verify relations, verify `generatedAt = null`, repeat
the same idempotency key, and assert structured invalid-source errors. It also
checks context route responses for Opportunity with Company, Opportunity without
Company, missing `opportunityId`, and nonexistent Opportunity.

## Target Smoke Tests

Used only after private tarball publish/install on the target Twenty:

```powershell
$env:TWENTY_TEST_INSTANCE_MODE = "target"
$env:TWENTY_API_URL = "https://your-twenty-instance.example"  # or $env:TWENTY_API_URL
$env:TWENTY_API_KEY = "<target-api-key>"
yarn.cmd test:target-smoke
```

In `target` mode, setup does not sync metadata and never uninstalls the app.
The test creates `[SMOKE]` business records and performs best-effort cleanup of
those records only.

Target smoke results for `0.1.49` (claim fencing, ownership lost, FAILED/retry,
recovery, restricted user) are **NOT DONE** — see
`phase-5-5-production-acceptance.md`.

## CI

Root workflow: `.github/workflows/ci.yml`.

CI uses:

- `TWENTY_VERSION: v2.20.0`;
- the exact `twentycrm/twenty-app-dev:v2.20.0` image with
  `LOGIC_FUNCTION_TYPE=LOCAL`, because the upstream spawn action does not enable
  logic-function execution;
- an isolated Docker network with the App document-service and private MinIO;
- workspace-scoped ephemeral App variables configured through the Twenty
  metadata API after sync; no target URL, target key or production secret is
  used by GitHub;
- Node from `mikoton-commercial-proposals/.nvmrc`;
- `yarn install --immutable`;
- lint, typecheck, unit tests, secrets/private-url scans as configured,
  real integration tests, app build and tarball validation.

## Prompt 5.1–5.2 Historical Notes

Earlier phase local/target evidence (versions before `0.1.49`) remains in git
history and older smoke reports. Do not treat those artifact SHAs or deploy
versions as acceptance for Phase 5.5 CORRECTIVE / `0.1.49`.
