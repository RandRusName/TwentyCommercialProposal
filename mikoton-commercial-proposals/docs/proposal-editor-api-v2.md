# Commercial Proposal Editor API v2

## Preferred Boundary

Use aggregate routes with proposal id only in the path:

```text
POST /commercial-proposals/:id/editor-context
POST /commercial-proposals/:id/save-editor
POST /commercial-proposals/:id/recalculate
```

Twenty logic function handlers should read:

```typescript
event.pathParameters.id
```

The request body must not include a second conflicting proposal id.

## Why Aggregate Save

The editor saves one aggregate: header, items, stages, terms, and total. Aggregate save is the first implementation choice because it enables whole-proposal validation, ordered arrays, recalculated totals, and a canonical response.

Fine-grained CRUD routes can be added later after the aggregate contract is stable.

## Required Spike at Start of Prompt 5.1

Codex must verify Twenty SDK/Core API v2.20.0 capabilities:

- Does conditional update / compare-and-set exist?
- Can update be constrained by `id == proposalId AND editorRevision == expectedRevision`?
- Can affected row count or conflict be observed?
- Are multi-object transactions available for custom objects?
- Is there any official optimistic-lock primitive?

Prompt 5.1 must not use raw DB access or modify Twenty core to obtain CAS.

## Editor Context Response

```json
{
  "status": "success",
  "proposal": {
    "id": "uuid",
    "title": "Commercial proposal",
    "number": "DRAFT-...",
    "status": "DRAFT",
    "version": 1,
    "contentModelVersion": "LEGACY_V1",
    "editorRevision": 3,
    "lastEditorOperationId": null,
    "opportunity": {
      "id": "uuid",
      "name": "Opportunity name",
      "amount": 120000,
      "currencyCode": "RUB"
    },
    "company": {
      "id": "uuid",
      "name": "Customer"
    },
    "contactName": null,
    "contextAndGoal": null,
    "currencyCode": "RUB",
    "validityDays": 14,
    "paymentTerms": null,
    "assumptions": null,
    "nextStep": null,
    "amount": 120000
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

For `LEGACY_V1`, `amount` may be historical/forecast snapshot. UI must label it accordingly and not present it as calculated total until conversion.

## Save Editor Request

```json
{
  "operationId": "uuid",
  "editorRevision": 3,
  "header": {
    "title": "Commercial proposal",
    "companyId": "uuid",
    "contactName": "Contact name",
    "contextAndGoal": "Context and goal",
    "currencyCode": "RUB",
    "validityDays": 14,
    "paymentTerms": "Payment terms",
    "assumptions": "Assumptions",
    "nextStep": "Next step"
  },
  "items": [
    {
      "id": "optional-existing-id",
      "clientKey": "uuid",
      "block": "Analysis",
      "name": "Discovery",
      "description": "Requirements discovery",
      "quantity": "8",
      "unit": "hour",
      "unitPrice": "5500.00",
      "discountPercent": "0"
    }
  ],
  "stages": [
    {
      "id": "optional-existing-id",
      "clientKey": "uuid",
      "title": "Start",
      "result": "",
      "duration": ""
    }
  ]
}
```

Rules:

- `operationId` is a UUID generated once per save attempt.
- `clientKey` is a UUID generated once per local row and sent on every save.
- Decimal values should be strings in the request to avoid UI float drift.
- Existing child ids must be ownership-checked against the current proposal.

## Save Editor Response

```json
{
  "status": "success",
  "proposal": {
    "id": "uuid",
    "contentModelVersion": "AGGREGATE_V2",
    "amount": 44000,
    "currencyCode": "RUB",
    "editorRevision": 4,
    "lastEditorOperationId": "uuid"
  },
  "items": [
    {
      "id": "uuid",
      "clientKey": "uuid",
      "position": 1,
      "lineAmount": 44000
    }
  ],
  "stages": [
    {
      "id": "uuid",
      "clientKey": "uuid",
      "position": 1
    }
  ]
}
```

The response is canonical: normalized positions, persisted ids, recalculated totals, and current revision.

## Replay-Safe Save

Add `CommercialProposal.lastEditorOperationId`.

If:

```text
request.operationId == proposal.lastEditorOperationId
```

the server returns the canonical aggregate without changing data again.

If the previous request failed before the final proposal update:

- child upsert by `id/clientKey` converges to the same children;
- retry with the same `operationId` must not create duplicate items/stages;
- `editorRevision` increments only after the aggregate save completes.

This guarantee is a replay-safe convergent save. It is not exactly-once semantics without a database transaction.

## Staged Save Algorithm

1. Read proposal aggregate.
2. Check editable status.
3. Check `contentModelVersion` transition rules.
4. Check `editorRevision`.
5. Validate full request.
6. Normalize ordered arrays.
7. Calculate line amounts and total.
8. Verify ownership of referenced child ids.
9. Upsert items by id/clientKey.
10. Upsert stages by id/clientKey.
11. Re-read persisted children.
12. Delete removed children only after successful upserts.
13. Re-read aggregate.
14. Perform final proposal update:
    - header fields;
    - amount;
    - `contentModelVersion`;
    - `editorRevision + 1`;
    - `lastEditorOperationId`.
15. Return canonical aggregate.

If CAS is available, step 14 must be conditional on current `editorRevision`.

If any step before 14 fails:

- do not announce success;
- return a structured error;
- retry with same `operationId`/`clientKey`s is safe;
- UI reloads canonical state.

## Ownership Validation

The server must not trust a child `id` from UI without checking:

```text
child.commercialProposalId == currentCommercialProposalId
```

Otherwise return:

```text
COMMERCIAL_PROPOSAL_CHILD_FORBIDDEN
```

## Concurrency

### Variant A: CAS supported

Use atomic compare-and-set for the final proposal update.

Expected behavior:

- stale revision rejected;
- one parallel save completes revision transition;
- the other gets `COMMERCIAL_PROPOSAL_EDITOR_CONFLICT`.

### Variant B: CAS not supported

Document the guarantee as:

```text
best-effort optimistic concurrency
```

Use:

1. initial revision check;
2. replay-safe child upsert;
3. final revision re-read;
4. safe conflict detection where observable;
5. canonical reload after failure.

Do not use the words `atomic`, `strict`, `linearizable`, or `guaranteed conflict prevention` if the platform does not provide them.

For the single-user MVP, best-effort is acceptable if documented.

## Model Version Transition

A proposal remains `LEGACY_V1` until a successful save with at least one valid item.

Header-only save:

- stays `LEGACY_V1`;
- preserves legacy `amount`;
- keeps schema `1.0` generation available.

Save with valid items:

- converts to `AGGREGATE_V2`;
- recalculates `amount`;
- irreversible.

## Save Validation

Editor save allows unfinished DRAFT/FAILED content:

- `title` required.
- item `name` required.
- item `quantity > 0`.
- item `unit` required.
- item `unitPrice >= 0`.
- item `discountPercent` between `0` and `100`.
- stage `title` required.
- stage `result` and `duration` may be empty.
- zero items allowed only while staying `LEGACY_V1`.

Generation validation is stricter and lives in the generation schema document.

## Structured Errors

Future codes:

```text
COMMERCIAL_PROPOSAL_NOT_FOUND
COMMERCIAL_PROPOSAL_FORBIDDEN
COMMERCIAL_PROPOSAL_INVALID_STATUS
COMMERCIAL_PROPOSAL_CHILD_FORBIDDEN
COMMERCIAL_PROPOSAL_EDITOR_CONFLICT
COMMERCIAL_PROPOSAL_VALIDATION_FAILED
COMMERCIAL_PROPOSAL_SAVE_FAILED
COMMERCIAL_PROPOSAL_GENERATION_MODEL_NOT_SUPPORTED
```

Do not return raw SDK/GraphQL errors to the UI.

## Generation Boundary

Until Prompt 5.3:

- `LEGACY_V1` uses current schema `1.0` generation.
- `AGGREGATE_V2` generation is blocked with `COMMERCIAL_PROPOSAL_GENERATION_MODEL_NOT_SUPPORTED`.

After Prompt 5.3:

- `LEGACY_V1` uses schema `1.0` / template v1.
- `AGGREGATE_V2` uses schema `2.0` / template v2.
