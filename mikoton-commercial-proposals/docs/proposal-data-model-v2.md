# Commercial Proposal Data Model v2

## 1. Context

The current Twenty App creates `CommercialProposal` records from `Opportunity` and can generate XLSX/PDF documents through the external document-service. Phase 3 is complete. Phase 4 foundation exists and uses a versioned template mapping, server-side generation route, status transitions, generated file attachments, and result metadata.

This document designs the next data model only. It does not introduce metadata, universal identifiers, production code, deployment, or template changes.

## 2. Problem

`Opportunity` is a short sales forecast card, for example:

```text
Name = Сделать бота
Amount = 120000 RUB
```

The current generation payload turns that into one artificial work item and one artificial plan stage:

```text
Work item = draft title, quantity 1, unit project, rate Opportunity.amount
Plan stage = Согласование и старт
```

Real commercial proposals need a first-class aggregate:

```text
CommercialProposal
├── CommercialProposalItem[]
└── CommercialProposalStage[]
```

The current model also mixes sales forecast, proposal total, work composition, draft request snapshot, and generation snapshot in the same fields.

## 3. Current Model

### Opportunity

| Field | Type | Nullable | Source of truth | Current usage |
|---|---|---:|---|---|
| `id` | UUID | no | Twenty standard object | Source record for draft creation |
| `name` | TEXT | yes | Sales user | Draft title and generated context text |
| `amount.amountMicros` | CURRENCY internals | yes | Sales forecast | Converted to decimal and copied to `CommercialProposal.amount` |
| `amount.currencyCode` | CURRENCY internals | yes | Sales forecast | Copied to `CommercialProposal.currencyCode` |
| `company` | relation | yes | Sales data | Copied to proposal relation and document customer |

`Opportunity.amount` currently means expected deal value, not exact proposal total.

### Company

| Field | Type | Nullable | Current usage |
|---|---|---:|---|
| `id` | UUID | no | Related customer for proposal |
| `name` | TEXT | yes | Customer company name in UI and generated document |

### CommercialProposal

| Field | Type | Nullable | Default / current behavior | Current usage |
|---|---|---:|---|---|
| `title` | TEXT | no | Draft: `Черновик КП - <Opportunity>`; generated: `<number> - <Opportunity>` | Label field and document title |
| `number` | TEXT | no | Draft: `DRAFT-<idempotencyKey>`; generated: `КП-### от DD.MM.YYYY` | Proposal number |
| `status` | SELECT | no | `DRAFT` | Lifecycle |
| `sourceType` | SELECT | no | `OPPORTUNITY` | Source marker |
| `templateCode` | TEXT | no | Draft app code, then `mikoton-commercial-proposal` | Generation template |
| `templateVersion` | TEXT | yes | `null`, then `1` | Generation template version |
| `language` | TEXT | no | `ru-RU` | Generation payload |
| `payloadSnapshot` | RAW_JSON | yes | Draft request, later generation payload | Mixed technical snapshot |
| `resultMetadata` | RAW_JSON | yes | `null`, then generated file metadata | Generated artifacts |
| `amount` | NUMBER(2) | yes | Opportunity amount snapshot | Currently used as the single work item rate |
| `currencyCode` | TEXT | yes | Opportunity currency | Currency for generated proposal |
| `opportunity` | relation | no | Source opportunity | Link back to sales opportunity |
| `company` | relation | yes | Opportunity company | Customer relation |
| `generatedAt` | DATE_TIME | yes | `null`, then success timestamp | Generation completion |
| `files` | FILES | yes | generated XLSX/PDF | Twenty Files tab and attachments |
| `idempotencyKey` | TEXT | no | UI operation UUID | Draft idempotency |
| `lastError` | TEXT | yes | `null`, then safe error | Failure display |

Known limitations:

- There are no work item or stage records.
- `amount` is not a calculated proposal total.
- `payloadSnapshot` is used for both draft creation input and immutable generation payload.
- Generated schema v1 is limited by template v1 to 5 work items and 1-3 stages.
- Current generated Excel artifact is XLSX/PDF. The source template may be XLSM, but production output is macro-free XLSX.

## 4. Target Model

```text
Company
└── Opportunity
    └── CommercialProposal
        ├── CommercialProposalItem[]
        └── CommercialProposalStage[]
```

Future-compatible extension:

```text
CatalogItem
└── optional CommercialProposalItem.catalogItem
```

## 5. ER Diagram

```mermaid
erDiagram
  OPPORTUNITY ||--o{ COMMERCIAL_PROPOSAL : has
  COMPANY ||--o{ COMMERCIAL_PROPOSAL : customer
  COMMERCIAL_PROPOSAL ||--o{ COMMERCIAL_PROPOSAL_ITEM : contains
  COMMERCIAL_PROPOSAL ||--o{ COMMERCIAL_PROPOSAL_STAGE : plans
  CATALOG_ITEM o|--o{ COMMERCIAL_PROPOSAL_ITEM : sourced_from
```

## 6. Entity Definitions

### CommercialProposal

`CommercialProposal` is the aggregate root. It owns business header fields, customer context, commercial terms, generated artifacts, and lifecycle status.

| Field | FieldType | Nullable | Default | Editable states | Source of truth | Reuse | Technical |
|---|---|---:|---|---|---|---:|---:|
| `title` | TEXT | no | from Opportunity name | DRAFT, FAILED | User/editor | yes | no |
| `number` | TEXT | no | technical draft number | generated once before generation | Numbering service | yes | no |
| `version` | NUMBER | no | `1` | system only | Proposal version marker | new | yes |
| `editorRevision` | NUMBER | no | `1` | system only | Optimistic concurrency | new | yes |
| `status` | SELECT | no | `DRAFT` | system transitions | Lifecycle | yes | no |
| `sourceType` | SELECT | no | `OPPORTUNITY` | read-only | Source marker | yes | yes |
| `opportunity` | RELATION | no | source Opportunity | read-only after create | Source link | yes | no |
| `company` | RELATION | yes | Opportunity company | DRAFT, FAILED | Customer link | yes | no |
| `contactName` | TEXT | yes | `null` | DRAFT, FAILED | User/editor | new | no |
| `contextAndGoal` | TEXT | yes | suggested from Opportunity | DRAFT, FAILED | User/editor | new | no |
| `currencyCode` | TEXT | no when items exist | Opportunity currency or user selected | DRAFT, FAILED | Proposal header | yes | no |
| `validityDays` | NUMBER | no | `14` | DRAFT, FAILED | Proposal header | new | no |
| `paymentTerms` | TEXT | yes | configured default | DRAFT, FAILED | User/editor | new | no |
| `assumptions` | TEXT | yes | configured default | DRAFT, FAILED | User/editor | new | no |
| `nextStep` | TEXT | yes | configured default | DRAFT, FAILED | User/editor | new | no |
| `amount` | NUMBER(2) | no | `0` | recalculated by server | Sum of item line amounts | yes | no |
| `templateCode` | TEXT | no | `mikoton-commercial-proposal` | DRAFT, FAILED | Template selector/config | yes | yes |
| `templateVersion` | TEXT | yes | `2` for v2 generation | system | Template resolver | yes | yes |
| `language` | TEXT | no | `ru-RU` | DRAFT, FAILED | Proposal header | yes | no |
| `payloadSnapshot` | RAW_JSON | yes | `null` | generation only | Immutable generation snapshot | yes | yes |
| `resultMetadata` | RAW_JSON | yes | `null` | generation only | Generated artifacts metadata | yes | yes |
| `generatedAt` | DATE_TIME | yes | `null` | generation only | Generation completion | yes | no |
| `files` | FILES | yes | `null` | generation only | Generated file attachments | yes | no |
| `idempotencyKey` | TEXT | no | draft operation UUID | read-only | Draft idempotency | yes | yes |
| `lastError` | TEXT | yes | `null` | system | Safe failure message | yes | yes |

Decision: reuse `amount` as the materialized exact proposal total. Do not add `totalAmount`.

### CommercialProposalItem

`CommercialProposalItem` is a priced line in the proposal. It is the source of truth for work composition and price.

| Field | FieldType | Nullable | Default | Validation | Index | Relation |
|---|---|---:|---|---|---|---|
| `commercialProposal` | RELATION | no | parent | required | yes | many-to-one |
| `position` | NUMBER | no | server normalized | integer `>= 1` | yes | none |
| `block` | TEXT | no | `Работы` or user value | non-empty | optional | none |
| `name` | TEXT | no | empty | non-empty | optional searchable | none |
| `description` | TEXT | yes | `null` | required before generation if `name` insufficient | no | none |
| `quantity` | NUMBER | no | `1` | `> 0`, up to 4 decimals | no | none |
| `unit` | TEXT | no | `час` or `проект` | non-empty | no | none |
| `unitPrice` | NUMBER | no | `0` | `>= 0`, 2 decimals | no | none |
| `discountPercent` | NUMBER | no | `0` | `0..100`, 2 decimals | no | none |
| `lineAmount` | NUMBER | no | calculated | server-calculated, 2 decimals | no | none |
| `currencyCode` | TEXT | no | parent currency | equals parent currency | no | none |
| `catalogItem` | RELATION | yes | `null` | future only | optional | many-to-one to future CatalogItem |

`lineAmount` is stored physically for list views, generation, sorting, and audit readability, but it is never trusted from UI. The server recalculates it on every aggregate save.

### CommercialProposalStage

`CommercialProposalStage` is a delivery plan row. It is independent from priced work items.

| Field | FieldType | Nullable | Default | Validation | Index | Relation |
|---|---|---:|---|---|---|---|
| `commercialProposal` | RELATION | no | parent | required | yes | many-to-one |
| `position` | NUMBER | no | server normalized | integer `>= 1` | yes | none |
| `title` | TEXT | no | empty | non-empty | optional searchable | none |
| `result` | TEXT | no | empty | non-empty before generation | no | none |
| `duration` | TEXT | no | empty | non-empty before generation | no | none |
| `description` | TEXT | yes | `null` | optional | no | none |

### Future CatalogItem

Do not implement in the first v2 delivery. Design for a nullable relation:

| Field | FieldType | Notes |
|---|---|---|
| `name` | TEXT | Display name |
| `type` | SELECT | Service/product/etc. |
| `category` | TEXT or SELECT | Grouping |
| `description` | TEXT | Default description |
| `defaultUnit` | TEXT | Copied to item |
| `defaultPrice` | NUMBER(2) | Copied to item |
| `currencyCode` | TEXT | Copied to item |
| `isActive` | BOOLEAN | Hide inactive from picker |
| `sortOrder` | NUMBER | Picker ordering |

Snapshot rule: selecting a `CatalogItem` copies values into `CommercialProposalItem`. Later catalog changes do not mutate old proposals.

## 7. Field Matrix

| Entity | Field | FieldType | Nullable | Default | Index | Relation |
|---|---|---|---:|---|---|---|
| CommercialProposal | `amount` | NUMBER(2) | no | `0` | optional | none |
| CommercialProposal | `currencyCode` | TEXT | conditional | Opportunity currency | optional | none |
| CommercialProposal | `version` | NUMBER | no | `1` | no | none |
| CommercialProposal | `editorRevision` | NUMBER | no | `1` | no | none |
| CommercialProposal | `contactName` | TEXT | yes | `null` | no | none |
| CommercialProposal | `contextAndGoal` | TEXT | yes | suggested | no | none |
| CommercialProposal | `validityDays` | NUMBER | no | `14` | no | none |
| CommercialProposal | `paymentTerms` | TEXT | yes | default | no | none |
| CommercialProposal | `assumptions` | TEXT | yes | default | no | none |
| CommercialProposal | `nextStep` | TEXT | yes | default | no | none |
| CommercialProposalItem | `commercialProposal` | RELATION | no | parent | yes | CP 1:N |
| CommercialProposalItem | `position` | NUMBER | no | normalized | yes | none |
| CommercialProposalItem | `block` | TEXT | no | `Работы` | no | none |
| CommercialProposalItem | `name` | TEXT | no | empty | optional | none |
| CommercialProposalItem | `description` | TEXT | yes | `null` | no | none |
| CommercialProposalItem | `quantity` | NUMBER(4) | no | `1` | no | none |
| CommercialProposalItem | `unit` | TEXT | no | `час` | no | none |
| CommercialProposalItem | `unitPrice` | NUMBER(2) | no | `0` | no | none |
| CommercialProposalItem | `discountPercent` | NUMBER(2) | no | `0` | no | none |
| CommercialProposalItem | `lineAmount` | NUMBER(2) | no | calculated | no | none |
| CommercialProposalItem | `currencyCode` | TEXT | no | parent currency | no | none |
| CommercialProposalStage | `commercialProposal` | RELATION | no | parent | yes | CP 1:N |
| CommercialProposalStage | `position` | NUMBER | no | normalized | yes | none |
| CommercialProposalStage | `title` | TEXT | no | empty | optional | none |
| CommercialProposalStage | `result` | TEXT | no | empty | no | none |
| CommercialProposalStage | `duration` | TEXT | no | empty | no | none |
| CommercialProposalStage | `description` | TEXT | yes | `null` | no | none |

## 8. Relation Matrix

| From | To | Cardinality | Ownership | Delete behavior |
|---|---|---|---|---|
| Opportunity | CommercialProposal | 1:N | Opportunity is source, not owner | Deleting Opportunity should not silently delete proposals; proposal becomes inaccessible only if Twenty relation requires it |
| Company | CommercialProposal | 1:N | Company is customer link | Deleting Company should null proposal company if supported, otherwise block/manual review |
| CommercialProposal | CommercialProposalItem | 1:N | Proposal owns items | Deleting proposal may delete items only through app-managed cleanup; avoid target destructive cleanup without explicit operator action |
| CommercialProposal | CommercialProposalStage | 1:N | Proposal owns stages | Same as items |
| CatalogItem | CommercialProposalItem | 0/1:N | Catalog is reference only | Archiving catalog does not change item snapshot |

## 9. Lifecycle

| Status | Header editable | Items editable | Stages editable | Can generate | Notes |
|---|---:|---:|---:|---:|---|
| `DRAFT` | yes | yes | yes | yes | Normal editor state |
| `FAILED` | yes | yes | yes | yes | Retry allowed after correction |
| `GENERATING` | no | no | no | no | Read-only, generation in progress |
| `GENERATED` | no | no | no | no | Read-only artifact state |
| `SENT` | no | no | no | no | Sent document must remain stable |
| `ACCEPTED` | no | no | no | no | Accepted document must remain stable |
| `REJECTED` | no | no | no | no | Historical state |
| `CANCELLED` | no | no | no | no | Historical state |

Future regeneration/versioning should create a new proposal version or explicit revision flow. Do not mutate a generated/sent/accepted proposal in place.

## 10. Source-of-Truth Rules

- `CommercialProposalItem[]` is the source of truth for work scope and pricing.
- `CommercialProposal.amount` is a materialized aggregate: sum of rounded `lineAmount`.
- `CommercialProposalStage[]` is the source of truth for the work plan.
- `Opportunity.amount` is sales forecast only.
- `payloadSnapshot` is the immutable generation snapshot captured at generation time.
- `resultMetadata` is generated artifact metadata only.
- Generation must not derive work items from Opportunity name, Opportunity amount, transient UI state, hardcoded placeholders, or spreadsheet formulas alone.

## 11. Money Calculation

Recommended policy:

```text
quantity: up to 4 decimals
unitPrice: 2 decimals
discountPercent: 2 decimals
lineAmount = roundHalfUp(quantity * unitPrice * (1 - discountPercent / 100), 2)
amount = sum(lineAmount)
```

Use a decimal helper or integer minor units in server code. Do not use unchecked JavaScript floating-point arithmetic for authoritative totals. Twenty `FieldType.NUMBER` can store display values, but calculations should be deterministic before writing records.

All items in one proposal must share `CommercialProposal.currencyCode`. Currency conversion is out of scope for v2.

## 12. Validation

CommercialProposal:

- `title` required.
- `currencyCode` required when items exist.
- `validityDays > 0`.
- Editable only in `DRAFT` and `FAILED`.
- At least one valid item before generation.
- All items share the proposal currency.

Item:

- `position >= 1`; server normalizes positions.
- `name` required.
- `quantity > 0`.
- `unit` required.
- `unitPrice >= 0`.
- `discountPercent >= 0 && discountPercent <= 100`.
- `lineAmount` must match server calculation.

Stage:

- `position >= 1`; server normalizes positions.
- `title`, `result`, and `duration` required before generation.

Generation:

- Status must be `DRAFT` or `FAILED`.
- Total must be positive unless an explicit zero-price proposal flag is added later.
- No concurrent generation.
- Snapshot total must match item totals.

## 13. Migration

No hidden mass migration.

Existing `DRAFT` / `FAILED`:

- Keep existing record.
- On first editor open, offer to create one starter item from current `title` and `amount`.
- User can accept, edit, or discard the suggestion.
- After save, `amount` becomes the aggregate total.

Existing `GENERATED`, `SENT`, `ACCEPTED`, `REJECTED`, `CANCELLED`:

- Keep read-only as legacy proposals.
- Do not rewrite `payloadSnapshot`, `resultMetadata`, files, or generated numbers.

## 14. Compatibility

- Existing generated files remain valid historical artifacts.
- Generation schema v1 remains readable for legacy records.
- New generation should use schema `2.0` and template version `2`.
- Existing `CommercialProposal.amount` values are treated as legacy snapshots until a proposal is edited in v2.
- Current draft idempotency key remains unchanged.

## 15. Risks

| Risk | Mitigation |
|---|---|
| Twenty metadata upgrade creates unexpected changes | Use metadata plan, apply only app-owned object additions/fields |
| Partial aggregate save across multiple custom objects | Validate first, upsert before delete, use `editorRevision`, return canonical reload on failure |
| Decimal precision drift | Central decimal helper, server-calculated totals, tests with edge cases |
| Dynamic spreadsheet rows | Prefer template v2 designed for expandable tables over ad hoc row insertion in template v1 |
| Legacy proposal compatibility | Read-only legacy mode and schema-version branching |
| Payload schema compatibility | Versioned schema `1.0` and `2.0` with explicit generator routing |

## 16. Open Questions Closed

| Question | Recommendation |
|---|---|
| Reuse `amount` or add `totalAmount`? | Reuse `amount` as proposal total. It avoids duplicate totals and matches likely integrations. Existing records are handled as legacy until edited. |
| Store `lineAmount` physically? | Yes, as a materialized value recalculated by the server on every save. |
| How to calculate decimals? | Use deterministic decimal/integer-minor-unit logic; round line amounts half-up to 2 decimals, sum rounded lines. |
| Aggregate save or CRUD routes? | Aggregate save for the first editor. It gives atomic validation and simpler ordering. |
| Partial failures? | Validate first, upsert new/changed children before deleting removed ones, use `editorRevision`, return safe error and canonical reload. |
| Existing DRAFT? | Offer one-time starter item from legacy title/amount on editor open; no silent migration. |
| Existing GENERATED? | Keep read-only legacy, do not mutate artifacts or snapshots. |
| Sync Opportunity.amount? | Do not update automatically. After accepted/primary proposal, offer explicit user action later. |
| Contact relation or text field? | Use `contactName` TEXT first. Contact relation can be added later. |
| Template upgrade strategy? | Create templateVersion `2` and schema `2.0`; keep v1 for legacy generation. |
| How support 6+ rows? | Prefer redesigned template v2 with expandable/multi-page layout; avoid stretching v1 beyond its 5-row design. |
| When add CatalogItem? | After item/stage editor and v2 generation are stable. |
| Need `version` field? | Yes, add a simple numeric proposal version marker now for future regeneration/versioning compatibility. |
| Need optimistic concurrency? | Yes, add `editorRevision` for aggregate save. |
| Editable statuses? | `DRAFT` and `FAILED` only. |

## 17. Recommended Decision

Adopt `CommercialProposal` as an aggregate root with owned `CommercialProposalItem` and `CommercialProposalStage` child objects. Reuse `CommercialProposal.amount` as the materialized proposal total. Move generation from synthetic Opportunity-based content to immutable schema `2.0` snapshots built from saved proposal header, items, and stages. Keep existing records safe through read-only legacy behavior and opt-in starter-line conversion for editable legacy drafts.
