# Commercial Proposal v2 Migration Plan

## Scope

This plan describes a safe future migration from the current single-object proposal model to the v2 aggregate model. It is design-only and must not be treated as an executed migration.

## Current Records

Existing records can contain:

- `DRAFT` or `FAILED` proposals with legacy `amount` copied from `Opportunity.amount`.
- `GENERATED` proposals with schema `1.0` `payloadSnapshot`, generated XLSX/PDF files, `generatedAt`, and `resultMetadata`.
- Future lifecycle statuses such as `SENT`, `ACCEPTED`, `REJECTED`, and `CANCELLED`.

## Metadata Additions

Future Prompt 5.1 should add only app-owned metadata:

- `CommercialProposalItem`
- `CommercialProposalStage`
- New fields on `CommercialProposal`: `version`, `editorRevision`, `contactName`, `contextAndGoal`, `validityDays`, `paymentTerms`, `assumptions`, `nextStep`

No existing universal identifiers should be changed. New universal identifiers must follow the existing constant naming convention, for example:

```text
COMMERCIAL_PROPOSAL_ITEM_OBJECT_UNIVERSAL_IDENTIFIER
COMMERCIAL_PROPOSAL_STAGE_OBJECT_UNIVERSAL_IDENTIFIER
COMMERCIAL_PROPOSAL_ITEM_FIELD_COMMERCIAL_PROPOSAL_UNIVERSAL_IDENTIFIER
COMMERCIAL_PROPOSAL_STAGE_FIELD_COMMERCIAL_PROPOSAL_UNIVERSAL_IDENTIFIER
```

## Status-by-Status Behavior

| Existing status | Migration behavior | User experience |
|---|---|---|
| `DRAFT` | Do not create child rows automatically. Mark as editable legacy draft. | First editor open offers a starter item from current `title` and `amount`. |
| `FAILED` | Same as `DRAFT`. | User may correct content and retry generation. |
| `GENERATING` | Treat as transient read-only. | Let current generation finish/fail before v2 editing. |
| `GENERATED` | Leave read-only legacy. | Existing files and snapshots remain unchanged. |
| `SENT` | Leave read-only legacy. | No conversion. |
| `ACCEPTED` | Leave read-only legacy. | No conversion; preserve commercial record. |
| `REJECTED` | Leave read-only legacy. | No conversion. |
| `CANCELLED` | Leave read-only legacy. | No conversion. |

## Legacy Draft Conversion

The editor should detect an editable proposal with no child items.

Recommended prompt:

```text
У этого КП ещё нет состава работ. Создать стартовую строку из текущей суммы?
```

If accepted:

- Create one item:
  - `position = 1`
  - `block = Работы`
  - `name = CommercialProposal.title`
  - `description = null`
  - `quantity = 1`
  - `unit = проект`
  - `unitPrice = legacy amount`
  - `discountPercent = 0`
  - `lineAmount = legacy amount`
  - `currencyCode = proposal.currencyCode`
- Create one starter stage only if the user accepts suggested plan defaults.
- Set `amount` to the calculated aggregate.
- Increment `editorRevision`.

If rejected:

- Keep amount until the user saves real items.
- Generation remains blocked because at least one valid item is required.

## Existing Generated Records

Existing generated records are historical artifacts. Do not:

- Rewrite `payloadSnapshot`.
- Regenerate files.
- Change `resultMetadata`.
- Recalculate `amount`.
- Attach new item/stage rows silently.

If regeneration/versioning is needed later, create a new proposal version or explicit duplicate/regenerate flow.

## Opportunity Amount Compatibility

`Opportunity.amount` remains the forecast/expected deal value. `CommercialProposal.amount` becomes the precise proposal total.

During draft creation in v2:

- Set `CommercialProposal.amount = 0`.
- Copy `currencyCode` from Opportunity when available.
- Show `Opportunity.amount` as a suggestion in the editor.
- Do not update `Opportunity.amount` automatically.

Future accepted-proposal flow may offer:

```text
Обновить сумму сделки до суммы принятого КП?
```

That action must be explicit and auditable.

## Metadata Plan Safety

Before applying v2 metadata:

1. Run metadata plan against a non-production or backup-protected workspace.
2. Confirm changes are limited to app-owned object additions and field additions.
3. Stop if the plan deletes business data, modifies Twenty standard objects unexpectedly, or changes unrelated layouts.
4. Keep current `CommercialProposal` fields and universal identifiers stable.

## Rollback

Because metadata additions may not be trivially reversible in Twenty, rollback should be operational:

- Keep database/object storage backup before metadata apply.
- If app deployment fails before metadata apply, revert app version only.
- If metadata apply succeeds but app fails, deploy previous app version that ignores child objects.
- Do not destructive-uninstall the app from target as normal rollback.

## Acceptance Criteria for Future Migration

- Existing generated proposals remain readable.
- Existing files stay attached.
- Existing draft creation still works.
- v2 editor can open legacy DRAFT/FAILED safely.
- No hidden mass conversion occurs.
- No existing proposal is deleted or renumbered.
