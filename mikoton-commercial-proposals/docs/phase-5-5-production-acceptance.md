# Phase 5.5 Production Acceptance

Date: 2026-07-22 (Europe/Moscow)

Target: Twenty `v2.20.0`, `http://192.168.100.11:3000`, remote `mikoton-target`.

## Release Evidence

| Field | Value |
|---|---|
| Installed App version | `0.1.54`, verified in Settings -> Applications |
| Release source commit | `f4bd0a34a4440c96e38303318d738f6b682b3b25` |
| Tarball | `mikoton-commercial-proposals-0.1.54.tgz` |
| Tarball size | `2,649,935` bytes |
| Tarball SHA-256 | `fc2c26e5bc02b88a44d7bf4ce8849d58141ef797f3833b9daa6f114d7ca797ef` |
| Document-service image digest | `sha256:9224204bd5eb1cdb58503d6f4bc975427a2c631cec01f93f8c8d000e3bc1b067` |
| Metadata plan after install | No changes; no destructive operations |
| Target API smoke | Passed, `8/8` tests in `25.87s` after the `0.1.54` upgrade |
| Target UI smoke record | `2f2cfe80-6756-4fe9-8dcb-43052ac92ee3` |
| Generated proposal | `КП-011 от 22.07.2026` |

CI for the release source commit passed in GitHub Actions run
`29945502085`.

## Backup And Restore

Backup checkpoint: `20260722T140611Z`, stored on the target host under
`/home/roman/backups/twenty-commercial-proposals/20260722T140611Z`.

| Artifact | Bytes | SHA-256 |
|---|---:|---|
| `twenty-default.dump` | 1,037,992 | `42a033325ac555233014a1b91f73080af77a401c8acbb2881742562eabeba6eb` |
| `twenty-globals.sql` | 671 | `2aa503c0b69d7ea1883058d7e25f1dae4bb934d7c2448e2a2ab4de873fcf3aa1` |
| `twenty-local-storage.tar.gz` | 6,723,413 | `cefcf63d1273bb8a92a939a2a420a6a5d4f5966a4844ec3de18aa758aa1a05a1` |
| `minio-commercial-proposals.tar.gz` | 1,694,843 | `5d8dae3f20d6068a03515672a58495884a0a1b1f1866cd8d59c0212cd0c7572f` |
| `runtime-config.tar.gz` | 2,563 | `2f252659908e0bb53ca30c7fe7cb54fbe859689ce22807ea001884f427202005` |

An isolated restore rehearsal passed: the restored database exposed 98
non-system tables, Twenty file storage contained 76 files, and restored MinIO
contained 100 files and became ready. Rehearsal containers and volumes were
removed after verification. Production data was not altered.

## Verification

| Check | Result | Evidence |
|---|---|---|
| Lint | Passed | Local release build |
| Typecheck | Passed | Local release build |
| Unit tests | Passed | 182 tests |
| Document-service tests | Passed | 18 tests |
| Architecture dependency gate | Passed | 82 TypeScript files, 6 module boundaries |
| WSL build / tarball validation | Passed | App `0.1.54`, hash above |
| Private publish / install | Passed | Installed/current version `0.1.54` in Twenty UI |
| Document-service health/readiness | Passed | Reachable from the Twenty container |
| Storage | Passed | Private MinIO bucket; Twenty container can retrieve signed objects |
| Repeated metadata plan | Passed | `No changes. Twenty metadata matches your manifest.` |
| Backend target smoke | Passed | 8/8; legacy v1, Aggregate v2, idempotency, safe errors |
| Authenticated UI route | Passed | Opportunity context loaded in the create component |
| Central editor | Passed | Aggregate v2 item and stage saved; total `11,000 RUB` |
| Generation | Passed | DRAFT -> GENERATED, final number `КП-011 от 22.07.2026` |
| Attachments | Passed | One XLSX and one PDF visible in the card/list and downloadable |
| Restricted-user smoke | **Not executed** | No prepared restricted account/session was available |
| Controlled runtime failure/retry | **Not executed** | No production dependency fault was injected |
| Runtime rollback rehearsal | **Not executed** | Backup restore passed; App/image rollback was not performed on target |
| Release source CI | Passed | GitHub Actions run `29945502085`, commit `f4bd0a3` |

## Runtime Fix Confirmed During Acceptance

MinIO had been published only on target loopback while signed URLs used the
target LAN address. `MINIO_BIND_ADDRESS` now makes the API bind explicit; the
target uses its LAN address for port 9000 while the MinIO console remains on
loopback. No Twenty source code or image was changed.

## Verdict

**NOT READY FOR PRODUCTION USE**

The production flow itself is operational and was exercised end to end. Prompt
5.5 nevertheless defines the restricted-user scenario, controlled
`FAILED -> retry -> GENERATED` and runtime rollback as mandatory. Those
acceptance proofs remain open and are not represented as passed.
