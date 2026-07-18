# Commercial Proposal Generation Schema v2

## Goal

Schema `2.0` makes saved `CommercialProposal` data, not `Opportunity` shortcuts, the source of generated documents.

## Snapshot Timing

The immutable generation snapshot is created only when generation starts:

```text
CommercialProposal DRAFT/FAILED
→ validate header/items/stages
→ assign final number if needed
→ build schema 2.0 snapshot
→ save payloadSnapshot
→ status GENERATING
→ call document-service
```

The snapshot must be deterministic:

- Items ordered by normalized `position`.
- Stages ordered by normalized `position`.
- Totals recalculated server-side before snapshot.
- Currency checked consistently across proposal and items.

## Contract

```json
{
  "schemaVersion": "2.0",
  "templateCode": "mikoton-commercial-proposal",
  "templateVersion": "2",
  "proposal": {
    "id": "uuid",
    "number": "КП-012 от 17.07.2026",
    "title": "Автоматизация обработки заявок",
    "version": 1,
    "date": "2026-07-17",
    "language": "ru-RU",
    "currencyCode": "RUB",
    "validityDays": 14,
    "amount": 292600
  },
  "customer": {
    "companyId": "uuid",
    "companyName": "ООО Пример",
    "contactName": "Иванов Александр"
  },
  "contractor": {
    "name": "Шибеев Роман",
    "email": "consulting@mikoton.ru"
  },
  "content": {
    "contextAndGoal": "Описание контекста и цели проекта.",
    "workItems": [
      {
        "position": 1,
        "block": "Анализ",
        "name": "Диагностика процесса",
        "description": "Интервью и фиксация требований.",
        "quantity": 8,
        "unit": "час",
        "unitPrice": 5500,
        "discountPercent": 0,
        "lineAmount": 44000,
        "currencyCode": "RUB"
      }
    ],
    "plan": [
      {
        "position": 1,
        "title": "Старт и диагностика",
        "result": "Зафиксированные требования и план работ.",
        "duration": "2 дня"
      }
    ],
    "paymentTerms": "50% предоплата, 50% после сдачи работ.",
    "assumptions": "Сроки зависят от доступности представителей заказчика.",
    "nextStep": "Согласовать состав работ и дату старта."
  }
}
```

## Validation

Before writing `payloadSnapshot`:

- `schemaVersion = 2.0`.
- `templateCode = mikoton-commercial-proposal`.
- `templateVersion = 2`.
- At least one valid work item.
- At least one valid stage.
- `proposal.amount` equals the sum of item `lineAmount`.
- All item currencies equal `proposal.currencyCode`.
- `validityDays > 0`.
- `number` is final, not `DRAFT-*`.

## Compatibility With v1

Schema `1.0` remains for historical records and the current template v1. It synthesizes content from Opportunity and supports a maximum of 5 work items.

Schema `2.0` should use template version `2`. The generator should reject schema/template mismatches instead of silently downgrading.

## Template Strategy

The current template v1 has a fixed work-item area and is intentionally limited:

```text
workItems: max 5
plan: 1..3 stages
```

Recommendation: create a template v2 designed for expandable or multi-page tables. This is safer than retrofitting dynamic row insertion into v1.

Options:

| Option | Recommendation |
|---|---|
| Dynamic row insertion into v1 | Not preferred; high risk around formulas, print area, and layout. |
| Redesigned template v2 with expandable table | Preferred for Prompt 5.3. |
| Multi-page template v2 | Use if real proposals regularly exceed one page. |

## Output Formats

Current production output is:

```text
XLSX
PDF
```

Do not reintroduce DOCX. Source template format can remain an internal implementation detail, but generated Excel files should stay macro-free XLSX unless a future decision reverses that.

## Result Metadata

`resultMetadata` should continue to store generated artifact metadata:

```json
{
  "generationId": "uuid",
  "generationIdempotencyKey": "uuid",
  "templateCode": "mikoton-commercial-proposal",
  "templateVersion": "2",
  "schemaVersion": "2.0",
  "files": [
    {
      "format": "xlsx",
      "fileName": "КП-012-Example.xlsx",
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

Use the existing generation idempotency key for route retries. The snapshot hash should also be stored or derivable:

```text
snapshotHash = sha256(canonical JSON payload)
```

Repeated generation with the same idempotency key and same snapshot should return the same generation result and avoid duplicate files.
