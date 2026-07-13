# Next Phase

Do not start document generation until Phase 2 is verified on the target
Workspace.

## Required Before Phase 3

1. Obtain a real API key for `http://192.168.100.11:3000`.
2. Create PostgreSQL and file/object storage backups.
3. Bump and commit the app patch version if publishing a new private version.
4. Run local private deployment:

   ```powershell
   $env:TWENTY_API_KEY = "<TWENTY_API_KEY>"
   .\scripts\deploy-private.ps1 -TwentyUrl "http://192.168.100.11:3000" -RemoteName "mikoton-target"
   ```

5. Run target backend smoke:

   ```powershell
   $env:TWENTY_TEST_INSTANCE_MODE = "target"
   $env:TWENTY_API_URL = "http://192.168.100.11:3000"
   $env:TWENTY_API_KEY = "<TWENTY_API_KEY>"
   yarn.cmd test:target-smoke
   ```

6. Run backend and UI smoke tests on the target Workspace.
7. Run restricted-user permission checks.
8. Publish/install a patch version and verify no metadata duplicates and data
   preservation.
9. Update `dry-run-report.md` and `smoke-test-report.md` with actual command
   output and created draft number.

## Phase 3 Candidate Work

Only after the above is complete:

- add document-service contract implementation;
- generate or fetch DOCX/PDF;
- store generation result metadata;
- set `generatedAt` after successful document generation;
- write files/URLs back to CommercialProposal.
