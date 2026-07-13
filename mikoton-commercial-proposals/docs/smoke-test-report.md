# Smoke Test Report

Date: 2026-07-13.

## Target Instance

- URL: `http://192.168.100.11:3000`
- Expected Twenty version: `v2.20.0`
- Observed Twenty version during deploy: `v2.20.0`
- Remote: `mikoton-target`

## Local Phase 3.1 Validation

Executed in WSL on 2026-07-13:

- `corepack yarn typecheck`: passed.
- `corepack yarn lint`: passed, 0 warnings and 0 errors.
- `corepack yarn test:unit`: passed, 2 files and 22 tests.
- `bash scripts/build-wsl.sh`: passed.
- Tarball validation: passed.
- Manifest path validation: passed, forward slashes only.
- Compiled logic function check: passed.

## Deployment

First deployment attempt:

- Previous version: `0.1.2`.
- Bumped version: `0.1.3`.
- Build and private publish: succeeded.
- Install/upgrade: not reached because repeated tarball validation cleanup failed.
- Package version rollback: succeeded, restored to `0.1.2`.
- Fix committed: `8391692` (`Fix repeated tarball validation cleanup`).

Successful deployment:

- Previous version: `0.1.2`.
- Published version: `0.1.4`.
- Publish result: success.
- Install/upgrade result: success.
- Tarball: `release-artifacts/mikoton-commercial-proposals-0.1.4.tgz`.
- SHA-256: `e5308565e8fdd043336dc365e8eec3878a9f3e2ae9c8e5c272ed798e9c9f99dc`.

Repeated upgrade validation:

- Previous version: `0.1.4`.
- Published version: `0.1.5`.
- Publish result: success.
- Install/upgrade result: success.
- Tarball: `release-artifacts/mikoton-commercial-proposals-0.1.5.tgz`.
- SHA-256: `7cf28c57f41d68685476070d02c6807d0d6b6d93736bdb090bb268275e343227`.
- Release manifest:
  `release-artifacts/release-0.1.5.json`.
- Release manifest contains app name, version, commit SHA, tarball name,
  SHA-256, remote, published timestamp and install result.

The CLI reports installed version as requiring UI verification in
`Settings -> Applications`; that UI verification was not completed in this
session.

## Implemented UI Flow

The code implements:

- Opportunity command menu item `Создать коммерческое предложение`;
- single selected-record availability guard;
- front component title `Создать коммерческое предложение`;
- context loading from `/s/commercial-proposals/opportunity-context`;
- display of Opportunity, Company or `Компания не указана`, amount,
  `currencyCode`, fixed template and fixed language;
- submit button `Создать черновик` with disabled loading/submitting/success
  states;
- one operation-scoped UUID idempotency key;
- no non-UUID fallback for idempotency;
- safe setup error when `crypto.randomUUID` is unavailable;
- success state with draft number, title, status and button
  `Открыть коммерческое предложение`;
- draft route request in the `source/templateCode/language/idempotencyKey`
  format.

## Target API Smoke

Attempted on 2026-07-13 after installing `0.1.5`.

Command:

```bash
TWENTY_TEST_INSTANCE_MODE=target \
TWENTY_API_URL=http://192.168.100.11:3000 \
TWENTY_API_KEY=<redacted> \
corepack yarn test:target-smoke
```

Result: failed.

Observed behavior:

- GraphQL setup could create target smoke business records.
- Authenticated app routes under `/s/commercial-proposals/...` returned HTTP
  `403` before the logic function response body.
- Direct probe of `/s/commercial-proposals/opportunity-context` with the API key
  returned HTTP `403` and an empty body.

Interpretation:

- The target API key is accepted by GraphQL.
- The API key is not accepted by Twenty's authenticated app route layer for
  routes configured with `isAuthRequired: true`.
- Therefore backend route smoke cannot be marked passed with API-key auth alone.

No target draft was created through the app route in this session.

## Target UI Smoke

Attempted on 2026-07-13 in the in-app browser.

Result: blocked.

Observed page:

- URL: `http://192.168.100.11:3000/`
- Title: `Twenty`
- Visible login screen: `Добро пожаловать, Mikoton.`
- Visible field: `Электронная почта`

The browser did not have an authenticated Twenty user session. Manual UI smoke
cannot continue until a user signs in.

The following checks remain not verified:

- navigation item is visible after upgrade;
- Opportunity command menu item is visible;
- front component opens from an Opportunity;
- Opportunity context appears in the component;
- DRAFT creation succeeds from UI;
- created record opens from the success state;
- fields are correct: `status = DRAFT`, `sourceType = OPPORTUNITY`,
  `templateCode = standard-commercial-proposal`, `language = ru-RU`,
  `generatedAt = null`, `lastError = null`;
- relations to Opportunity and Company are correct;
- quick repeated UI click does not create a duplicate.

## Created Draft

None through the Phase 3 UI/app route in this session.

## Known Limitations From This Smoke

- API-key based GraphQL access does not prove authenticated app-route access.
- A browser user session is required to complete the actual user vertical slice.
- Restricted-user permission smoke was not executed; no separate restricted user
  session was available.
