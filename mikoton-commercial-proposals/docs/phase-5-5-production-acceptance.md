# Phase 5.5 Production Acceptance

Date: 2026-07-22 (Europe/Moscow)

Baseline: commit `3cf526320e77c1a21def2c56527c9199540a59c1`, App
`0.1.47`, Twenty `v2.20.0`, remote `mikoton-target`.

## Verified Evidence

| Check | Result | Evidence |
|---|---|---|
| Lint | Passed | 75 files, 0 warnings/errors |
| Typecheck | Passed | `yarn typecheck` exit 0 |
| Unit tests | Passed | 8 files, 135 tests |
| Document-service tests | Passed | 17 tests, including real HTTP auth/body-limit cases |
| WSL tarball build | Passed | `0.1.47`, 2,530,310 bytes |
| Tarball SHA-256 | Passed | `9616350ec905867304d070ffe3c1cdf697a5c0ae272cfe9b16a22d7b507f7ee5` |
| Tarball validation | Passed | forward slashes, required files and unique indexes present |
| Template v1 SHA-256 | Recorded | `6777a3cf9cc6a1a4be0ccd1babb93fa2daff6cd37ee9a9c1405e1ec4bd187ad0` |
| Mapping v1 SHA-256 | Recorded | `0f4580fdac5e4da5f1dc334cb6d64695b90f722db9faa8c040542ee0b57ffed5` |
| Template v2 SHA-256 | Recorded | `f5994ee83da4de932c4d7504d78bc4e2a22ec881415aa38afab58a6ce701a900` |
| Mapping v2 SHA-256 | Recorded | `b09ec8cf36df95ba29f5ce45de01c162bbf60508304989998e66aac1382bef00` |
| Secret scan | Passed locally | 145 tracked files; no committed secret pattern found |
| Document-service image build | Passed locally | image ID `sha256:22b4a8b00538a56bd27986a24f09fa2530c5049364c1f4aefb240ab654ecd7ad` |
| Missing service secret | Passed locally | container exits non-zero; HTTP test returns 503 |
| Wrong service secret | Passed locally | HTTP 401 |
| Oversized request | Passed locally | HTTP 413 |
| Metadata plan | Safe, not applied | 10 app-owned additions, 11 checksum updates, 0 destroy |

The artifact above is an uncommitted release-candidate build and is not a final
production artifact. It must be rebuilt from the final clean commit.

## Not Yet Verified

| Check | State | Required evidence |
|---|---|---|
| Integration test | Blocked locally | Ephemeral Twenty URL/API key and passing CI job |
| Final CI | Not run | Green workflow URL for final commit |
| Target metadata apply/repeated plan | Not run | Successful install and empty repeated plan |
| Final-number backfill | Not run | Dry-run, duplicate-free apply, verification count |
| Target E2E and parallel numbering | Not run | Isolated proposal ids, unique keys/numbers and files |
| Restricted user | Not run | Role setup, allowed/denied route evidence |
| Runtime FAILED/retry | Not run | Controlled dependency fault and final GENERATED evidence |
| Manifest/attachment recovery | Not run | Same generation id/hashes and exactly one XLSX/PDF |
| Credential rotation | Not confirmed | Operator timestamp and post-rotation readiness/smoke |
| Backup/restore | Not run | Backup identifiers, checksums and isolated restore evidence |
| Rollback rehearsal | Not run | Previous artifact/image restored in isolation |
| Final UI/XLSX/PDF/legacy regression | Not run | Screenshots, hashes and manual inspection results |

## Current Verdict

The code hardening and local verification are substantial, but the mandatory
operator, target, CI, restore and recovery evidence is incomplete. The App must
remain on the release-candidate patch line and must not be tagged `v1.0.0`.
