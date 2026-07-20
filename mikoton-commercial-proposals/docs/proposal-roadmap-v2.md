# Commercial Proposal v2 Roadmap

## Principle

Move in narrow prompts with explicit rollback points. Do not implement metadata, editor UI, generation schema v2, template v2, and CatalogItem in one step.

## Prompt 5.1 — Metadata Objects + Backend Aggregate

Scope:

- Add `CommercialProposalItem`.
- Add `CommercialProposalStage`.
- Add `CommercialProposal.contentModelVersion`.
- Add `CommercialProposal.editorRevision`.
- Add `CommercialProposal.lastEditorOperationId`.
- Add `CommercialProposal.version`.
- Add business header fields: `contactName`, `contextAndGoal`, `validityDays`, `paymentTerms`, `assumptions`, `nextStep`.
- Add `clientKey` to items/stages.
- Add save `operationId`.
- Spike Twenty SDK/Core API v2.20.0 concurrency capabilities.
- Implement replay-safe aggregate save.
- Add ownership validation for child ids.
- Add generation guard for `AGGREGATE_V2`.
- Keep exact metadata nullability from architecture docs.

Out of scope:

- Rich editor UI.
- Schema `2.0` generation.
- Template v2 / dynamic rows.
- `CatalogItem`.
- `CommercialProposalItem.catalogItem`.

Likely files:

```text
src/objects/
src/domain/
src/services/twenty-record-repository.ts
src/logic-functions/
src/constants/universal-identifiers.ts
docs/metadata-model.md
```

Acceptance criteria:

1. Legacy generation continues to work for `LEGACY_V1`.
2. `AGGREGATE_V2` generation is blocked until Prompt 5.3 with `COMMERCIAL_PROPOSAL_GENERATION_MODEL_NOT_SUPPORTED`.
3. Repeated save with same `operationId` creates no duplicate children.
4. Partial-failure replay creates no duplicate children.
5. Foreign child id is rejected with `COMMERCIAL_PROPOSAL_CHILD_FORBIDDEN`.
6. `editorRevision` conflict behavior matches the real platform guarantee: CAS if supported, otherwise documented best-effort.
7. Header-only legacy save does not change `contentModelVersion` and does not overwrite legacy `amount`.
8. First successful save with valid items converts to `AGGREGATE_V2`.
9. `catalogItem` relation is not added.
10. Metadata plan is app-owned and non-destructive.

Target smoke:

```text
1. Open LEGACY_V1 DRAFT.
2. Save header only.
3. Verify amount/model version unchanged.
4. Save 2 items + 2 stages.
5. Verify conversion to AGGREGATE_V2.
6. Verify amount recalculated.
7. Repeat same operationId.
8. Verify no duplicate children.
9. Try generation.
10. Verify controlled model-not-supported error.
```

Rollback point:

- Before metadata apply: revert app commit.
- After metadata apply: deploy previous app version that ignores new fields/objects.

## Prompt 5.2 — CommercialProposal Editor UI

Scope:

- Add editor front component for DRAFT/FAILED.
- Render sections: header, work items, stages, terms, total.
- Use aggregate save route.
- Generate stable `clientKey` for each new local row.
- Generate `operationId` per save.
- Show legacy starter suggestion.
- Respect read-only statuses.

Out of scope:

- Catalog picker.
- Schema `2.0` generation.
- Template v2.

Acceptance criteria:

- User can edit and save items/stages.
- Stale revision is handled according to Prompt 5.1 capability result.
- Amount shown in UI equals canonical server total for `AGGREGATE_V2`.

Target smoke:

- Create proposal from Opportunity.
- Open editor.
- Save 3 items and 2 stages.
- Reload and verify canonical aggregate.

## Prompt 5.3 — Generation Snapshot v2 + XLSX Template v2

Scope:

- Add schema `2.0` builder from saved aggregate.
- Add template version `2`.
- Update document-service for schema `2.0`.
- Support more than 5 work items through redesigned expandable/multi-page template.
- Keep output formats XLSX and PDF.
- Keep schema `1.0` readable for `LEGACY_V1`.

Out of scope:

- CatalogItem.
- Regenerate/version history.
- Email sending.

Acceptance criteria:

- `LEGACY_V1` uses schema `1.0`.
- `AGGREGATE_V2` uses schema `2.0`.
- Schema/template mismatch is rejected.
- Generation uses saved items/stages, not Opportunity amount/name placeholders.
- XLSX/PDF support 6+ rows without truncation.

Target smoke:

- Generate `AGGREGATE_V2` proposal with 8+ work items.
- Verify PDF totals and layout.

## Prompt 5.4 — CatalogItem

Scope:

- Add optional `CatalogItem` metadata object.
- Add nullable `CommercialProposalItem.catalogItem`.
- Add picker integration.
- Copy selected catalog values into item snapshot.

Out of scope:

- Price approval workflow.
- Multi-currency conversion.

Acceptance criteria:

- Catalog selection creates editable item snapshot.
- Catalog changes do not mutate existing proposal items.

## Prompt 5.5 — Production Deployment + End-to-End Smoke

Scope:

- Full target deployment.
- Metadata plan/apply validation.
- Editor UI smoke.
- Generation smoke with schema `2.0`.
- Legacy record compatibility smoke.
- Permission smoke where possible.

Acceptance criteria:

- Target proposal can be created, edited, generated, downloaded.
- Existing generated records still open.
- No metadata duplicates.
- No data loss.

## Recommended Sequence

```text
5.1 backend aggregate and guard
-> 5.2 editor UI
-> 5.3 schema/template v2 generation
-> 5.4 CatalogItem
-> 5.5 production hardening and smoke
```
