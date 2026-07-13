# Smoke Test Report

Date: 2026-07-13.

## Target Instance

- URL: `http://192.168.100.11:3000`
- Expected version: `v2.20.0`

## Local Build Smoke

Executed on 2026-07-13 for the Phase 3 vertical slice:

- WSL `corepack yarn typecheck`: passed.
- WSL `corepack yarn lint`: passed, 0 warnings and 0 errors.
- WSL `corepack yarn test:unit`: passed, 2 files and 16 tests.
- WSL `bash scripts/build-wsl.sh`: passed.
- Tarball created:
  `release-artifacts/mikoton-commercial-proposals-0.1.2.tgz`.
- Tarball SHA-256:
  `efb8bef725d6d77b94a7c45ab7c6b11d9910f81810d173b06f1aeacc101c4ff0`.
- Tarball size: `417850` bytes.
- Tarball contains `manifest.json`, front component bundle and logic function
  bundles.
- Manifest path validation passed: packaged paths use forward slashes only.
- Compiled logic function check passed.

## Implemented UI Flow

The current code implements:

- Opportunity command menu item `Создать коммерческое предложение`;
- front component title `Создать коммерческое предложение`;
- context loading from `/s/commercial-proposals/opportunity-context`;
- display of Opportunity, Company or `Компания не указана`, amount,
  `currencyCode`, fixed template and fixed language;
- submit button `Создать черновик` with disabled submitting state;
- one operation-scoped idempotency key;
- success state with draft number, title, status and button
  `Открыть коммерческое предложение`;
- draft route request in the new `source/templateCode/language/idempotencyKey`
  format.

## Remote UI Smoke

Not executed for the Phase 3 changes on 2026-07-13.

Reason: after code changes the Git working tree is intentionally dirty, and
`deploy.bat` correctly refuses private publish/install from a dirty tree. No
target browser/UI session was completed here.

The following checks still need real execution and must not be marked passed
until observed on the target Workspace:

- navigation item is visible;
- Commercial Proposals list opens;
- Opportunity command menu item is visible;
- front component opens from an Opportunity;
- Opportunity context shows Company, amount and currencyCode;
- draft creation succeeds;
- created draft fields are correct: `number`, `title`, `status`, `sourceType`,
  `templateCode`, `language`, `amount`, `currencyCode`, `generatedAt = null`,
  `idempotencyKey`;
- relation to Opportunity is correct;
- relation to Company is correct when Opportunity has Company;
- repeated request with the same idempotency key does not create a second draft;
- repeated sync does not create metadata duplicates;
- repeated metadata plan is empty or only expected non-destructive changes.

## Created Draft

None. No draft was created on the target Workspace in this session.

## Required Remote Smoke Commands

```powershell
$env:TWENTY_API_URL = "http://192.168.100.11:3000"
$env:TWENTY_API_KEY = "<TWENTY_API_KEY>"
$env:TWENTY_TEST_INSTANCE_MODE = "target"
yarn.cmd test:target-smoke
```

Manual UI smoke must follow only after the new version has been committed,
published through `deploy.bat`, and installed/upgraded on the target Workspace.
