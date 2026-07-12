# Metadata Model

## Custom Object

`commercialProposal`

- label: `Commercial Proposal`
- UI creatable: `false`
- UI editable: `true`
- searchable: `true`
- label field: `title`

## Fields

- `title` (`TEXT`, required): record label.
- `number` (`TEXT`, required): generated draft number, format `CP-YYYYMMDD-HHMMSS`.
- `status` (`SELECT`, required): `DRAFT`, `GENERATED`, `FAILED`.
- `amount` (`NUMBER`, nullable): snapshot from Opportunity amount.
- `currency` (`TEXT`, nullable): snapshot from Opportunity currency, defaults to `RUB`.
- `opportunity` (`RELATION`, required): many-to-one to standard Opportunity.
- `company` (`RELATION`, nullable): many-to-one to standard Company.
- `generatedAt` (`DATE_TIME`, nullable): draft creation time.
- `docxUrl` (`TEXT`, nullable): reserved for document-service phase.
- `pdfUrl` (`TEXT`, nullable): reserved for document-service phase.
- `files` (`FILES`, nullable): reserved for generated files.
- `idempotencyKey` (`TEXT`, nullable): client-generated dedupe key.
- `lastError` (`TEXT`, nullable): reserved for future failure state.

## Relations Added To Standard Objects

- Opportunity receives `commercialProposals` one-to-many relation.
- Company receives `commercialProposals` one-to-many relation.

These are app-owned metadata fields; Twenty core is not modified.

## Indexes

Non-unique BTREE indexes are declared for:

- `number`
- `status`
- `opportunity`
- `company`
- `idempotencyKey`

Uniqueness is intentionally not enforced at metadata level in this POC. Duplicate
prevention is handled by the logic function using `idempotencyKey`.

## View And Navigation

- Workspace table view: `All Commercial Proposals`.
- Navigation item: `Commercial Proposals`.
- Command menu item: `Create commercial proposal`, available in Opportunity
  object context.
