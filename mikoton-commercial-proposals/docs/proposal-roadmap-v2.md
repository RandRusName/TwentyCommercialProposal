# Commercial Proposal v2 Roadmap

## Principle

Do not implement the whole CPQ/editor/template system in one jump. Move in narrow prompts with an explicit rollback point and target smoke per step.

## Prompt 5.1 — Metadata Objects + Backend Aggregate

Scope:

- Add `CommercialProposalItem` metadata object.
- Add `CommercialProposalStage` metadata object.
- Add new `CommercialProposal` header fields.
- Add repository aggregate read/save methods.
- Add shared validation and money calculation helpers.
- Add backend aggregate routes:
  - `editor-context`
  - `save-editor`
  - `recalculate`

Out of scope:

- Rich editor UI.
- Generation schema v2.
- Dynamic spreadsheet rows.
- CatalogItem.

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

- Metadata plan is non-destructive and app-owned.
- Unit tests cover validation, decimal calculations, ordering, and aggregate save.
- Integration test can create a proposal with items and stages.
- Existing generated proposals remain readable.

Rollback point:

- Before metadata apply, rollback by reverting app commit.
- After metadata apply, deploy previous app version that ignores new objects if needed.

Target smoke:

- Open a DRAFT.
- Save 2 items and 2 stages through backend route.
- Verify amount is recalculated.

## Prompt 5.2 — CommercialProposal Editor UI

Scope:

- Add front component/editor for DRAFT/FAILED proposals.
- Sections:
  - Общие данные
  - Состав работ
  - План работ
  - Условия
  - Итог
- Explicit save.
- Dirty state.
- Validation messages.
- Read-only states for generated/sent/accepted.
- Starter-line suggestion for legacy DRAFT/FAILED.

Out of scope:

- CatalogItem picker.
- Generation schema v2 changes.
- Dynamic template.

Likely files:

```text
src/front-components/
src/command-menu-items/
src/domain/
docs/testing.md
docs/phase-4-smoke-test.md
```

Acceptance criteria:

- User can edit items and stages.
- Double-save and stale revision are handled.
- Amount shown in UI matches server canonical total.

Rollback point:

- Remove editor command/front component deployment while keeping metadata.

Target smoke:

- Create proposal from Opportunity.
- Open editor.
- Save 3 items, 2 stages, terms.
- Reload and verify canonical data.

## Prompt 5.3 — Generation Snapshot v2 + XLSX Dynamic Rows

Scope:

- Add schema `2.0` builder from saved aggregate.
- Add template version `2`.
- Update document-service to consume schema `2.0`.
- Support more than 5 work items through redesigned expandable/multi-page template.
- Keep output formats XLSX and PDF.
- Keep v1 generation readable for legacy records.

Out of scope:

- CatalogItem.
- Regenerate/version history.
- Email sending.

Likely files:

```text
src/domain/commercial-proposal.ts
src/services/document-service-client.ts
src/logic-functions/generate-commercial-proposal.logic-function.ts
document-service/
templates/
docs/template-mapping-v1.md
docs/document-generation.md
```

Acceptance criteria:

- Generation fails safely if no items.
- Generation uses saved items/stages, not Opportunity amount/name placeholders.
- XLSX/PDF contain 6+ rows correctly.
- Existing schema `1.0` generated records remain readable.

Rollback point:

- Keep template v1 and schema v1 generation available until v2 target smoke passes.

Target smoke:

- Generate proposal with 8+ work items.
- Verify PDF has correct totals and no hidden truncation.

## Prompt 5.4 — CatalogItem

Scope:

- Add optional `CatalogItem` metadata object.
- Add picker integration in editor.
- Copy selected catalog values into `CommercialProposalItem`.
- Support inactive catalog items.

Out of scope:

- Price approval workflow.
- Multi-currency conversion.
- Public catalog marketplace.

Acceptance criteria:

- Selecting a catalog item creates an editable proposal item snapshot.
- Updating catalog does not alter existing proposal items.

Rollback point:

- Hide picker and keep manual item editing.

## Prompt 5.5 — Production Deployment + End-to-End Smoke

Scope:

- Full target deployment.
- Metadata plan/apply validation.
- Editor UI smoke.
- Generation smoke with v2 schema/template.
- Legacy record compatibility smoke.
- Permission smoke where possible.

Out of scope:

- Phase 6 features like approval, e-signature, email automation.

Acceptance criteria:

- Target proposal can be created, edited, generated, downloaded.
- Existing generated records still open.
- No metadata duplicates.
- No data loss.

Rollback point:

- Restore app previous version or backup according to operational runbook.

## Recommended Sequence

```text
5.1 backend aggregate
→ 5.2 editor UI
→ 5.3 generation schema/template v2
→ 5.4 catalog
→ 5.5 production hardening and smoke
```

Catalog is intentionally after the editor/generation path. It should accelerate item creation, not become the source of truth for proposal history.
