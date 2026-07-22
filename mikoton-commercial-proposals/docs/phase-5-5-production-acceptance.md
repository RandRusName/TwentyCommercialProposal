# Phase 5.5 Production Acceptance

Date: 2026-07-22 (Europe/Moscow)

App version: `0.1.48`. Twenty `v2.20.0`, remote `mikoton-target`.

Local candidate artifact (pre-CI, pre-target):

| Field | Value |
|---|---|
| App version | `0.1.48` |
| Tarball filename | `mikoton-commercial-proposals-0.1.48.tgz` |
| Tarball size | 2,580,891 bytes |
| Tarball SHA-256 | `F3678A4369A39CF58EF1D26E158FA7E36C0B99FF11462E9A4C5BC0BAA1A4D30B` |
| Template v1 SHA-256 | `6777A3CF9CC6A1A4BE0CCD1BABB93FA2DAFF6CD37EE9A9C1405E1EC4BD187AD0` |
| Mapping v1 SHA-256 | `0F4580FDAC5E4DA5F1DC334CB6D64695B90F722DB9FAA8C040542EE0B57FFED5` |
| Template v2 SHA-256 | `F5994EE83DA4DE932C4D7504D78BC4E2A22EC881415AA38AFAB58A6CE701A900` |
| Mapping v2 SHA-256 | `B09EC8CF36DF95BA29F5CE45DE01C162BBF60508304989998E66AAC1382BEF00` |
| Document-service image digest | Not rebuilt/recorded in this local pass |
| Exact git commit | To be filled after the implementation commit is created |
| Integration CI run | Not yet run for `0.1.48` |

## Code fixes implemented at 0.1.48

| Item | State |
|---|---|
| Generation claim (`CommercialProposalGenerationClaim`, unique `proposalKey`) | Implemented |
| Stale-lock recovery via `leaseExpiresAt` (5 min) | Implemented |
| Currency normalization (null / `''` / whitespace / `rub`) | Implemented |
| Catalog opaque cursor pagination (no gaps/dupes) | Implemented |
| Canonical CatalogItem validation on new assignment | Implemented |
| Worker `DOCUMENT_STORAGE_*` credentials fail-closed | Implemented |
| Hardcoded private URL removal + `yarn test:private-urls` | Implemented |

## Code / local verification

| Check | State | Evidence |
|---|---|---|
| Lint | Passed locally | 79 files, 0 errors |
| Typecheck | Passed locally | `yarn typecheck` exit 0 |
| Unit tests | Passed locally | 8 files, 148 tests |
| Document-service tests | Passed locally | 18 tests, including worker credential fail-closed |
| `yarn test:secrets` | Passed locally | Tracked-file scan clean |
| `yarn test:private-urls` | Passed locally | 29 shipping runtime files clean |
| Private tarball build | Passed locally | `0.1.48`, 2,580,891 bytes |
| Tarball validation | Passed locally | Unique indexes incl. generation claim; no private IP / target fallback |
| Ephemeral integration CI | **Not verified for 0.1.48** | Requires push / CI run on exact commit |
| Metadata plan on target | **Not verified** | Operator section |

## Target / operator acceptance — NOT YET VERIFIED

| Check | State | Required evidence |
|---|---|---|
| Target metadata apply / repeated plan | **NOT YET VERIFIED** | Successful install; empty repeated plan; claim object present |
| Final-number / catalog backfills | **NOT YET VERIFIED** | Dry-run, duplicate-free apply, verification counts |
| Target E2E | **NOT YET VERIFIED** | Isolated proposal ids, unique keys/numbers and files |
| Same-proposal concurrency on target | **NOT YET VERIFIED** | Second attempt → `COMMERCIAL_PROPOSAL_GENERATION_IN_PROGRESS`; same-op replay OK |
| Runtime FAILED / retry | **NOT YET VERIFIED** | Controlled dependency fault and final GENERATED evidence |
| Manifest / attachment recovery | **NOT YET VERIFIED** | Same generation id/hashes and exactly one XLSX/PDF |
| Stale claim / lease recovery on target | **NOT YET VERIFIED** | Expired lease allows a new owner |
| Restricted user | **NOT YET VERIFIED** | Role setup, allowed/denied route evidence |
| Credential rotation (`DOCUMENT_STORAGE_*`, App secrets) | **NOT YET VERIFIED** | Operator timestamp and post-rotation readiness/smoke |
| Backup / restore | **NOT YET VERIFIED** | Backup identifiers, checksums and isolated restore evidence |
| Rollback rehearsal | **NOT YET VERIFIED** | Previous artifact/image restored; claim metadata left additive |
| Final UI / XLSX / PDF / legacy regression | **NOT YET VERIFIED** | Screenshots, hashes and manual inspection results |

## Current Verdict

**PHASE 5.5 INCOMPLETE — NOT READY FOR PRODUCTION**

Code hardening for Phase 5.5 is implemented at App `0.1.48` with local lint,
typecheck, unit, document-service, secret and private-URL scans green, and a
candidate tarball built. Integration CI on the exact commit and all
target/operator acceptance checks remain incomplete. Do not tag `v1.0.0`.
