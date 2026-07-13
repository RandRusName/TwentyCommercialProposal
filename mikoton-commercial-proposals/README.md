# Mikoton Commercial Proposals

Twenty App for creating a `CommercialProposal` draft from a selected
Opportunity in Twenty CRM.

Target Twenty instance: `http://192.168.100.11:3000`.

Target server and SDK versions:

- Twenty Server: `v2.20.0`
- `twenty-sdk@2.20.0`
- `twenty-client-sdk@2.20.0`

## Scope

Implemented in this phase:

- custom `commercialProposal` object;
- relations to standard `opportunity` and `company`;
- navigation item for Commercial Proposals;
- Opportunity command menu item;
- front component for single-opportunity draft creation;
- authenticated logic functions for context loading and draft creation;
- server-side draft numbering in `CP-YYYYMMDD-HHmmss-XXXX` format;
- required `idempotencyKey` with unique metadata index and conflict recovery;
- structured application errors;
- draft metadata fields for source, template, language and payload snapshot.

Not implemented in this phase:

- DOCX/PDF generation;
- document-service call;
- generated file upload/storage flow;
- Company entry point;
- record-page widget;
- proposal items;
- CPQ features.

## Local Checks

Use `yarn.cmd` on Windows PowerShell if script execution blocks `yarn.ps1`.

```powershell
yarn.cmd install --immutable
yarn.cmd lint
yarn.cmd typecheck
yarn.cmd test:unit
yarn.cmd test
yarn.cmd twenty dev:build .
```

Remote metadata `plan/apply` and UI smoke require an API key for the target
Twenty instance. The app must not be considered ready for Phase 3 until those
checks are run and documented in `docs/dry-run-report.md` and
`docs/smoke-test-report.md`.
