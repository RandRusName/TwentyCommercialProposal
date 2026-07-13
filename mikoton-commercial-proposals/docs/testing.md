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

Verified on 2026-07-13 for the Phase 3 vertical slice:

- WSL `corepack yarn typecheck`: passed.
- WSL `corepack yarn lint`: passed, 0 warnings and 0 errors.
- WSL `corepack yarn test:unit`: passed, 2 files and 16 tests.
- WSL `bash scripts/build-wsl.sh`: passed; lint, typecheck, unit tests,
  Twenty tarball build and tarball validation succeeded.
- Tarball: `release-artifacts/mikoton-commercial-proposals-0.1.2.tgz`.
- Tarball size: `417850` bytes.
- Tarball SHA-256:
  `efb8bef725d6d77b94a7c45ab7c6b11d9910f81810d173b06f1aeacc101c4ff0`.

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
the same idempotency key, and assert structured invalid-source errors.

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
