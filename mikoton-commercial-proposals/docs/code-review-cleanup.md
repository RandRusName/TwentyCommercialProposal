# Code Review Cleanup

Date: 2026-07-13.

Scope: review cleanup after Phase 3 auth-route fixes and Phase 4 document
generation foundation. Only the Twenty App repository was changed.

## Removed

- `scripts/deploy-private.ps1`
  - Reason: legacy Windows-side deployment path conflicted with the validated
    WSL-only production flow and could recreate Windows path separators in the
    app manifest.
  - Replacement: `deploy.bat`.
- Deprecated draft creation input contract with top-level `opportunityId`.
  - Reason: the UI, integration tests and documented contract now use
    `source.object/source.recordId/templateCode/language/idempotencyKey`.
  - Replacement: canonical `source` contract only.
- Local Python `__pycache__` directories.
  - Reason: generated test cache, not source.

## Refactored

- Logic function HTTP response handling.
  - Before: each route had its own `HTTP_STATUS_BY_ERROR_CODE`, JSON response
    helper and failure payload construction.
  - After: shared `src/logic-functions/http-response.ts`.

## Reviewed And Kept

- `document-service/`
  - Kept because it is the Phase 4 external generation worker boundary.
- `templates/mikoton-commercial-proposal-v1.xlsm`
  - Kept as the versioned template asset copied from the user-provided XLSM.
- `docs/template-analysis-v1.json`
  - Kept because it records the analyzed XLSM structure and preservation
    requirements.
- `.mjs.map` files in built tarballs
  - Not source-controlled. Twenty SDK `2.20.0` emits them during build.

## Deferred Candidates

- Split `src/domain/commercial-proposal.ts`.
  - It now contains draft creation and generation state-machine code. Splitting
    into `draft.ts`, `generation.ts` and shared `errors.ts` would reduce file
    size, but the current change kept behavior risk low before deployment.
- Replace mojibake-looking Russian literals in TypeScript files.
  - The UI currently renders correctly on target. A separate encoding cleanup
    should be done with target smoke screenshots before and after.
- Production document-service deployment and storage.
  - Still required before Phase 4 can be `READY FOR PHASE 5`.

