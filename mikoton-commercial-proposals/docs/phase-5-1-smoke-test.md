# Phase 5.1 Smoke Test Report

Status: passed on target.

Date: 2026-07-20

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
| Lint | Passed | WSL `corepack yarn lint` |
| Typecheck | Passed | WSL `corepack yarn typecheck` |
| Unit tests | Passed | WSL `corepack yarn test:unit`, 2 files / 58 tests |
| Document-service regression tests | Passed | WSL `python3 -m unittest discover -s document-service/tests -v`, 4 tests |
| Tarball build | Passed | `scripts/build-wsl.sh`, manifest validation OK |

## Target Deployment

| Check | Result | Evidence |
|---|---|---|
| Remote | Passed | `mikoton-target -> http://192.168.100.11:3000`, API key auth valid |
| Twenty version | Passed | `v2.20.0` |
| Initial metadata plan | Passed | 29 add, 5 change, 0 destroy |
| Install/upgrade | Passed | `deploy.bat`, private publish + install |
| Published version | Passed | `0.1.34` |
| Tarball | Passed | `release-artifacts/mikoton-commercial-proposals-0.1.34.tgz` |
| SHA-256 | Passed | `0e147f402c8b06f66d6bfe2196ec5a5874d8f34bb5170012d336fae8ba4da7de` |
| Repeated metadata plan | Passed | No changes; metadata matches manifest |

## Target Smoke Results

| Check | Result | Evidence |
|---|---|---|
| Phase 3 backend regression | Passed | WSL `corepack yarn test:target-smoke`, 6 tests |
| Context route with Company | Passed | `companyId` GraphQL input is required on target; nested `company.connect` returns `company: null` |
| Editor context route | Passed | `POST /s/commercial-proposals/{id}/editor-context` |
| Recalculate route | Passed | `POST /s/commercial-proposals/{id}/recalculate`, total `30000` |
| Aggregate save | Passed | `POST /s/commercial-proposals/{id}/save-editor` |
| Conversion | Passed | `LEGACY_V1 -> AGGREGATE_V2` after saving 2 valid items |
| Items/stages | Passed | 2 items and 2 stages persisted and returned |
| Amount recalculation | Passed | `CommercialProposal.amount = 30000` |
| Replay-safe save | Passed | Repeated same `operationId` returned `replayed: true`, revision stayed `2` |
| Generation guard | Passed | `POST /s/commercial-proposals/generate` returned HTTP `422` with `COMMERCIAL_PROPOSAL_GENERATION_MODEL_NOT_SUPPORTED` |
| Cleanup | Passed | Smoke Company, Opportunity, and CommercialProposal records removed |

## Remaining Limitations

- Prompt 5.2 adds the rich editor UI; its deployment evidence is tracked in
  `docs/phase-5-2-smoke-test.md`.
- `AGGREGATE_V2` generation is intentionally blocked until Prompt 5.3.
- Optimistic concurrency is best-effort because SDK/Core API v2.20.0 did not expose CAS, transactions, or affected-row conditional updates.
- Child `clientKey` replay safety is application-level parent lookup/upsert, not a confirmed compound database unique constraint.

## Prompt 5.2 Closure Of Earlier Gaps

- Header-only legacy save and model/amount preservation remain covered.
- Foreign/fabricated child ids are rejected; identity mismatch has a dedicated
  `COMMERCIAL_PROPOSAL_CHILD_IDENTITY_CONFLICT` response.
- Partial failures are covered by deterministic unit fault injection. No unsafe
  target fault injection was performed.
