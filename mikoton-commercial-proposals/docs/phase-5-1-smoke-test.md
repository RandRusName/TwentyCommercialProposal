# Phase 5.1 Smoke Test Report

Status: not executed on target yet.

Date prepared: 2026-07-20

## Scope

Prompt 5.1 adds backend aggregate metadata and routes:

- `CommercialProposalItem`
- `CommercialProposalStage`
- `CommercialProposal.contentModelVersion`
- aggregate editor-context/save/recalculate routes
- generation guard for `AGGREGATE_V2`

## Local Evidence

| Check | Result | Evidence |
|---|---|---|
| Platform spike | Completed | `docs/prompt-5-1-platform-spike.md` |
| Dependency restore | Passed | `yarn.cmd install --immutable` |
| Typecheck | Passed | `yarn.cmd typecheck` |
| Unit tests | Passed | `yarn.cmd test:unit`, 2 files / 58 tests |

## Target Smoke Checklist

Not executed yet. Required steps:

1. Run metadata plan on `mikoton-target`.
2. Confirm additive app-owned metadata only.
3. Publish/install upgraded app.
4. Open `LEGACY_V1` DRAFT.
5. Save header only through `save-editor`.
6. Verify `contentModelVersion = LEGACY_V1`, amount unchanged, revision incremented.
7. Save 2 items and 2 stages.
8. Verify conversion to `AGGREGATE_V2`, normalized positions, calculated amount.
9. Replay same `operationId`.
10. Verify no duplicate children and no second revision increment.
11. Submit foreign/fabricated child id.
12. Verify `COMMERCIAL_PROPOSAL_CHILD_FORBIDDEN`.
13. Attempt generation.
14. Verify `COMMERCIAL_PROPOSAL_GENERATION_MODEL_NOT_SUPPORTED` and no status/number/snapshot/file mutation.
15. Verify existing `LEGACY_V1` schema `1.0` generation still works.

## Limitations Until Target Smoke

- Target metadata apply/install is not yet confirmed for Prompt 5.1.
- Target route path-parameter behavior is typed by SDK but not yet smoke-tested on target.
- Query/mutation names for child objects must be confirmed against target runtime.
- The final readiness status must remain `NOT READY FOR PROMPT 5.2` until target smoke passes.
