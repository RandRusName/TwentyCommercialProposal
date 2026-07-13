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

Verified on 2026-07-13:

- `yarn.cmd install --immutable`: passed with existing `twenty-ui` peer warning
  for `monaco-editor`.
- `yarn.cmd typecheck`: passed.
- `yarn.cmd lint`: passed, 0 warnings and 0 errors.
- `yarn.cmd test:unit`: passed, 2 files and 11 tests.
- `yarn.cmd twenty dev:build .`: passed.
- `yarn.cmd twenty dev:build --tarball .`: passed; tarball created.

Unit coverage includes:

- `generatedAt = null` for drafts;
- `CP-YYYYMMDD-HHmmss-XXXX` number format;
- new `source/templateCode/language/idempotencyKey` request contract;
- unsupported source structured error;
- sequential idempotency;
- duplicate-conflict recovery;
- simulated parallel duplicate request;
- number-conflict retry;
- Opportunity amount decimal and micros normalization.

## Ephemeral Integration Tests

Used by GitHub CI only. Requires an ephemeral Twenty instance:

```powershell
$env:TWENTY_TEST_INSTANCE_MODE = "ephemeral"
$env:TWENTY_API_URL = "<ephemeral-url>"
$env:TWENTY_API_KEY = "<ephemeral-api-key>"
yarn.cmd test:integration
```

In `ephemeral` mode, setup may sync the app and uninstall it during cleanup.
The test fails if credentials are missing.

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
