# Next Phase

Do not start document generation until the Phase 3 vertical slice is verified
with an authenticated user session on the target Workspace.

## Current State

- Phase 3 code is implemented.
- Private publish and install/upgrade succeeded for app version `0.1.5`.
- Repeated upgrade succeeded.
- API-key GraphQL access works for deployment and test data setup.
- API-key requests to authenticated `/s/...` app routes return HTTP `403`.
- Browser UI smoke is blocked at the Twenty login screen.

## Required Before Phase 4

1. Sign in to `http://192.168.100.11:3000` as an allowed test user in the browser.
2. Confirm the installed app version in `Settings -> Applications`.
3. Create or choose `[SMOKE]` Company and Opportunity records with amount and
   currency.
4. Open the Opportunity and run `Создать коммерческое предложение` from the
   command menu.
5. Verify the front component loads Opportunity, Company, amount and
   `currencyCode`.
6. Create a DRAFT and open the created CommercialProposal record.
7. Verify:

   - relation to Opportunity;
   - relation to Company when Company exists;
   - `generatedAt = null`;
   - `resultMetadata = null`;
   - `lastError = null`;
   - `sourceType = OPPORTUNITY`;
   - `templateCode = standard-commercial-proposal`;
   - `language = ru-RU`;
   - amount micros conversion;
   - source `currencyCode`.

8. Repeat the same request with the same idempotency key using an authenticated
   route call or UI retry scenario and verify no duplicate draft is created.
9. Run allowed-user and restricted-user permission checks when suitable users
   are available.
10. Update `docs/smoke-test-report.md` with the created draft number,
    screenshots if available, target smoke results and permission results.

## Phase 4 Candidate Work

Only after the above is complete:

- add document-service contract implementation;
- generate or fetch DOCX/PDF;
- store generation result metadata;
- set `generatedAt` after successful document generation;
- write files/URLs back to CommercialProposal.
