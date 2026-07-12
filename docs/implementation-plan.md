# Implementation Plan

## Phase 0: Access and Validation

Goal: remove remaining uncertainty before app implementation.

Tasks:

1. Obtain workspace/admin credentials or app installation token for `http://192.168.100.11:3000/`.
2. Confirm app installation is allowed for the Mikoton workspace.
3. Run `create-twenty-app@2.20.0` in a separate app directory.
4. Confirm `twenty-sdk@2.20.0` can connect to the target server.
5. Run SDK typecheck/build against a minimal app.
6. Validate authenticated metadata sync plan without applying destructive changes.

Exit criteria:

- App can build.
- App can authenticate.
- SDK can inspect/sync against the target instance.

## Phase 1: Minimal Proposal App

Goal: install a safe minimal app with no external generation yet.

Tasks:

1. Define `CommercialProposal` custom object.
2. Define relations to `Company` and `Opportunity`.
3. Define default application role with read/create/update permissions.
4. Define list view and navigation item for proposals.
5. Add command menu item for Opportunity.
6. Add front component with a simple confirmation UI.
7. Add no-op logic function that creates a `CommercialProposal` draft.

Exit criteria:

- User can open an Opportunity and trigger proposal draft creation.
- Proposal record appears in Twenty.

## Phase 2: Document-Service Integration

Goal: generate real documents.

Tasks:

1. Define app/server variables for document-service URL and secret.
2. Implement payload normalization from Opportunity and Company.
3. Implement HTTP call to document-service.
4. Store `generating`, `generated`, and `failed` statuses.
5. Store response metadata and document links.
6. Implement idempotency.
7. Add retry-safe error handling.

Exit criteria:

- Opportunity command generates a document through document-service.
- Result is visible from the proposal record.

## Phase 3: Files and UX

Goal: make the workflow comfortable for sales users.

Tasks:

1. Test Twenty file upload from app/logic function.
2. If supported, attach DOCX/PDF to `CommercialProposal.files`.
3. Add Company command menu item.
4. Add record page component/widget if a persistent button is required.
5. Add template selection and generation options.
6. Add user-facing errors and progress states.

Exit criteria:

- Users can generate from Opportunity and Company contexts.
- Generated DOCX/PDF are accessible from Twenty.

## Phase 4: Hardening

Goal: production readiness.

Tasks:

1. Add tests for payload mapping.
2. Add tests for idempotency and error transitions.
3. Add permission checks.
4. Add audit fields and logging.
5. Add migration/upgrade notes for template and schema changes.
6. Document operational runbook.

Exit criteria:

- App is safe to install in production workspace.
- Failure modes are recoverable and observable.

## Known Risks

- Authenticated file upload path is not yet validated.
- Record page widget behavior must be tested on the real workspace.
- Direct `record action` API is not present in SDK `2.20.0`; command menu item is the confirmed replacement.
- Any existing customizations in the Mikoton workspace may affect layout sync.
