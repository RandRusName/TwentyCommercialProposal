# Commercial Proposal Generation Schema v2

Each `content.workItems[]` entry includes `currencyCode`. It must exactly equal `proposal.currencyCode`; mixed-currency snapshots are rejected by both the App and document-service.

For `AGGREGATE_V2`, customer company context comes only from `CommercialProposal.company`. The Opportunity company is never used as fallback. A non-null but missing or forbidden proposal Company blocks generation before number/status/snapshot mutation. A null relation produces `Компания не указана`.

## Implemented contract

`AGGREGATE_V2` dispatches to schema `2.0` and template `2`; `LEGACY_V1` stays on schema `1.0` and template `1`. Mismatches return `DOCUMENT_SCHEMA_TEMPLATE_MISMATCH`.

The v2 snapshot is built from the canonical persisted aggregate in normalized position order. Canonical JSON is recursively key-sorted and hashed with SHA-256. Validation runs before number, status or snapshot mutation and checks child identity/order, complete stages, currency, authoritative line totals and aggregate total.

Document-service persists `manifest.json` below the generation storage prefix. The same idempotency key/hash reuses files and refreshes URLs; the same key with another hash returns `GENERATION_IDEMPOTENCY_CONFLICT`.

## Goal

Schema `2.0` generates documents from saved `CommercialProposal` aggregate data. It must never synthesize work items from Opportunity name or Opportunity amount.

## Transition Guard

Historical transition rule used before Prompt 5.3 was completed:

| `contentModelVersion` | Generation behavior |
|---|---|
| `LEGACY_V1` | Current schema `1.0` generation remains available. |
| `AGGREGATE_V2` | Generation must be blocked. |

Structured error:

```text
COMMERCIAL_PROPOSAL_GENERATION_MODEL_NOT_SUPPORTED
```

User-facing message:

```text
Генерация документов для новой модели КП пока недоступна.
Сохранённые данные не потеряны.
```

Do not:

- silently use the legacy generator;
- collapse aggregate items into one row;
- use Opportunity amount;
- generate a zero-total document;
- downgrade `AGGREGATE_V2` to `LEGACY_V1`.

Active dispatch after Prompt 5.3:

```text
LEGACY_V1    -> schema 1.0 / template v1
AGGREGATE_V2 -> schema 2.0 / template v2
```

The generator must reject schema/template mismatches.

## Snapshot Timing

For schema `2.0`, the immutable snapshot is created only when generation starts:

```text
CommercialProposal DRAFT/FAILED
-> validate aggregate
-> assign final number if needed
-> build schema 2.0 snapshot
-> save payloadSnapshot
-> status GENERATING
-> call document-service
```

Snapshot must be deterministic:

- items ordered by normalized `position`;
- stages ordered by normalized `position`;
- totals recalculated server-side;
- currency checked consistently;
- no transient UI state included.

## Contract

```json
{
  "schemaVersion": "2.0",
  "templateCode": "mikoton-commercial-proposal",
  "templateVersion": "2",
  "proposal": {
    "id": "uuid",
    "number": "КП-012 от 17.07.2026",
    "title": "Commercial proposal",
    "version": 1,
    "contentModelVersion": "AGGREGATE_V2",
    "date": "2026-07-17",
    "language": "ru-RU",
    "currencyCode": "RUB",
    "validityDays": 14,
    "amount": 292600
  },
  "customer": {
    "companyId": "uuid",
    "companyName": "Customer",
    "contactName": "Contact"
  },
  "contractor": {
    "name": "Шибеев Роман",
    "email": "consulting@mikoton.ru"
  },
  "content": {
    "contextAndGoal": "Context and goal.",
    "workItems": [
      {
        "position": 1,
        "block": "Analysis",
        "name": "Discovery",
        "description": "Requirements discovery.",
        "quantity": 8,
        "unit": "hour",
        "unitPrice": 5500,
        "discountPercent": 0,
        "lineAmount": 44000,
        "currencyCode": "RUB"
      }
    ],
    "plan": [
      {
        "position": 1,
        "title": "Start",
        "result": "Confirmed scope.",
        "duration": "2 days",
        "description": null
      }
    ],
    "paymentTerms": "Payment terms.",
    "assumptions": "Assumptions.",
    "nextStep": "Next step."
  }
}
```

## Schema 2.0 Generation Validation

Before writing `payloadSnapshot`:

- `contentModelVersion = AGGREGATE_V2`.
- status is `DRAFT` or `FAILED`.
- `schemaVersion = 2.0`.
- `templateCode = mikoton-commercial-proposal`.
- `templateVersion = 2`.
- final number assigned, not `DRAFT-*`.
- at least one valid item.
- at least one complete stage if template v2 requires a plan.
- stage `result` and `duration` filled.
- `currencyCode` filled.
- `proposal.amount > 0`.
- `proposal.amount` equals sum of item `lineAmount`.
- all item currencies equal `proposal.currencyCode`.
- no invalid children.

This is stricter than editor save validation.

## Compatibility With v1

Schema `1.0` remains available for `LEGACY_V1`. Existing generated records remain historical artifacts.

Schema `2.0` is only for `AGGREGATE_V2`. It must not read work composition from:

- Opportunity name;
- Opportunity amount;
- UI transient state;
- hardcoded placeholder work item;
- spreadsheet formulas as the only source.

## Template Strategy

Template v1 is limited to:

```text
workItems: max 5
plan: 1..3 stages
```

Prompt 5.3 introduced a separate macro-free template v2 with fixed capacity for
50 items and 10 stages. It avoids risky row insertion into legacy template v1;
requests above those limits are rejected without truncation.

## Output Formats

Current production output is:

```text
XLSX
PDF
```

Do not reintroduce DOCX. Generated Excel files should remain macro-free XLSX unless a future ADR changes that decision.

## Result Metadata

Schema `2.0` should store:

```json
{
  "generationId": "uuid",
  "generationIdempotencyKey": "uuid",
  "schemaVersion": "2.0",
  "templateCode": "mikoton-commercial-proposal",
  "templateVersion": "2",
  "snapshotHash": "sha256",
  "files": [
    {
      "format": "xlsx",
      "fileName": "proposal.xlsx",
      "contentType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "size": 123456,
      "sha256": "...",
      "storageKey": "...",
      "twentyFileId": "uuid",
      "twentyFileUrl": "..."
    }
  ]
}
```

## Idempotency

Generation keeps a separate route idempotency key. Repeated generation with the same key and same canonical snapshot should return the same generation result and avoid duplicate files.

If payload changes, the snapshot hash changes and should be treated as a different generation operation unless a future regeneration/versioning flow is introduced.
