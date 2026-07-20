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
- `number` (`TEXT`, required): draft records use a technical `DRAFT-<idempotencyKey>` value; generated proposals use `КП-### от DD.MM.YYYY`.
- `status` (`SELECT`, required): `DRAFT`, `GENERATING`, `GENERATED`, `SENT`, `ACCEPTED`, `REJECTED`, `FAILED`, `CANCELLED`.
- `sourceType` (`SELECT`, required): currently only `OPPORTUNITY`.
- `templateCode` (`TEXT`, required): accepted request template code.
- `templateVersion` (`TEXT`, nullable): template version used by generation.
- `language` (`TEXT`, required): accepted request language, currently `ru-RU`.
- `payloadSnapshot` (`RAW_JSON`, nullable): immutable source/template/generation snapshot.
- `resultMetadata` (`RAW_JSON`, nullable): document generation result data, including XLSX/PDF storage metadata and Twenty file ids.
- `amount` (`NUMBER`, nullable): decimal snapshot from Opportunity amount.
- `currencyCode` (`TEXT`, nullable): currency code snapshot from Opportunity.
- `opportunity` (`RELATION`, required): many-to-one to standard Opportunity.
- `company` (`RELATION`, nullable): many-to-one to standard Company.
- `generatedAt` (`DATE_TIME`, nullable): document generation completion time. Draft records set it to `null`; Twenty `createdAt` is the draft creation time.
- `files` (`FILES`, nullable): app-owned generated XLSX/PDF files field.
- `idempotencyKey` (`TEXT`, required): client-generated draft creation request key.
- `lastError` (`TEXT`, nullable): safe failure message for failed generation.

Obsolete `docxUrl` and `pdfUrl` fields were removed from app metadata. DOCX is not generated. PDF is represented as a Twenty File attachment and as one item in `resultMetadata.files[]`.

## Amount Handling

Twenty `v2.20.0` exposes Opportunity amount as a currency object with `amountMicros` and `currencyCode` through the Core API. The app maps `amountMicros / 1_000_000` to decimal `amount` and stores `currencyCode` separately.

`FieldType.CURRENCY` exists in `twenty-sdk@2.20.0`, but this app keeps `NUMBER + currencyCode` for the current field because changing an already-declared `amount` field from `NUMBER` to `CURRENCY` may be a destructive metadata change on an installed Workspace. This must be revisited only after a real metadata plan proves the change is safe.

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

The unique `idempotencyKey` index is the concurrency guard for draft creation. The logic function still performs best-effort pre-read and read-after-conflict recovery so repeated sequential and parallel requests return the existing draft where possible.

The unique `number` index protects both technical draft numbers and final customer-facing numbers. Final numbers use a yearly `001..999` sequence and the Moscow date of document generation, for example `КП-005 от 17.07.2026`. Generation retries a small number of times if a concurrent update hits the unique number index. Existing legacy `CP-YYYYMMDD-HHmmss-XXXX` records are not rewritten automatically.

Generated XLSX/PDF files are uploaded to Twenty and attached to the CommercialProposal through standard Attachment records so they appear in the record `Files` tab. The upload is performed against the standard `Attachment.file` field and then linked with `targetCommercialProposalId`. `resultMetadata.files[]` also keeps the document-service storage key, checksum, and Twenty file id/url for audit and download UI.

## View And Navigation

- Workspace table view: `All Commercial Proposals`.
- Navigation item: `Commercial Proposals`.
- Command menu item: `Create commercial proposal`, available in Opportunity object context.
- Command menu item: `Generate commercial proposal`, available in CommercialProposal context for `DRAFT` and `FAILED` records.

The default app view exposes business fields only. JSON/debug fields remain stored for audit but are not part of the default list view. Twenty `v2.20.0` may still show stored fields in the record field settings picker.

## Prompt 5.1 Aggregate Backend Additions

Prompt 5.1 adds additive metadata only. Existing field universal identifiers,
`amount` FieldType/nullability, current Files/result fields, and current
Opportunity/Company relations are not changed.

### CommercialProposal fields

- `version` (`NUMBER`, required, decimals 0, default `1`): business proposal version.
- `contentModelVersion` (`SELECT`, required, default `LEGACY_V1`): `LEGACY_V1` or `AGGREGATE_V2`.
- `editorRevision` (`NUMBER`, required, decimals 0, default `1`): best-effort optimistic concurrency marker.
- `lastEditorOperationId` (`TEXT`, nullable): last completed aggregate editor save operation id.
- `contactName` (`TEXT`, nullable).
- `contextAndGoal` (`TEXT`, nullable, multiline).
- `validityDays` (`NUMBER`, required, decimals 0, default `14`).
- `paymentTerms` (`TEXT`, nullable, multiline).
- `assumptions` (`TEXT`, nullable, multiline).
- `nextStep` (`TEXT`, nullable, multiline).
- `items` (`RELATION`, one-to-many to `commercialProposalItem`).
- `stages` (`RELATION`, one-to-many to `commercialProposalStage`).

`amount` is model-version dependent:

- `LEGACY_V1`: legacy snapshot / historical value, often copied from Opportunity amount.
- `AGGREGATE_V2`: server-calculated `SUM(CommercialProposalItem.lineAmount)`.

### CommercialProposalItem

- `commercialProposal` (`RELATION`, required, many-to-one).
- `clientKey` (`TEXT`, required): UUID from the editor client for replay-safe upsert.
- `sortOrder` (`NUMBER`, required, decimals 0): server-normalized order. The editor API exposes this value as `position`.
- `block` (`TEXT`, required).
- `name` (`TEXT`, required).
- `description` (`TEXT`, nullable).
- `quantity` (`NUMBER`, required, decimals 4).
- `unit` (`TEXT`, required).
- `unitPrice` (`NUMBER`, required, decimals 2).
- `discountPercent` (`NUMBER`, required, decimals 2).
- `lineAmount` (`NUMBER`, required, decimals 2): server-calculated.
- `currencyCode` (`TEXT`, required).

No `catalogItem` relation is added in Prompt 5.1.

### CommercialProposalStage

- `commercialProposal` (`RELATION`, required, many-to-one).
- `clientKey` (`TEXT`, required): UUID from the editor client for replay-safe upsert.
- `sortOrder` (`NUMBER`, required, decimals 0): server-normalized order. The editor API exposes this value as `position`.
- `title` (`TEXT`, required).
- `result` (`TEXT`, nullable): required later by schema `2.0` generation.
- `duration` (`TEXT`, nullable): required later by schema `2.0` generation.
- `description` (`TEXT`, nullable).

### Aggregate routes

- `POST /s/commercial-proposals/:id/editor-context`
- `POST /s/commercial-proposals/:id/save-editor`
- `POST /s/commercial-proposals/:id/recalculate`

Prompt 5.1 uses application-level parent + `clientKey` lookup/upsert for
replay safety. It does not claim database-level compound uniqueness.
