# Smoke Test Report

Date: 2026-07-12.

## Target Instance

- URL: `http://192.168.100.11:3000`
- Health: `200`, body `{"status":"ok","info":{},"error":{},"details":{}}`
- Version: `v2.20.0`
- `isWorkspaceSchemaDDLLocked`: `false`

## Local Smoke

Passed:

- TypeScript typecheck.
- Lint.
- Unit tests.
- Integration test gate without remote sync.
- Twenty SDK `dev:build`.

## Remote UI Smoke

Not executed.

Reason: the target server does not expose CLI OAuth client id and no API key was
provided in this session. The CLI explicitly requested `--api-key`.

Required next command after API key is available:

```powershell
yarn.cmd twenty remote:add --as mikoton-remote --url http://192.168.100.11:3000 --api-key "<TWENTY_API_KEY>"
yarn.cmd twenty plan -r mikoton-remote .
```
