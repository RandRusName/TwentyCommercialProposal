# Phase 5.5 Production Acceptance

Date: 2026-07-22 (Europe/Moscow)

App version: `0.1.49` (Phase 5.5 **CORRECTIVE**). Twenty `v2.20.0`, remote `mikoton-target`.

## Final evidence (code baseline and CI verified; target pending)

Do not invent target values. The corrective code baseline, CI run and locally
rebuilt private artifact are recorded below. Target deployment remains gated by
the required backup/restore checkpoint.

| Field | Value |
|---|---|
| App version | `0.1.49` |
| Exact code commit | `16d5c67ad152101e3847b2af7abd3b56fa6e4047` |
| Tarball filename | `mikoton-commercial-proposals-0.1.49.tgz` |
| Tarball size | `2,646,814` bytes |
| Tarball SHA-256 | `44143D9BAC0C5AA60C8526EB4A6F724F5B81D4E896C35E4402D4018FE8FD30A7` |
| Template v1 SHA-256 | `6777A3CF9CC6A1A4BE0CCD1BABB93FA2DAFF6CD37EE9A9C1405E1EC4BD187AD0` (`mikoton-commercial-proposal-v1.xlsm`) |
| Mapping v1 SHA-256 | `0F4580FDAC5E4DA5F1DC334CB6D64695B90F722DB9FAA8C040542EE0B57FFED5` |
| Template v2 SHA-256 | `F5994EE83DA4DE932C4D7504D78BC4E2A22EC881415AA38AFAB58A6CE701A900` (`mikoton-commercial-proposal-v2.xlsx`) |
| Mapping v2 SHA-256 | `B09EC8CF36DF95BA29F5CE45DE01C162BBF60508304989998E66AAC1382BEF00` |
| Document-service target image digest | **Pending** — target deployment not performed |
| Integration CI run | [GitHub Actions run 29922602764](https://github.com/RandRusName/TwentyCommercialProposal/actions/runs/29922602764) — **Passed** |

## Code fixes implemented at 0.1.49 (CORRECTIVE)

| Item | State |
|---|---|
| Generation claim: `operationId` (logical idempotent op) vs `ownerToken` (physical worker token) | Implemented |
| Fencing: `assertGenerationClaimOwnership` before irreversible actions | Implemented |
| Lease: 10 min (`GENERATION_CLAIM_LEASE_MS`); renew before/after document-service and before attachments | Implemented |
| Stale takeover: expired lease → new `ownerToken`; old worker → `COMMERCIAL_PROPOSAL_GENERATION_OWNERSHIP_LOST` | Implemented |
| Ownership lost: no `FAILED` write, no claim delete, no attachments | Implemented |
| `AcquireGenerationClaimResult`: `ACQUIRED` vs `IN_PROGRESS` (parallel same `operationId` → second `IN_PROGRESS`/409, not second owner) | Implemented |
| Catalog cursor v2: `filterFingerprint` binding; `skip` 0..100; `after` length bounds | Implemented |
| `POST /catalog-items/categories` complete category list (`PARTIAL` on safety limit) | Implemented |
| Search returns empty `categories` + `pageCategories` | Implemented |
| Backend `normalizeCurrencyCode` (trim+upper, `[A-Z]{3}`) | Implemented |
| `itemType` allowlist on assignment; malformed `itemType` disabled in search (not selectable `SERVICE`) | Implemented |
| Worker `DOCUMENT_STORAGE_*` credentials fail-closed | Implemented (carried from 0.1.48) |
| Hardcoded private URL removal + `yarn test:private-urls` | Implemented (carried from 0.1.48) |

Platform note: Twenty SDK / Core API 2.20 still provides **no** App-level transactions or linearizability beyond the unique claim index. Docs must not claim otherwise.

## Code / local verification

| Check | State | Evidence |
|---|---|---|
| Lint | Passed locally | `yarn lint` — 0 warnings / 0 errors |
| Typecheck | Passed locally | `yarn typecheck` |
| Unit tests | Passed locally | `yarn test:unit` — 176 tests |
| Document-service tests | Passed locally | `py -3 -m unittest` — 18 tests |
| `yarn test:secrets` | Passed locally | 170 tracked files |
| `yarn test:private-urls` | Passed locally | 31 shipping runtime files |
| Private tarball build | Passed locally | `0.1.49`, 2,646,814 bytes, WSL production build |
| Tarball validation | Passed locally | Claim unique index + `ownerToken` + categories LF present |
| Ephemeral integration CI | Passed | Run `29922602764`; real legacy and aggregate generation vertical slices passed |
| Metadata plan on target | Passed, read-only | Repeated on 2026-07-22: `19 add`, `12 in-place change`, `0 destroy`; nothing applied |

## Target / operator acceptance — NOT DONE / blocked

No target evidence exists for `0.1.49`. Treat every row as blocked until recorded.

| Check | State | Required evidence |
|---|---|---|
| Target metadata apply / repeated plan | **NOT DONE** | Successful install; empty repeated plan; claim object with `ownerToken` |
| Final-number / catalog backfills | **NOT DONE** | Dry-run, duplicate-free apply, verification counts |
| Target E2E | **NOT DONE** | Isolated proposal ids, unique keys/numbers and files |
| Same-proposal concurrency on target | **NOT DONE** | Parallel same `operationId` → second `IN_PROGRESS`/409; different op unexpired → 409; stale lease takeover |
| Ownership-lost fencing on target | **NOT DONE** | Old worker after takeover: `OWNERSHIP_LOST`, no `FAILED`, claim retained by new owner, no extra attachments |
| Runtime FAILED / retry | **NOT DONE** | Controlled dependency fault and final GENERATED evidence |
| Manifest / attachment recovery | **NOT DONE** | Same generation id/hashes and exactly one XLSX/PDF |
| Restricted user | **NOT DONE** | Role setup, allowed/denied route evidence |
| Credential rotation (`DOCUMENT_STORAGE_*`, App secrets) | **NOT DONE** | Operator timestamp and post-rotation readiness/smoke |
| Backup / restore | **NOT DONE** | Backup identifiers, checksums and isolated restore evidence |
| Rollback rehearsal | **NOT DONE** | Previous artifact/image restored; claim metadata left additive |
| Final UI / XLSX / PDF / legacy regression | **NOT DONE** | Screenshots, hashes and manual inspection results |

## Current Verdict

**PHASE 5.5 INCOMPLETE — NOT READY FOR PRODUCTION**

Corrective code for Phase 5.5 is implemented at App `0.1.49` (claim fencing,
lease renewal, catalog cursor/categories, currency/`itemType` hardening), and
the exact code commit has a green ephemeral integration CI run. Target install,
image digest, backup/restore evidence and operator acceptance checks remain
**NOT DONE**. Do not tag `v1.0.0` and do not begin the production architectural
transition until this baseline is installed and accepted on target.
