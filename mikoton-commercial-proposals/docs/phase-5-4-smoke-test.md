# Prompt 5.4 Smoke Test

Date: 2026-07-21

## Release

- App version: `0.1.38`.
- Implementation commit: `a1d093c277ea7b4c0b4c32a29aab41dd8d600967`.
- Release commit: `27e9d56`.
- Target: `http://192.168.100.11:3000`, Twenty `v2.20.0`, remote `mikoton-target`.
- Private publish and install/upgrade: passed through `deploy.bat`.
- Release tarball: `mikoton-commercial-proposals-0.1.38.tgz`, 1,502,081 bytes.
- Tarball SHA-256: `e4c5010273abf6fc69e0564f133f2f193f15369cc5bd1dbd420aa1e32f1622f7`.
- Pre-deployment metadata plan: 29 additions, 11 app-owned changes, 0 destructive changes.
- Repeated metadata plan after install: no changes.

## Automated Verification

- Lint: passed with zero errors.
- Typecheck: passed.
- TypeScript unit tests: 110 passed across 6 files.
- Python document-service tests: 10 passed.
- Document-service Docker image: built successfully.
- WSL tarball build and manifest validation: passed.
- Template v2 local stress fixture: 20 work items, 8 stages, two PDF pages, no missing rows or stages.
- Local Microsoft Excel 16 check: XLSX opened without a repair warning.

## Target Catalog Smoke

- Native navigation item `Каталог работ и услуг`: visible.
- Native catalog list: visible with the configured nine columns.
- Created five `[SMOKE]` catalog records: three active RUB entries, one inactive RUB entry and one active USD entry.
- Authenticated catalog search returned only the three active RUB entries for the editor query.
- `activeOnly=false` returned all fixtures and marked the inactive item non-selectable.
- The editor picker displayed the same three active RUB entries and excluded the inactive and currency-mismatched entries.
- Three selected catalog entries were copied into new local proposal rows without an automatic save.
- Manual quantity editing remained available; saving produced `AGGREGATE_V2`, editor revision 2 and total `23500 RUB`.
- After save, one catalog price was changed and another catalog item was deactivated. Reloaded proposal rows retained the copied names and prices, and generation remained available. This confirms snapshot semantics.

## Target Generation Smoke

- Proposal ID: `bf0c0af3-919f-4355-9783-1fba635aa731`.
- Final number: `КП-013 от 21.07.2026`.
- Aggregate: 20 work items, 8 stages, amount `75458.60 RUB`.
- Proposal Company intentionally differed from Opportunity Company. The generated workbook used the exact Company related to the proposal.
- Aggregate save replay with the same `operationId` returned the canonical aggregate and kept exactly 20 items and 8 stages.
- Status transition: `DRAFT -> GENERATING -> GENERATED`.
- Generation ID: `79310a334182cb860caf630718c9f781`.
- Repeated generation with the same idempotency key returned the same generation ID and the same two Twenty file IDs; no duplicate attachments were created.
- The CommercialProposal Files tab visibly contained exactly two files: XLSX and PDF.

### Generated XLSX

- Size: 9,656 bytes.
- SHA-256: `90991346b5e5ac77ba28b82d6e6f0e046de35e0715dab76d2128fe02e6f18f6d`.
- Ordinary `.xlsx`, without VBA or macro-enabled content types.
- First work item at row 16 and twentieth work item at row 35.
- Grand total formula: `=SUM(I16:I65)`.
- Print area: `A1:I87`; repeated title row: 15; fit width: 1; fit height: 0.
- Microsoft Excel 16 opened the target-downloaded file read-only without an error or repair warning and exposed the expected cells, formulas and page settings.

### Generated PDF

- Size: 139,772 bytes.
- SHA-256: `53b5d6064907dff571d5bbf4519000927b4f89b6235d55c52d1fe35f8e73b525`.
- Valid `%PDF-` header and two pages.
- Extracted content included the proposal number, exact proposal Company, first and twentieth work items, and stage 8.
- Browser download controls were present for both generated formats. Active signed URLs are intentionally not recorded.

## Target Permissions Evidence

- Installed App version in Settings -> Applications: current and latest `0.1.38`.
- Application role UI showed read access granted for six objects, edit access for three, and delete access for two.
- Object-level table showed read-only access for `Companies` and `Opportunities`; `Commercial Proposals` had the app-owned read/edit permissions required by the flow.
- Catalog search, aggregate save, generation and attachment upload all succeeded under the installed application role.
- A separate restricted-user account was not available, so user-specific denial behavior was not marked passed.

## CI

- Workflow run: https://github.com/RandRusName/TwentyCommercialProposal/actions/runs/29817744537
- Validated commit: `d6bedcd98d3c1972f6d228f57ca608b866496e3d`.
- Result: passed on rerun attempt 2 after configuring the required repository secret `TWENTY_EPHEMERAL_API_KEY`.
- Passed steps: ephemeral Twenty/document-service startup, dependency install, lint, typecheck, unit tests, Python document-service tests, integration tests, app build, private tarball build and tarball validation.
- Twenty test image version: `v2.20.0`.
- The workflow did not contact the internal target and did not use its API key.

## Cleanup And Safety

- Target document-service source was backed up before replacement.
- Document-service `/healthz` and `/readyz` passed; readiness confirmed template, mapping, storage, PDF engine and writable temp storage.
- Twenty server reached document-service readiness over the shared Docker network.
- Target storage remained private MinIO/S3-compatible storage with expiring signed URLs.
- No App uninstall, destructive metadata cleanup, direct database access or Twenty core change was performed.
- No secret, API key or active signed URL is stored in this report.

## Remaining Limitation

Restricted-user UI/API denial needs a prepared non-admin test account. The application role itself is narrowed and operationally verified, but this is not a substitute for the separate-user scenario.
