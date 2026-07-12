# Testing

## Local Tests

Run:

```powershell
yarn.cmd typecheck
yarn.cmd lint
yarn.cmd test:unit
yarn.cmd test
yarn.cmd twenty dev:build .
```

Verified on 2026-07-12:

- `yarn.cmd typecheck`: passed.
- `yarn.cmd lint`: passed, 0 warnings.
- `yarn.cmd test:unit`: passed, 2 files, 5 tests.
- `yarn.cmd test`: passed marker integration gate, remote smoke is opt-in.
- `yarn.cmd twenty dev:build .`: passed, output in `.twenty/output`.

## Remote Smoke

Remote smoke requires a real API key and is intentionally opt-in:

```powershell
$env:TWENTY_API_URL = "http://192.168.100.11:3000"
$env:TWENTY_API_KEY = "<TWENTY_API_KEY>"
$env:TWENTY_RUN_REMOTE_SMOKE = "true"
yarn.cmd test
```

This performs app dev sync in test setup. Do not run it against production-like
data unless the metadata plan has been reviewed.
