# Smoke Test Report

Date: 2026-07-13.

## Target Instance

- URL: `http://192.168.100.11:3000`
- Twenty version observed during deploy: `v2.20.0`
- Remote: `mikoton-target`
- Workspace access: browser signed in as a regular User.

## Latest Deployment

- Source commit before version bump: `29eff4e` (`Require refreshed app route access tokens`)
- Published version: `0.1.20`
- Private publish: succeeded.
- Install/upgrade: succeeded.
- Tarball: `release-artifacts/mikoton-commercial-proposals-0.1.20.tgz`
- SHA-256: `83f4f0a5a515e8d46626fb1a9ecc307aa6a0a90c799f647c0f95c903fd68e23e`
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

Observed for `POST /s/commercial-proposals/opportunity-context` from the front component after version `0.1.20`:

| Signal | Result |
| --- | --- |
| Token acquisition | application access token present |
| Token value rendered/logged | no |
| Token length diagnostic | `612` |
| Refresh API availability diagnostic | present; React renders true boolean data attributes as an empty string |
| POST Authorization header | Bearer token sent from `requestAccessTokenRefresh` |
| POST status | `403` |
| POST status text | `Forbidden` |
| Response body shown to user | no raw body; safe localized message only |
| Function logs | no handler log output observed |
| Direct API-key route probe | same HTTP `403` with platform error body |

Direct API-key route response body, with the key redacted:

```json
{
  "statusCode": 403,
  "error": "Error",
  "messages": [
    "Logic function execution failed for d57a0087-7fe1-4a8a-9ad7-7ee61ab82c9f"
  ],
  "code": "FORBIDDEN_EXCEPTION"
}
```

Preflight check:

- `OPTIONS /s/commercial-proposals/opportunity-context`: HTTP `204`.
- `Access-Control-Allow-Headers` includes `authorization,content-type`.
- CORS/preflight is not the current blocker.

Interpretation:

- The previous unauthenticated fallback has been removed.
- The front component obtains an application access token and attempts the authenticated request with Bearer auth.
- Twenty route authentication is reached with a Bearer token and the platform proceeds far enough to attempt logic function execution.
- The handler itself is not invoked; Twenty returns a platform `FORBIDDEN_EXCEPTION` saying logic function execution failed.
- Upstream Twenty `v2.20.0` maps `LOGIC_FUNCTION_DISABLED` from the logic function driver to this route-level `403`.
- The upstream disabled driver throws: `Logic function execution is disabled. Set LOGIC_FUNCTION_TYPE to LOCAL or LAMBDA to enable.`
- Current blocker stage: `route execution` / `logic function execution`.

## Deployment Guard Added

Added `scripts/check-logic-function-runtime.mjs` and wired it into
`scripts/deploy-wsl.sh` before the patch version bump. The guard probes the
installed context route with a nonexistent Opportunity id:

- expected healthy response: structured app error `OPPORTUNITY_NOT_FOUND`;
- current target response: platform `403 FORBIDDEN_EXCEPTION`;
- result: deployment now stops before version bump/private publish when target
  Twenty has logic-function execution disabled.

Manual guard execution on the target returned:

```text
ERROR: Twenty logic function execution is disabled on the target server.
Fix the Twenty server environment and restart Twenty before deploying this app:
  LOGIC_FUNCTION_TYPE=LOCAL
or configure the Lambda runtime:
  LOGIC_FUNCTION_TYPE=LAMBDA
```

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

- API-key GraphQL access is valid and can read metadata.
- The same route fails with both the front-component application token and an API key.
- The target blocker is Twenty logic function execution being disabled on the server, not business repository execution.

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

Blocker: `route execution` - authenticated front component request to
`POST /s/commercial-proposals/opportunity-context` returns HTTP `403 Forbidden`
with an application Bearer token present. The response is a Twenty platform
`FORBIDDEN_EXCEPTION` for logic function execution failure. Upstream
Twenty `v2.20.0` shows this status is produced when the logic function driver is
disabled; target Twenty must enable logic function execution with
`LOGIC_FUNCTION_TYPE=LOCAL` or `LOGIC_FUNCTION_TYPE=LAMBDA`. The logic function
handler is not invoked, so Opportunity context cannot load and DRAFT creation
remains disabled.
