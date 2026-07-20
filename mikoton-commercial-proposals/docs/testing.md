# Testing

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

Observed on 2026-07-13:

- Windows `yarn.cmd test:target-smoke` could not start because optional native
  `rolldown` Windows bindings were absent.
- WSL `corepack yarn test:target-smoke` started and could create GraphQL smoke
  records, but authenticated app routes returned HTTP `403` with an empty body.
- This indicates the target API key works for GraphQL but is not sufficient for
  `/s/...` app routes with `isAuthRequired: true`.
- Target app-route smoke remains not passed until it is run with a real
  authenticated Twenty user session or another supported route-auth mechanism.

## CI

Root workflow: `.github/workflows/ci.yml`.

CI uses:

- `TWENTY_VERSION: v2.20.0`;
- `twentyhq/twenty/.github/actions/spawn-twenty-app-dev-test@twenty/v2.20.0`;
- Node from `mikoton-commercial-proposals/.nvmrc`;
- `yarn install --immutable`;
- lint, typecheck, unit tests, real integration tests, app build and tarball
  validation.

CI could not be observed as green from this local session because no commit was
pushed and no GitHub workflow run URL was produced.

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
- WSL `corepack yarn test:unit`: passed, 3 files / 79 tests before final
  deployment validation.
- WSL `python3 -m unittest discover -s document-service/tests -v`: passed,
  4 tests.
- WSL `scripts/build-wsl.sh`: passed; editor bundle included and tarball
  manifest validation succeeded.

Coverage includes duplicate request identities, persisted duplicate detection,
canonical persisted totals, final revision re-read, partial-failure replay,
minimal recalculate payload, backend error-code preservation, immutable editor
helpers, comma decimals, validation, dirty state, stable save operation ids and
canonical response application.
