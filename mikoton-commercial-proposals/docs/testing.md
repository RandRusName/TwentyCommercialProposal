# Testing

CI requires repository secret `TWENTY_EPHEMERAL_API_KEY` for the seeded ephemeral Twenty v2.20.0 image. The value is masked and is not stored in workflow source. Pull requests from forks do not receive this secret and therefore cannot run the authenticated vertical-slice job without maintainer approval.

CI also runs `yarn test:document-service`. MinIO images are pinned to `minio/minio:RELEASE.2025-09-07T16-13-09Z` and `minio/mc:RELEASE.2025-08-13T08-35-41Z`.

## Local Tests

Run from `mikoton-commercial-proposals/`:

```powershell
yarn.cmd install --immutable
yarn.cmd lint
yarn.cmd typecheck
yarn.cmd test:unit
yarn.cmd twenty dev:build .
yarn.cmd twenty dev:build --tarball .
```

Verified on 2026-07-13 for Phase 3.1:

- WSL `corepack yarn typecheck`: passed.
- WSL `corepack yarn lint`: passed, 0 warnings and 0 errors.
- WSL `corepack yarn test:unit`: passed, 2 files and 22 tests.
- WSL `bash scripts/build-wsl.sh`: passed; lint, typecheck, unit tests,
  Twenty tarball build and tarball validation succeeded.
- Deployed tarball: `release-artifacts/mikoton-commercial-proposals-0.1.5.tgz`.
- Tarball size: `419093` bytes.
- Tarball SHA-256:
  `7cf28c57f41d68685476070d02c6807d0d6b6d93736bdb090bb268275e343227`.

Windows `yarn.cmd typecheck` and `yarn.cmd lint` were not used as authoritative
checks in this session because Windows optional binaries for
`@typescript/native-preview` and `oxlint` were absent in `node_modules`.
Production validation remains WSL-only for this app.

Unit coverage includes:

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
- safe filtering of internal/stack-like UI error messages.

## Ephemeral Integration Tests

Used by GitHub CI only. Requires an ephemeral Twenty instance:

```powershell
$env:TWENTY_TEST_INSTANCE_MODE = "ephemeral"
$env:TWENTY_API_URL = "<ephemeral-url>"
$env:TWENTY_API_KEY = "<ephemeral-api-key>"
yarn.cmd test:integration
```

In `ephemeral` mode, setup may sync the app and uninstall it during cleanup.
The test fails if credentials are missing. The integration test now exercises
the backend vertical slice: create Company, create Opportunity, call context
route, call draft route, verify relations, verify `generatedAt = null`, repeat
the same idempotency key, and assert structured invalid-source errors. It also
checks context route responses for Opportunity with Company, Opportunity without
Company, missing `opportunityId`, and nonexistent Opportunity.

## Target Smoke Tests

Used only after private tarball publish/install on the target Twenty:

```powershell
$env:TWENTY_TEST_INSTANCE_MODE = "target"
$env:TWENTY_API_URL = "http://192.168.100.11:3000"
$env:TWENTY_API_KEY = "<target-api-key>"
yarn.cmd test:target-smoke
```

In `target` mode, setup does not sync metadata and never uninstalls the app.
The test creates `[SMOKE]` business records and performs best-effort cleanup of
those records only.

Observed on 2026-07-20 after private install of App `0.1.37`:

- WSL `corepack yarn test:target-smoke` passed, 1 file / 8 tests.
- The test exercised authenticated draft, context, editor, save, recalculate and
  generation routes on the target Twenty.
- The aggregate scenario saved eight items and four stages, including fractional
  quantities, discounts and a long description. It recalculated the canonical
  total, replayed the same save without duplicate children, rejected a stale
  revision and rejected a fabricated foreign child id.
- Incomplete generation validation left the record in `DRAFT`. Completed data
  generated schema `2.0` / template `2`, attached XLSX/PDF, and replayed the same
  generation key without duplicate files.
- A separate target regression generated a `LEGACY_V1` record with template `1`.
- Browser smoke used the front-component application access token and confirmed
  the v2 generation success state, disabled repeat action and two Files-tab
  attachments.
- The isolated target smoke business records were cleaned up. The App was not
  uninstalled and metadata was not modified by the test.

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
- lint, typecheck, unit tests, real integration tests, app build and tarball
  validation.

## Prompt 5.1 Aggregate Backend Tests

Added unit coverage:

- deterministic fixed-scale money calculation and half-up rounding;
- pure recalculation of unsaved item lines;
- legacy editor context starter suggestion;
- header-only save preserving `LEGACY_V1` and legacy `amount`;
- first valid item save converting to `AGGREGATE_V2`;
- completed save replay returning canonical aggregate without duplicate children
  or second revision increment;
- stale `editorRevision` conflict;
- foreign child id ownership rejection;
- `AGGREGATE_V2` generation guard before schema `2.0`.

Prompt 5.1 evidence on 2026-07-20:

- WSL `corepack yarn lint`: passed.
- WSL `corepack yarn typecheck`: passed.
- WSL `corepack yarn test:unit`: passed, 2 files / 58 tests.
- WSL `python3 -m unittest discover -s document-service/tests -v`: passed, 4 tests.
- WSL `scripts/build-wsl.sh`: passed, tarball manifest validation OK.
- `deploy.bat`: passed, private published and installed version `0.1.34`.
- `corepack yarn twenty plan -r mikoton-target .`: passed after deploy with no changes.
- WSL `corepack yarn test:target-smoke`: passed, 6 tests.
- Additional target aggregate smoke passed: editor context, recalculate, save-editor,
  `LEGACY_V1 -> AGGREGATE_V2`, replayed same `operationId`, and generation
  guard `COMMERCIAL_PROPOSAL_GENERATION_MODEL_NOT_SUPPORTED`.

## Prompt 5.2 Editor Tests

Local evidence on 2026-07-20:

- WSL `corepack yarn lint`: passed, 0 warnings/errors.
- WSL `corepack yarn typecheck`: passed.
- WSL `corepack yarn test:unit`: passed, 3 files / 82 tests.
- WSL `python3 -m unittest discover -s document-service/tests -v`: passed,
  4 tests.
- WSL `scripts/build-wsl.sh`: passed; editor bundle included and tarball
  manifest validation succeeded.

Coverage includes duplicate request identities, persisted duplicate detection,
canonical persisted totals, final revision re-read, partial-failure replay,
minimal recalculate payload, backend error-code preservation, immutable editor
helpers, comma decimals, validation, dirty state, stable save operation ids and
canonical response application.

Target evidence for Prompt 5.2:

- `deploy.bat`: published and installed `0.1.36`.
- tarball SHA-256:
  `44d18091b691395213fc64882e967cef148b2d3e15390be4ece1b79aeae8b8d4`.
- Twenty Settings -> Applications: current `0.1.36`, latest `0.1.36`.
- repeated metadata plan: no changes.
- WSL target smoke: 7 tests passed.
- browser UI smoke: editable save/reload, conflict with retained local edits,
  aggregate generation guard, legacy generation regression and GENERATED
  read-only mode passed.
