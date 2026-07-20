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
| Unit tests | Passed | 3 files / 79 tests before final deployment validation |
| Document-service regression | Passed | 4 tests |
| WSL tarball build | Passed | Manifest paths and compiled logic-function checks passed |
| Initial metadata plan | Passed | 2 add, 9 change, 0 destroy |

## Target Validation

Target deployment and UI smoke results are recorded here after the private
publish/install. No result is marked passed before it is actually observed.

## Known Limitations

- `AGGREGATE_V2` generation remains blocked until Prompt 5.3.
- Optimistic concurrency is best-effort; Twenty SDK/Core API v2.20.0 exposes no
  confirmed CAS or multi-object transaction primitive.
- Unsaved-close interception is unavailable through the supported front SDK.
- Ephemeral integration requires a dedicated disposable Twenty instance and is
  not replaced by target tests.
