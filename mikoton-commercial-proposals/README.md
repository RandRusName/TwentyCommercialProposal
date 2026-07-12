# Mikoton Commercial Proposals

Twenty App POC for creating a `CommercialProposal` draft from a selected
Opportunity in Twenty CRM.

Target Twenty instance: `http://192.168.100.11:3000`.

Verified target version: `v2.20.0`.

Pinned SDK packages:

- `twenty-sdk@2.20.0`
- `twenty-client-sdk@2.20.0`

## Scope

Implemented:

- custom `commercialProposal` object;
- relations to standard `opportunity` and `company`;
- navigation item for Commercial Proposals;
- Opportunity command menu item;
- front component for single-opportunity draft creation;
- authenticated logic functions for context loading and draft creation;
- idempotent draft creation at application layer.

Not implemented in this phase:

- DOCX/PDF generation;
- document-service call;
- file upload/storage flow;
- Company entry point;
- email sending;
- proposal items/templates.

## Local Checks

```powershell
yarn.cmd typecheck
yarn.cmd lint
yarn.cmd test:unit
yarn.cmd test
yarn.cmd twenty dev:build .
```

Remote metadata `plan/apply` requires an API key for the target Twenty
instance. See `docs/setup.md` and `docs/dry-run-report.md`.
