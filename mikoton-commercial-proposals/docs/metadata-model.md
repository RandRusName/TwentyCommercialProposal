# Metadata Model

## CatalogItem (Prompt 5.4)

`CatalogItem` is searchable and native-UI creatable/editable. It stores reusable defaults (`itemType`, category, block, description, unit, price, currency, active flag and sort order). `CommercialProposalItem.catalogItem` is a nullable many-to-one relation with no cascade semantics. Four non-unique BTREE indexes cover active state, order, type and currency.

## Custom Object

`commercialProposal`

- label: `Commercial Proposal`
- UI creatable: `false`
- UI editable: `true`
- searchable: `true`
- label field: `title`

## Fields

- `title` (`TEXT`, required): record label.
- `number` (`TEXT`, required, UI read-only): new draft records use `Черновик`; generated proposals use `КП-### от DD.MM.YYYY`. Old `DRAFT-<idempotencyKey>` values are rendered as `Черновик` by the app UI.
- `status` (`SELECT`, required): `DRAFT`, `GENERATING`, `GENERATED`, `SENT`, `ACCEPTED`, `REJECTED`, `FAILED`, `CANCELLED`.
- `sourceType` (`SELECT`, required): currently only `OPPORTUNITY`.
- `templateCode` (`TEXT`, required): accepted request template code.
- `templateVersion` (`TEXT`, nullable): template version used by generation.
- `language` (`TEXT`, required): accepted request language, currently `ru-RU`.
- `payloadSnapshot` (`RAW_JSON`, nullable): immutable source/template/generation snapshot.
- `resultMetadata` (`RAW_JSON`, nullable): document generation result data, including XLSX/PDF storage metadata and Twenty file ids.
- `amount` (`NUMBER`, nullable, UI read-only): new `AGGREGATE_V2` drafts start at `0`; after item saves it is the server-calculated aggregate. Only legacy records may retain an Opportunity snapshot.
- `currencyCode` (`TEXT`, nullable): currency code snapshot from Opportunity.
- `opportunity` (`RELATION`, required): many-to-one to standard Opportunity.
- `company` (`RELATION`, nullable): many-to-one to standard Company.
- `generatedAt` (`DATE_TIME`, nullable): document generation completion time. Draft records set it to `null`; Twenty `createdAt` is the draft creation time.
- `files` (`FILES`, nullable): app-owned generated XLSX/PDF files field.
- `idempotencyKey` (`TEXT`, required): client-generated draft creation request key.
- `lastError` (`TEXT`, nullable): safe failure message for failed generation.
- `finalNumberKey` (`TEXT`, nullable, UI read-only): unique reservation in
  `YYYY:NNN` format. Drafts and historical records may remain `null`.

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

- `status`;
- `opportunity`;
- `company`;
- `idempotencyKey`, unique.
- `finalNumberKey`, unique. PostgreSQL unique-index semantics allow multiple
  `NULL` values, so any number of drafts can coexist without a final number.

The unique `idempotencyKey` index is the concurrency guard for draft creation. The logic function still performs best-effort pre-read and read-after-conflict recovery so repeated sequential and parallel requests return the existing draft where possible.

New drafts share the business label `Черновик`, so `number` is intentionally
non-unique. Final numbers use a yearly `001..999` sequence and the Moscow date
of generation, for example `КП-005 от 17.07.2026`. Uniqueness is enforced by
the `finalNumberKey` unique index; allocation retries a bounded number of times
after a duplicate conflict. Existing final numbers are backfilled through the
official API after duplicate validation; draft and legacy technical numbers are
not rewritten.

Generated XLSX/PDF files are uploaded to Twenty and attached to the CommercialProposal through standard Attachment records so they appear in the record `Files` tab. The upload is performed against the standard `Attachment.file` field and then linked with `targetCommercialProposalId`. `resultMetadata.files[]` also keeps the document-service storage key, checksum, and Twenty file id/url for audit and download UI.

## View And Navigation

- Workspace table view: `All Commercial Proposals`.
- Navigation item: `Commercial Proposals`.
- Command menu item: `Create commercial proposal`, available in Opportunity object context.
- Command menu item: `Generate commercial proposal`, available in CommercialProposal context for `DRAFT` and `FAILED` records.
- App-owned `RECORD_PAGE`: Home is a full-width editor front component; Timeline, Tasks, Notes and Files use native widgets. There is no generic `FIELDS` widget.
- The default list opens records in `RECORD_PAGE`, not a side panel.
- Command menu item: `Открыть карточку КП`, available when exactly one CommercialProposal is selected. Editable statuses are enforced server-side; historical statuses open read-only.

The default app view and record page expose business information only. JSON/debug fields remain stored for audit but are absent from the business layout and marked UI read-only where the SDK supports it. Twenty `v2.20.0` may still show stored fields in the administrative field settings picker.

## Prompt 5.1 Aggregate Backend Additions

Prompt 5.1 adds additive metadata only. Existing field universal identifiers,
`amount` FieldType/nullability, current Files/result fields, and current
Opportunity/Company relations are not changed.

### CommercialProposal fields

- `version` (`NUMBER`, required, decimals 0, default `1`): business proposal version.
- `contentModelVersion` (`SELECT`, required, default `AGGREGATE_V2`, UI read-only): `LEGACY_V1` or `AGGREGATE_V2`. Repository fallback for old records with a missing value remains `LEGACY_V1`.
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

Prompt 5.2 adds no business objects or fields. Its only metadata additions are
the editor front component and command menu item.
