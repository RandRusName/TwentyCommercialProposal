# Testing

## Local Tests

Run from `mikoton-commercial-proposals/`:

```powershell
yarn.cmd install --immutable
yarn.cmd lint
yarn.cmd typecheck
yarn.cmd test:unit
yarn.cmd test
yarn.cmd twenty dev:build .
```

Verified on 2026-07-13:

- `yarn.cmd typecheck`: passed.
- `yarn.cmd lint`: passed, 0 warnings and 0 errors.
- `yarn.cmd test:unit`: passed, 2 files and 11 tests.
- `yarn.cmd test`: passed local integration gate; remote setup skipped because
  credentials were not present.
- `yarn.cmd twenty dev:build .`: passed.

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

## Remote Integration Tests

Remote tests are opt-in because they sync app metadata to a real Twenty server.

```powershell
$env:TWENTY_API_URL = "http://192.168.100.11:3000"
$env:TWENTY_API_KEY = "<TWENTY_API_KEY>"
$env:TWENTY_RUN_REMOTE_SMOKE = "true"
yarn.cmd test
```

Do not run this against a production-like Workspace until
`yarn.cmd twenty plan -r mikoton-remote .` has been reviewed and confirmed
non-destructive.

## CI

Root workflow: `.github/workflows/ci.yml`.

CI uses:

- `TWENTY_VERSION: v2.20.0`;
- `twentyhq/twenty/.github/actions/spawn-twenty-app-dev-test@twenty/v2.20.0`;
- Node from `mikoton-commercial-proposals/.nvmrc`;
- `yarn install --immutable`;
- lint, typecheck, unit tests, integration tests and app build.

CI could not be observed as green from this local session because no commit was
pushed and no GitHub workflow run URL was produced.
