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
- `yarn.cmd test`: passed local integration gate; remote setup skipped because
  `TWENTY_RUN_REMOTE_SMOKE=true` and API credentials were not present.
- `yarn.cmd twenty dev:build .`: passed.

## Remote UI Smoke

Not executed on 2026-07-13.

Reason: no API key was available in the environment. The app was not synced,
installed, or activated on `http://192.168.100.11:3000` during this session.

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
$env:TWENTY_RUN_REMOTE_SMOKE = "true"
yarn.cmd test
```

Manual UI smoke must follow only after the metadata plan has been reviewed and
apply/install completed.
