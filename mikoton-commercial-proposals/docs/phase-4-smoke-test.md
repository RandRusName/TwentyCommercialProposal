# Phase 4 Smoke Test

Status: not executed on target Twenty for the current Phase 4 build.

## Local Verification

Date: 2026-07-17

- TypeScript unit tests: passed locally.
- Python document-service tests: passed locally.
- Docker build: passed locally.
- Container `/healthz`: passed locally.
- Container `/readyz`: passed locally with LibreOffice available.

## Target Prerequisites

- Phase 3 vertical slice is verified.
- Document-service is deployed where Twenty server can reach it.
- MinIO/S3-compatible storage is reachable.
- `DOCUMENT_SERVICE_URL=http://document-service:8010` is configured.
- `DOCUMENT_SERVICE_SECRET` is configured as a server-side secret.
- Twenty container can run:

```bash
curl http://document-service:8010/healthz
curl http://document-service:8010/readyz
```

## Target Steps

1. Open an Opportunity.
2. Create a `CommercialProposal` DRAFT.
3. Open the created CommercialProposal.
4. Run `Сформировать документ`.
5. Verify status changes to `GENERATING`.
6. Wait for `GENERATED`.
7. Verify `generatedAt` is set.
8. Verify `resultMetadata.files` contains XLSM and PDF.
9. Download XLSM.
10. Open XLSM in Microsoft Excel.
11. Confirm Excel does not show a repair warning.
12. Confirm VBA, the `Сохранить PDF` button, drawings and printer settings are preserved.
13. Check mapped cells, formulas and total.
14. Download PDF.
15. Verify PDF comes from the XLSM layout and has no obvious clipping or extra blank pages.
16. Retry the same generation request key and confirm the same `generationId` and storage keys.
17. Force a temporary PDF/storage failure, verify `FAILED`, retry, verify `GENERATED`.

## Current Target Result

Not executed yet for this build.

Current blocker before `READY FOR PHASE 5`:

```text
target smoke
```

