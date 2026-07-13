# Smoke Test Report

Date: 2026-07-13.

## Target Instance

- URL: `http://192.168.100.11:3000`
- Twenty version: `v2.20.0`
- Remote: `mikoton-target`
- Workspace access: browser signed in as a regular User.

## Latest Deployment

- Deployed source commit: `4eb5fd9` (`Persist CommercialProposal relation ids`)
- Published version: `0.1.23`
- Private publish: succeeded.
- Install/upgrade: succeeded.
- Tarball: `release-artifacts/mikoton-commercial-proposals-0.1.23.tgz`
- SHA-256: `7b278584f8009a2d6050be9c16b03aaf61e1138a95e8e3de57221b01d6fc3e12`
- Tarball validation: passed.

## Local Validation

Executed before deployment:

- `corepack yarn test:unit`: passed, 37 tests.
- `corepack yarn typecheck`: passed.
- `corepack yarn lint`: passed.
- `deploy.bat`: passed version bump, WSL build, tarball validation, private publish and install/upgrade.

## Authenticated App Routes

The initial Phase 3 blocker was fixed.

- Front component requests no longer fall back to unauthenticated fetches.
- `requestAccessTokenRefresh` is used to obtain the Twenty application access token.
- App routes are called with `Authorization: Bearer <application-access-token>`.
- Token values are not logged or rendered.
- Empty and non-JSON response bodies are handled safely.
- Target `OPTIONS /s/commercial-proposals/opportunity-context`: passed.
- Target `POST /s/commercial-proposals/opportunity-context`: HTTP `200`.

Target Twenty also required logic function execution to be enabled in runtime configuration:

- `LOGIC_FUNCTION_TYPE=LOCAL`
- Server and worker were restarted.
- No Twenty source code was changed.

## Target UI Smoke

Verified in the in-app browser:

- Navigation item `Commercial Proposals` is visible.
- Opportunity page opens.
- Opportunity action is visible: `Создать коммерческое предложение`.
- Front component opens from the Opportunity action.
- Opportunity context loads successfully.
- Context shown in UI:
  - Opportunity: `[SMOKE] Phase3 UI Opportunity 2026-07-13T14-06-07-902Z`
  - Company: `Компания не указана`
  - Amount: `123,45`
  - Currency: `RUB`
  - Template: `Стандартное коммерческое предложение`
  - Language: `Русский`
- `Создать черновик` is enabled after context load.
- DRAFT creation from UI succeeds.
- Success state is shown.
- `Создать черновик` is disabled after success.
- `Открыть коммерческое предложение` opens the created record in Twenty UI.

Created draft:

- Number: `CP-20260713-200410-1NXH`
- ID: `e82f2712-cf74-416e-9cdc-89356f3d6d60`
- Title: `CP-20260713-200410-1NXH - [SMOKE] Phase3 UI Opportunity 2026-07-13T14-06-07-902Z`

## Target API Verification

Created record was verified through GraphQL:

- `status = DRAFT`
- `sourceType = OPPORTUNITY`
- `templateCode = standard-commercial-proposal`
- `language = ru-RU`
- `amount = 123.45`
- `currencyCode = RUB`
- `generatedAt = null`
- `opportunityId = 8b0795c9-dbed-45d9-8258-70233376ef57`
- `opportunity.id = 8b0795c9-dbed-45d9-8258-70233376ef57`
- `companyId = null`
- `company = null`
- `idempotencyKey = 4bb2cf19-d18c-44f3-82ee-f15100bf6232`

Idempotency verification:

- Repeated `POST /s/commercial-proposals/drafts` with the same key returned HTTP `200`.
- Response returned the same draft ID: `e82f2712-cf74-416e-9cdc-89356f3d6d60`.
- Response returned `created = false`.
- Query by `idempotencyKey` returned exactly one record.

## Known Limitations

- Company relation was not exercised in this UI smoke because the selected smoke Opportunity has no Company.
- Restricted-user permission scenario was not executed in this smoke session.
- `lastError` is stored as an empty string by Twenty for the created DRAFT.

## Current Verdict

`READY FOR PHASE 4`
