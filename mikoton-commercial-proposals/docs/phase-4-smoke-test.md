# Phase 4 Smoke Test

Status: not executed on target Twenty yet.

## Prerequisites

- Phase 3 vertical slice is verified.
- Document-service is deployed where Twenty server can reach it.
- `DOCUMENT_SERVICE_URL` application variable is set.
- `DOCUMENT_SERVICE_SECRET` application variable is set.
- Production storage is configured, or local `file://` URLs are explicitly
  accepted for a development-only smoke.

## Steps

1. Open an Opportunity.
2. Create a `CommercialProposal` DRAFT.
3. Open the created CommercialProposal.
4. Run `Сформировать документ`.
5. Verify status changes to `GENERATING`.
6. Wait for `GENERATED`.
7. Verify `generatedAt` is set.
8. Verify `resultMetadata.files` contains XLSM and PDF.
9. Download/open XLSM in Microsoft Excel.
10. Confirm Excel does not show a repair warning.
11. Check mapped cells and formulas.
12. Open PDF and visually compare against the template.
13. Retry the same generation request key and confirm no duplicate files.

## Current Blockers

- Target document-service deployment has not been performed.
- Target application variables for document-service are not configured.
- PDF is currently ReportLab payload PDF, not Excel print-area export.
- Production storage is not configured.

