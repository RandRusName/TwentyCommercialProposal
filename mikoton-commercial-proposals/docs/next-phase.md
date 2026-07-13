# Next Phase

Do not start document generation until Phase 2 is verified on the target
Workspace.

## Required Before Phase 3

1. Obtain a real API key for `http://192.168.100.11:3000`.
2. Configure the remote:

   ```powershell
   $env:TWENTY_API_KEY = "<TWENTY_API_KEY>"
   yarn.cmd twenty remote:add --as mikoton-remote --url http://192.168.100.11:3000 --api-key $env:TWENTY_API_KEY
   ```

3. Run and review metadata plan:

   ```powershell
   yarn.cmd twenty plan -r mikoton-remote .
   ```

4. Stop if the plan contains destructive changes, unrelated object changes,
   page-layout replacement, or field type replacement.
5. Apply only after review:

   ```powershell
   yarn.cmd twenty apply -r mikoton-remote .
   yarn.cmd twenty app:install -r mikoton-remote .
   ```

6. Run backend and UI smoke tests on the target Workspace.
7. Repeat sync and repeat metadata plan to confirm no metadata duplicates or
   unexpected changes.
8. Update `dry-run-report.md` and `smoke-test-report.md` with actual command
   output and created draft number.

## Phase 3 Candidate Work

Only after the above is complete:

- add document-service contract implementation;
- generate or fetch DOCX/PDF;
- store generation result metadata;
- set `generatedAt` after successful document generation;
- write files/URLs back to CommercialProposal.
