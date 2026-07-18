# Commercial Proposal Editor API v2

## Preferred Boundary

Use an aggregate save route for the first v2 editor:

```text
POST /commercial-proposals/:id/save-editor
```

This is preferred over many fine-grained CRUD routes because the editor naturally edits one aggregate: header, items, stages, terms, and totals.

## Why Not Fine-Grained CRUD First

| Approach | Pros | Cons | Decision |
|---|---|---|---|
| Fine-grained CRUD | Small requests, familiar endpoints | More race conditions, harder ordering, harder total validation | Defer |
| Aggregate save | Full validation, normalized ordering, one canonical response | Larger payload, needs careful partial-failure handling | Use first |

## Routes

Recommended future routes:

```text
POST /commercial-proposals/:id/editor-context
POST /commercial-proposals/:id/save-editor
POST /commercial-proposals/:id/recalculate
```

Fine-grained CRUD can be added later if needed:

```text
POST /commercial-proposals/:id/items
PATCH /commercial-proposals/:id/items/:itemId
DELETE /commercial-proposals/:id/items/:itemId
POST /commercial-proposals/:id/stages
PATCH /commercial-proposals/:id/stages/:stageId
DELETE /commercial-proposals/:id/stages/:stageId
```

## Editor Context Response

```json
{
  "status": "success",
  "proposal": {
    "id": "uuid",
    "title": "КП по автоматизации",
    "number": "DRAFT-...",
    "status": "DRAFT",
    "version": 1,
    "editorRevision": 3,
    "opportunity": {
      "id": "uuid",
      "name": "Сделать бота",
      "amount": 120000,
      "currencyCode": "RUB"
    },
    "company": {
      "id": "uuid",
      "name": "ООО Пример"
    },
    "contactName": null,
    "contextAndGoal": null,
    "currencyCode": "RUB",
    "validityDays": 14,
    "paymentTerms": null,
    "assumptions": null,
    "nextStep": null,
    "amount": 0
  },
  "items": [],
  "stages": [],
  "legacySuggestion": {
    "canCreateStarterItem": true,
    "amount": 120000,
    "currencyCode": "RUB"
  }
}
```

## Save Editor Request

```json
{
  "editorRevision": 3,
  "header": {
    "title": "КП по автоматизации",
    "companyId": "uuid",
    "contactName": "Иванов Александр",
    "contextAndGoal": "Цель проекта...",
    "currencyCode": "RUB",
    "validityDays": 14,
    "paymentTerms": "50/50",
    "assumptions": "Доступы предоставляются заказчиком.",
    "nextStep": "Согласовать старт."
  },
  "items": [
    {
      "id": "optional-existing-id",
      "block": "Анализ",
      "name": "Диагностика процесса",
      "description": "Интервью и фиксация требований.",
      "quantity": "8",
      "unit": "час",
      "unitPrice": "5500.00",
      "discountPercent": "0"
    }
  ],
  "stages": [
    {
      "id": "optional-existing-id",
      "title": "Старт и диагностика",
      "result": "Зафиксированные требования.",
      "duration": "2 дня"
    }
  ]
}
```

Use string decimals in API payloads to avoid accidental binary float drift between UI and server.

## Save Editor Response

```json
{
  "status": "success",
  "proposal": {
    "id": "uuid",
    "amount": 44000,
    "currencyCode": "RUB",
    "editorRevision": 4
  },
  "items": [
    {
      "id": "uuid",
      "position": 1,
      "lineAmount": 44000
    }
  ],
  "stages": [
    {
      "id": "uuid",
      "position": 1
    }
  ]
}
```

The response must be canonical: normalized positions, recalculated totals, current revision.

## Atomicity Strategy

Twenty App routes may not have a database transaction across several custom objects. Use a conservative staged save:

1. Read proposal and check status is editable.
2. Check `editorRevision`.
3. Validate full header/items/stages request.
4. Normalize item and stage positions.
5. Calculate all line amounts and proposal total.
6. Upsert changed/new items.
7. Upsert changed/new stages.
8. Delete removed children only after successful upserts.
9. Update proposal header, amount, and `editorRevision`.
10. Return canonical aggregate.

If a partial failure happens:

- Return a structured safe error.
- Do not claim the save succeeded.
- On next load, return the canonical aggregate from the server.
- Keep enough IDs in the response/logs to diagnose the failed operation.

## Concurrency

Add `editorRevision` to `CommercialProposal`.

- UI reads `editorRevision`.
- Save request includes `editorRevision`.
- Server rejects stale revision with a structured conflict error.
- UI reloads canonical state and asks user to reapply changes.

Using only `updatedAt` is possible but less explicit and harder to reason about across child records.

## Ordering

UI sends ordered arrays. Server ignores client `position` as final truth and rewrites:

```text
items[0] → position 1
items[1] → position 2
stages[0] → position 1
```

Duplicate, missing, or sparse positions are normalized automatically.

## Structured Errors

Future codes:

```text
COMMERCIAL_PROPOSAL_NOT_FOUND
COMMERCIAL_PROPOSAL_FORBIDDEN
COMMERCIAL_PROPOSAL_INVALID_STATUS
COMMERCIAL_PROPOSAL_EDITOR_CONFLICT
COMMERCIAL_PROPOSAL_VALIDATION_FAILED
COMMERCIAL_PROPOSAL_SAVE_FAILED
```

Do not return raw SDK/GraphQL errors to the UI.

## Generation Boundary

Generation should read the saved aggregate from repository, not trust editor UI payload:

```text
getCommercialProposalAggregate(id)
→ validate
→ build snapshot v2
→ status GENERATING
→ document-service
```

The editor API and generation API must share validation and money calculation helpers.
