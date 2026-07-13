# Smoke Test Report

Date: 2026-07-13.

## Target Instance

- URL: `http://192.168.100.11:3000`
- Twenty version observed during deploy: `v2.20.0`
- Remote: `mikoton-target`
- Workspace access: browser signed in as a regular User.

## Latest Deployment

- Source commit before version bump: `a3642e3` (`Use Twenty functions base for app routes`)
- Published version: `0.1.16`
- Private publish: succeeded.
- Install/upgrade: succeeded.
- Tarball: `release-artifacts/mikoton-commercial-proposals-0.1.16.tgz`
- SHA-256: `fd19fc166782ccdb5dea9e58713477dca5636ac0da2717f88b335cc17c7236e8`
- Tarball validation: passed.

## Local Validation

Executed in WSL on 2026-07-13 before deployment:

- `corepack yarn typecheck`: passed.
- `corepack yarn lint`: passed, 0 warnings and 0 errors.
- `corepack yarn test:unit`: passed, 2 files and 36 tests.
- `deploy.bat`: passed version bump, build, tarball validation, private publish and install/upgrade.

## Fixed During Auth Route Investigation

- Authenticated app route calls now fail closed when no application access token can be obtained.
- The UI no longer sends `isAuthRequired: true` app route requests without a Bearer token.
- Route calls use the Twenty front-component application access token.
- Route calls send canonical `Authorization: Bearer <application-access-token>` and `Content-Type: application/json` headers.
- Route calls read `response.text()` first and parse JSON only when the body is non-empty.
- HTTP 401/403, network failures, invalid responses and structured application errors are mapped to typed UI-safe errors.
- Safe diagnostics were added without logging or rendering the token value.
- The route URL builder now prefers the SDK-provided `TWENTY_FUNCTIONS_URL` inside the front component Worker.

## Target UI Smoke

Verified in the in-app browser:

- Navigation item `Commercial Proposals` is visible.
- Opportunity list opens.
- Smoke Opportunity is visible:
  `[SMOKE] Phase3 UI Opportunity 2026-07-13T14-06-07-902Z`.
- Selecting one Opportunity works.
- Command menu item/action is visible:
  `Создать коммерческое предложение`.
- Front component opens from the Opportunity action.
- The component shows the title, fixed template and fixed language.
- User-facing auth error is safe:
  `Не удалось авторизовать запрос приложения. Обновите страницу и повторите попытку.`

Blocked:

- Opportunity context did not load.
- `Создать черновик` remained disabled.
- DRAFT creation from UI was not executed.
- Success state was not reached.
- Opening the created Commercial Proposal record was not verified.

## Auth Route Diagnostics

Observed for `POST /s/commercial-proposals/opportunity-context` from the front component after version `0.1.16`:

| Signal | Result |
| --- | --- |
| Token acquisition | application access token present |
| Token value rendered/logged | no |
| Token length diagnostic | `612` |
| Refresh API availability diagnostic | `false` because the Worker used `TWENTY_APP_ACCESS_TOKEN` directly |
| POST Authorization header | expected Bearer token from app Worker environment |
| POST status | `403` |
| POST status text | `Forbidden` |
| Response body shown to user | no raw body; safe localized message only |
| Function logs | no handler log output observed |

Interpretation:

- The previous unauthenticated fallback has been removed.
- The front component obtains an application access token and attempts the authenticated request with Bearer auth.
- Twenty rejects the request before the logic function handler runs.
- Current blocker stage: `route authentication`.

## Target API Smoke

Attempted with API-key based direct app-route probing:

```bash
TWENTY_TEST_INSTANCE_MODE=target
TWENTY_API_URL=http://192.168.100.11:3000
TWENTY_API_KEY=<redacted>
corepack yarn test:target-smoke
```

Result: blocked.

Observed:

- GraphQL API key is valid for GraphQL operations.
- Direct app route probe with the API key returned HTTP `403`.
- No target DRAFT was created through the API-key app-route smoke.

Interpretation:

- API-key GraphQL access does not prove authenticated app-route access.
- The target blocker is app-route authentication, not business repository execution.

## Created Draft

None through the Phase 3 UI/app route during this smoke session.

## Not Verified

- UI-created DRAFT.
- Correct DRAFT fields on target:
  `status`, `sourceType`, `templateCode`, `language`, `generatedAt`, `lastError`.
- Opportunity relation on a UI-created DRAFT.
- Company relation on a UI-created DRAFT.
- UI idempotency after DRAFT creation.
- Opening created record from success state.
- Restricted-user permission scenario.

## Current Verdict

`NOT READY FOR PHASE 4`

Blocker: `route authentication` - authenticated front component request to
`POST /s/commercial-proposals/opportunity-context` returns HTTP `403 Forbidden`
with an application Bearer token present. The logic function handler is not
invoked, so Opportunity context cannot load and DRAFT creation remains disabled.
