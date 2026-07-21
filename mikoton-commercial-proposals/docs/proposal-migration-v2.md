# Commercial Proposal v2 Migration Plan

## Scope

This is a design-only migration plan. It does not execute metadata changes, data migration, deployment, or code changes.

## Metadata Additions for Prompt 5.1

Prompt 5.1 should add only app-owned metadata:

- `CommercialProposalItem`
- `CommercialProposalStage`
- `CommercialProposal.contentModelVersion`
- `CommercialProposal.editorRevision`
- `CommercialProposal.lastEditorOperationId`
- `CommercialProposal.version`
- business header fields: `contactName`, `contextAndGoal`, `validityDays`, `paymentTerms`, `assumptions`, `nextStep`
- `CommercialProposalItem.clientKey`
- `CommercialProposalStage.clientKey`

Do not add in Prompt 5.1:

- `CatalogItem`
- `CommercialProposalItem.catalogItem`
- generation schema `2.0` document-service implementation
- template v2

No existing universal identifiers should be changed.

## `contentModelVersion`

Metadata contract:

```text
name: contentModelVersion
type: SELECT
isNullable: false
defaultValue: AGGREGATE_V2
editable by user: false
values: LEGACY_V1, AGGREGATE_V2
```

Meaning:

| Value | Migration meaning |
|---|---|
| `LEGACY_V1` | Existing proposal still compatible with schema `1.0`; `amount` may be legacy snapshot. |
| `AGGREGATE_V2` | Proposal has saved child items; items/stages are source of truth; schema `2.0` required for generation. |

## Status-by-Status Behavior

| Existing status | Migration behavior |
|---|---|
| `DRAFT` | Openable in editor. Starts as `LEGACY_V1`. Header-only save keeps legacy mode. Save with valid items converts to `AGGREGATE_V2`. |
| `FAILED` | Same as `DRAFT`. |
| `GENERATING` | Read-only. Do not convert; wait for current operation to finish/fail. |
| `GENERATED` | Read-only `LEGACY_V1` historical record. Do not mutate files/snapshots/amount. |
| `SENT` | Read-only historical record. |
| `ACCEPTED` | Read-only historical record. |
| `REJECTED` | Read-only historical record. |
| `CANCELLED` | Read-only historical record. |

## Conversion Rule

A proposal remains `LEGACY_V1` until the first successful aggregate save with at least one valid item.

Header-only save on legacy DRAFT/FAILED:

- `contentModelVersion` remains `LEGACY_V1`;
- legacy `amount` remains unchanged;
- schema `1.0` generation remains available;
- no conversion happens.

Save with one or more valid items:

- `contentModelVersion = AGGREGATE_V2`;
- `amount = SUM(server-calculated lineAmount)`;
- `editorRevision` increments;
- conversion is irreversible.

## Starter Item

For editable legacy proposals with no items, the editor may offer a starter item suggestion from current title/amount.

If accepted and saved:

- create a real item with its own `clientKey`;
- convert to `AGGREGATE_V2`;
- recalculate `amount`;
- legacy amount stops being source of truth.

If ignored:

- record remains `LEGACY_V1`;
- header-only changes are allowed;
- schema `1.0` generation remains available.

## New Records

After schema/template v2 became production-capable, new drafts are created as:

```text
contentModelVersion = AGGREGATE_V2
number = Черновик
amount = 0
items = []
stages = []
templateVersion = null
```

They can be saved while incomplete. Generation requires at least one valid item,
at least one complete stage and a positive total. No synthetic item is created
from Opportunity title/amount.

## Legacy Amount

For `LEGACY_V1`:

```text
amount = legacy snapshot / historical value
```

It may be copied from Opportunity and is not required to equal child rows.

For `AGGREGATE_V2`:

```text
amount = SUM(CommercialProposalItem.lineAmount)
```

It is server-calculated.

## Opportunity Amount

`Opportunity.amount` remains forecast. Do not update it automatically during v2 conversion or generation.

A future accepted-proposal flow may offer an explicit, auditable action to sync the Opportunity amount.

## Generation During Migration

Before Prompt 5.3:

- `LEGACY_V1` generation continues through schema `1.0`;
- `AGGREGATE_V2` generation returns `COMMERCIAL_PROPOSAL_GENERATION_MODEL_NOT_SUPPORTED`;
- no downgrade or synthetic legacy fallback is allowed.

After Prompt 5.3:

- `LEGACY_V1` uses schema `1.0` / template v1;
- `AGGREGATE_V2` uses schema `2.0` / template v2.

## Replay Safety

Migration to child objects must support retry:

- items/stages have `clientKey`;
- save request has `operationId`;
- proposal has `lastEditorOperationId`;
- repeated save with same `operationId` returns canonical aggregate if already completed;
- partial-failure replay converges through parent+clientKey upsert.

This is replay-safe convergent behavior, not exactly-once semantics.

## Metadata Plan Safety

Before applying v2 metadata:

1. Run metadata plan.
2. Confirm changes are app-owned additions.
3. Confirm no existing field nullability is destructively tightened.
4. Confirm `CatalogItem` and `catalogItem` relation are absent.
5. Stop if the plan deletes data, changes unrelated objects, or mutates existing universal identifiers.

## Rollback

- Before metadata apply: revert app commit.
- After metadata apply: deploy previous app version that ignores new objects.
- Do not destructive-uninstall from target as normal rollback.
- Keep operational backup before target metadata apply.

## Acceptance Criteria for Future Migration

- Existing generated proposals remain readable.
- Existing files stay attached.
- Existing draft creation still works.
- Header-only legacy save preserves amount/model version.
- First save with items converts to `AGGREGATE_V2`.
- `AGGREGATE_V2` generation is blocked until Prompt 5.3.
- No hidden mass conversion occurs.
