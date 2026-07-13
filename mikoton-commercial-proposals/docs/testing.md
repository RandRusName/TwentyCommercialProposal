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
- `CP-YYYYMMDD-HHmmss-XXXX` number format;
- new `source/templateCode/language/idempotencyKey` request contract;
- unsupported source structured error;
- invalid idempotency key structured error;
- sequential idempotency;
- duplicate-conflict recovery;
- simulated parallel duplicate request;
- number-conflict retry;
- safe wrapping of draft create failures;
- Opportunity amount decimal, zero, string micros and micros normalization;
- no fallback currency when Opportunity has no `currencyCode`.
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
