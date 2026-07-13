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
- `number` (`TEXT`, required): server-generated number in
  `CP-YYYYMMDD-HHmmss-XXXX` format.
- `status` (`SELECT`, required): `DRAFT`, `GENERATING`, `GENERATED`, `SENT`,
  `ACCEPTED`, `REJECTED`, `FAILED`, `CANCELLED`.
- `sourceType` (`SELECT`, required): currently only `OPPORTUNITY`.
- `templateCode` (`TEXT`, required): accepted request template code.
- `templateVersion` (`TEXT`, nullable): reserved for generation phase.
- `language` (`TEXT`, required): accepted request language, currently `ru-RU`.
- `payloadSnapshot` (`RAW_JSON`, nullable): minimal accepted source/template
  request snapshot.
- `resultMetadata` (`RAW_JSON`, nullable): reserved for generation result data.
- `amount` (`NUMBER`, nullable): decimal snapshot from Opportunity amount.
- `currency` (`TEXT`, nullable): currency code snapshot, defaults to `RUB`.
- `opportunity` (`RELATION`, required): many-to-one to standard Opportunity.
- `company` (`RELATION`, nullable): many-to-one to standard Company.
- `generatedAt` (`DATE_TIME`, nullable): document generation completion time.
  Draft records set it to `null`; Twenty `createdAt` is the draft creation time.
- `docxUrl` (`TEXT`, nullable): reserved for document-service phase.
- `pdfUrl` (`TEXT`, nullable): reserved for document-service phase.
- `files` (`FILES`, nullable): reserved for generated files.
- `idempotencyKey` (`TEXT`, required): client-generated request key.
- `lastError` (`TEXT`, nullable): reserved for future failure state.

## Amount Handling

Twenty `v2.20.0` exposes Opportunity amount as a currency object with
`amountMicros` and `currencyCode` through the Core API. The app maps
`amountMicros / 1_000_000` to decimal `amount` and stores `currencyCode`
separately.

`FieldType.CURRENCY` exists in `twenty-sdk@2.20.0`, but this app keeps
`NUMBER + currency` for the current field because changing an already-declared
`amount` field from `NUMBER` to `CURRENCY` may be a destructive metadata change
on an installed Workspace. This must be revisited only after a real metadata
plan proves the change is safe.

## Relations Added To Standard Objects

- Opportunity receives `commercialProposals` one-to-many relation.
- Company receives `commercialProposals` one-to-many relation.

These are app-owned metadata fields; Twenty core is not modified.

## Indexes

BTREE indexes are declared for:

- `number`, unique;
- `status`;
- `opportunity`;
- `company`;
- `idempotencyKey`, unique.

The unique `idempotencyKey` index is the concurrency guard. The logic function
still performs best-effort pre-read and read-after-conflict recovery so repeated
sequential and parallel requests return the existing draft where possible.

The unique `number` index protects the generated `CP-YYYYMMDD-HHmmss-XXXX`
number. The four-character suffix is generated server-side from browser/server
crypto when available, with a non-cryptographic fallback only for runtimes that
lack `crypto.getRandomValues`. The create path retries a small number of times
if a unique number conflict occurs.

## View And Navigation

- Workspace table view: `All Commercial Proposals`.
- Navigation item: `Commercial Proposals`.
- Command menu item: `Create commercial proposal`, available in Opportunity
  object context.
