# Smoke Test Report

Date: 2026-07-13.

## Target Instance

- URL: `http://192.168.100.11:3000`
- Expected version: `v2.20.0`

## Local Smoke

Executed on 2026-07-13:

- `yarn.cmd typecheck`: passed.
- `yarn.cmd lint`: passed, 0 warnings and 0 errors.
- `yarn.cmd test:unit`: passed, 2 files and 11 tests.
- `yarn.cmd twenty dev:build .`: passed.
- `yarn.cmd twenty dev:build --tarball .`: passed.
- Tarball created:
  `.twenty/output/mikoton-commercial-proposals-0.1.0.tgz`.
- Tarball SHA-256:
  `32ce56f46e8b7246b5bf0e994e789c312f80b65c8f440da1eb50b34371ad6059`.
- Tarball contains `manifest.json`, front component bundle and logic function
  bundles.
- Tarball does not contain `.env` files.

## Remote UI Smoke

Not executed on 2026-07-13.

Reason: private publish/install was not executed on `http://192.168.100.11:3000`
from this session. The app was not installed or activated on the target
Workspace here.

The following checks still need real execution and must not be marked passed
until observed on the target Workspace:

- navigation item is visible;
- Commercial Proposals list opens;
- Opportunity command menu item is visible;
- front component opens from an Opportunity;
- draft creation succeeds;
- created draft fields are correct: `number`, `title`, `status`, `sourceType`,
  `templateCode`, `language`, `amount`, `currency`, `generatedAt = null`,
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

Manual UI smoke must follow only after the metadata plan has been reviewed and
apply/install completed.
