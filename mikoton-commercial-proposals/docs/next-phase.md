# Next Phase

Do not start document generation until the Phase 3 vertical slice is verified on
the target Workspace.

## Required Before Phase 4

1. Commit the Phase 3 changes so `deploy.bat` can run against a clean working
   tree.
2. Run local private deployment:

   ```cmd
   deploy.bat
   ```

3. Confirm private publish and install/upgrade on
   `http://192.168.100.11:3000`.
4. Create or choose `[SMOKE]` Company and Opportunity records with amount and
   currency.
5. Open the Opportunity and run `Создать коммерческое предложение` from the
   command menu.
6. Verify the front component loads Opportunity, Company, amount and
   `currencyCode`.
7. Create a DRAFT and open the created CommercialProposal record.
8. Verify:

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

9. Repeat the same request with the same idempotency key through the backend
   smoke test and verify no duplicate draft is created.
10. Run allowed-user and restricted-user permission checks.
11. Update `docs/smoke-test-report.md` with the created draft number,
    screenshots if available, target smoke results and permission results.

## Phase 4 Candidate Work

Only after the above is complete:

- add document-service contract implementation;
- generate or fetch DOCX/PDF;
- store generation result metadata;
- set `generatedAt` after successful document generation;
- write files/URLs back to CommercialProposal.
