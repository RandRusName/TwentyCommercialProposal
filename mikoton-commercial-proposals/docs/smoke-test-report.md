# Smoke Test Report

Date: 2026-07-13.

## Target Instance

- URL: `http://192.168.100.11:3000`
- Twenty version observed during deploy: `v2.20.0`
- Remote: `mikoton-target`

## Latest Deployment

- Commit before deploy: `486a217` (`Make front component token refresh best effort`)
- Previous version: `0.1.10`
- Published version: `0.1.11`
- Private publish: succeeded.
- Install/upgrade: succeeded.
- Tarball: `release-artifacts/mikoton-commercial-proposals-0.1.11.tgz`
- SHA-256: `7728ff6bbe398f68c1da4afeef8014d471551ff594744426a2f40e5c3d488988`
- Tarball validation: passed, manifest uses forward slashes and packaged logic functions exist.
- Repeated upgrade metadata check: navigation item and command menu item were not duplicated in the UI after repeated upgrades.

## Local Validation

Executed in WSL on 2026-07-13:

- `corepack yarn typecheck`: passed.
- `corepack yarn lint`: passed, 0 warnings and 0 errors.
- `corepack yarn test:unit`: passed, 2 files and 25 tests.
- `deploy.bat`: passed build, tarball validation, private publish and install/upgrade.

## Target API Smoke

Attempted with:

```bash
TWENTY_TEST_INSTANCE_MODE=target
TWENTY_API_URL=http://192.168.100.11:3000
TWENTY_API_KEY=<redacted>
corepack yarn test:target-smoke
```

Result: blocked.

Observed:

- GraphQL API key is valid for GraphQL operations.
- Direct app route probe
  `POST /s/commercial-proposals/opportunity-context` with the same API key
  returned HTTP `403` with an empty body.
- No target DRAFT was created through API-key app-route smoke.

Interpretation:

- API-key GraphQL access does not prove authenticated app-route access.
- Twenty `v2.20.0` app routes configured with `isAuthRequired: true` did not
  accept this API-key smoke path.

## Target UI Smoke

Executed in the in-app browser after the user signed in as a regular User.

Verified:

- Navigation item `Commercial Proposals` is visible.
- Opportunity list opens.
- Smoke Opportunity is visible:
  `[SMOKE] Phase3 UI Opportunity 2026-07-13T14-06-07-902Z`.
- Selecting exactly one Opportunity works; UI shows `1 выбрано`.
- Command menu item is visible:
  `Создать коммерческое предложение · Mikoton Commercial Proposals`.
- Front component opens from the command.
- UI displays title, fixed template and fixed language.

Blocked:

- Opportunity context did not load in the front component.
- Observed front component error after version `0.1.11`: `Error`.
- The component therefore displayed fallback values:
  - deal: selected Opportunity id;
  - company: `Компания не указана`;
  - amount: `Сумма не указана`.
- `Создать черновик` remained disabled.
- DRAFT creation from UI was not executed.
- Success state and `Открыть коммерческое предложение` were not verified.

## Fixed During This Smoke

- Command menu availability expression was corrected from a quoted string to
  SDK expression syntax.
- Front component route URL construction was updated for Worker execution.
- `TWENTY_API_URL` application variable was added to the app manifest.
- A target URL fallback was added because the application variable was present
  in the tarball manifest but was not available in the front component Worker at
  runtime.
- Front component route calls now attempt Twenty host token refresh and send
  `credentials: include`.

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

Blocker: the target front component opens, but authenticated context loading from
the Twenty App route still fails before a DRAFT can be created.
