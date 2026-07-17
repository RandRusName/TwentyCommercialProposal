# Next Phase

## Current State

- Phase 3 is verified on the target Workspace.
- Phase 4 local implementation has started:
  - versioned XLSM template asset;
  - declarative mapping v1;
  - document-service generator;
  - XLSX/PDF local generation tests;
  - Twenty generation command/front component/logic function.

## Required Before Phase 5

1. Deploy document-service where the Twenty server can reach it.
2. Configure `DOCUMENT_SERVICE_URL` and `DOCUMENT_SERVICE_SECRET` for the app.
3. Configure production storage for generated files.
4. Replace or extend ReportLab PDF output with Excel/LibreOffice/Excel COM
   print-area export.
5. Deploy the updated Twenty App through `deploy.bat`.
6. Run target UI smoke:
   - create DRAFT from Opportunity;
   - open CommercialProposal;
   - run `Сформировать документ`;
   - verify `GENERATED`, `generatedAt`, `resultMetadata`, XLSX and PDF.
7. Open generated XLSX in Microsoft Excel and confirm it opens normally.
8. Open generated PDF and visually check it against the XLSX layout.
9. Run retry/idempotency check.
10. Update `docs/phase-4-smoke-test.md` with factual results.

## Not In Scope Yet

- visual template editor;
- arbitrary template upload through UI;
- regenerate/version history;
- email sending;
- approval workflow;
- e-signature.
