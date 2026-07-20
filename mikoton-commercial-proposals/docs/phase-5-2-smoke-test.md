# Phase 5.2 Smoke Test Report

Date: 2026-07-20

## Local Validation

| Check | Result | Evidence |
|---|---|---|
| Identity validation | Passed | Duplicate client keys/ids, id-key mismatch and persisted duplicates covered by unit tests |
| Canonical total | Passed | Final amount is derived from re-read persisted line amounts |
| Final revision check | Passed | Revision change after child mutations returns editor conflict |
| Partial replay | Passed | Fault injection after item/stage upsert, during delete and before header update converges without duplicate children |
| Recalculate | Passed | Minimal money-only request plus proposal/status validation |
| Front error codes | Passed | HTTP 400/403/409/422/500 preserve structured backend code/status |
| Editor helpers | Passed | Create/duplicate/reorder/delete, decimal normalization, validation, dirty state and canonical response |
| Lint | Passed | WSL `corepack yarn lint` |
| Typecheck | Passed | WSL `corepack yarn typecheck` |
| Unit tests | Passed | 3 files / 82 tests |
| Document-service regression | Passed | 4 tests |
| WSL tarball build | Passed | Manifest paths and compiled logic-function checks passed |
| Initial metadata plan | Passed | 2 add, 9 change, 0 destroy |

## Target Validation

| Check | Result | Evidence |
|---|---|---|
| Private deploy | Passed | `deploy.bat`: `0.1.35 -> 0.1.36`, private publish and install/upgrade succeeded |
| Installed version | Passed | Twenty Settings -> Applications showed current `0.1.36`, latest `0.1.36` |
| Tarball | Passed | `release-artifacts/mikoton-commercial-proposals-0.1.36.tgz`, 1,408,813 bytes |
| Tarball SHA-256 | Passed | `44d18091b691395213fc64882e967cef148b2d3e15390be4ece1b79aeae8b8d4` |
| Metadata convergence | Passed | Repeated `twenty plan` returned `No changes` |
| Backend target smoke | Passed | WSL `test:target-smoke`: 1 file / 7 tests |
| Header-only legacy save | Passed | `LEGACY_V1`, legacy amount and model version remained unchanged |
| Aggregate conversion | Passed | 3 items + 2 stages converted the draft to `AGGREGATE_V2`; canonical total was `260 RUB` |
| Replay protection | Passed | Repeated operation returned the canonical aggregate without duplicate children |
| Conflict handling | Passed | Stale revision returned `COMMERCIAL_PROPOSAL_EDITOR_CONFLICT`; browser kept local edits visible |
| Ownership validation | Passed | Fabricated foreign child id returned `COMMERCIAL_PROPOSAL_CHILD_FORBIDDEN` |
| Generation guard | Passed | Backend returned the model-not-supported error; UI showed the transition banner and disabled generation |
| Legacy generation regression | Passed | Separate `LEGACY_V1` draft reached `GENERATED`, number `КП-012 от 20.07.2026`, two generated files |
| Editable UI | Passed | Browser loaded Opportunity/Company context, starter suggestion, explicit Save, 3 items, 2 stages, total and reload persistence |
| Read-only UI | Passed | GENERATED record showed `Только чтение`; all 8 form controls were disabled and add/save actions were absent |
| App route auth | Passed | All browser editor/context calls completed through the installed front component application token |
| Smoke cleanup | Passed | Only the isolated UI smoke proposals, Opportunity and Company were deleted after validation |

The deployed release manifest records commit
`953e5598ae062372444d65bb214434887805305d`. The browser smoke additionally
verified that repeated stage fields have distinct non-empty HTML control ids in
the final bundle.

## Known Limitations

- `AGGREGATE_V2` generation remains blocked until Prompt 5.3.
- Optimistic concurrency is best-effort; Twenty SDK/Core API v2.20.0 exposes no
  confirmed CAS or multi-object transaction primitive.
- Unsaved-close interception is unavailable through the supported front SDK.
- Ephemeral integration requires a dedicated disposable Twenty instance and is
  not replaced by target tests.
- Twenty SDK/Core API v2.20.0 does not expose a confirmed conditional
  multi-object transaction; the editor therefore provides replay-safe,
  convergent best-effort concurrency rather than strict exactly-once saves.
- Browser close interception is not exposed by the supported front-component
  API; dirty state is shown inside the editor, but the host cannot be forced to
  display a native leave confirmation.
