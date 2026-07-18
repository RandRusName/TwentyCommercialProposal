# ADR-001: CommercialProposal Aggregate With Items and Stages

## Status

Proposed.

## Context

The current app creates `CommercialProposal` from `Opportunity` and generates XLSX/PDF documents. The generated content is currently synthesized from a short Opportunity card:

```text
one artificial work item
one artificial plan stage
amount copied from Opportunity
```

Real proposals need line items, staged delivery plan, terms, assumptions, and a stable generated snapshot.

## Decision

Use `CommercialProposal` as the aggregate root:

```text
CommercialProposal
├── CommercialProposalItem[]
└── CommercialProposalStage[]
```

Reuse `CommercialProposal.amount` as the materialized proposal total:

```text
amount = SUM(CommercialProposalItem.lineAmount)
```

Store `CommercialProposalItem.lineAmount` physically, but calculate it server-side on every aggregate save.

Use an aggregate save API for the first editor instead of fine-grained CRUD:

```text
POST /commercial-proposals/:id/save-editor
```

Add explicit optimistic concurrency through `editorRevision`.

## Consequences

Positive:

- The proposal has a real source of truth for scope, totals, and plan.
- Generation no longer depends on Opportunity name/amount placeholders.
- Editor validation can happen against the whole aggregate.
- Existing `amount` integrations can continue to read the proposal total.

Negative:

- Metadata upgrade is larger because two child objects are added.
- Aggregate save may partially fail because Twenty app routes may not expose a multi-object transaction.
- Existing legacy drafts need an opt-in starter-line conversion path.

## Alternatives Considered

### Keep Single CommercialProposal Object

Rejected. It would require storing line items in RAW_JSON, making list views, permissions, relations, validation, and future catalog integration weaker.

### Add `totalAmount` and Keep `amount` Legacy

Rejected for v2. It avoids semantic migration but creates two similar totals and a long-term synchronization problem. Existing records can be treated as legacy until edited.

### Fine-Grained CRUD Routes First

Rejected for the first editor. CRUD routes are useful later, but aggregate save is safer for ordering, total validation, and a compact UX.

### CatalogItem as Required Source

Rejected. Catalog should be optional and future-compatible. Proposal items must remain snapshots so historical proposals do not change when catalog prices change.

## Implementation Notes for Future Prompts

- Do not change existing universal identifiers.
- Add new identifiers only for new objects/fields.
- Keep `DRAFT` and `FAILED` editable.
- Keep generated/sent/accepted proposals read-only.
- Build generation schema `2.0` from saved aggregate only.
- Keep schema `1.0` readable for legacy generated records.
