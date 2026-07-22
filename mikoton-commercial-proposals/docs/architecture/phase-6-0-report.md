# Phase 6.0 Architecture Report

Date: 2026-07-22 (Europe/Moscow)

## Result

The installable product remains one Twenty App. Commercial Proposals is now an
explicit business module inside a modular monolith with Foundation, Sales,
Catalog, Documents and Administration boundaries.

## Applied Changes

- Added a typed module registry and dependency declarations.
- Added Sales, Catalog and Documents ports with compatibility adapters around
  the existing Twenty repositories and document-service client.
- Added a Twenty compatibility policy for the verified `2.20.x` line.
- Added an Administration settings contract with compatibility defaults; no
  settings metadata object was created.
- Added `yarn test:architecture` and made it a CI gate.
- Added ADR-002 through ADR-007 and the incremental migration map.

Existing metadata, universal identifiers, routes and business behavior were
kept intact. Legacy source folders remain as documented migration shims.

## Verification

| Check | Result | Evidence |
|---|---|---|
| Lint | Passed | 94 files, zero warnings/errors |
| Typecheck | Passed | `tsgo --noEmit` |
| Unit tests | Passed | 182 tests |
| Architecture gate | Passed | 82 TypeScript files, 6 module boundaries |
| Document-service tests | Passed | 18 tests |
| Secret/private URL scans | Passed | No shipping secret or private target URL leakage |
| WSL tarball validation | Passed | App `0.1.54`, forward-slash manifest paths |
| Private publish/install | Passed | `mikoton-target`, Twenty `v2.20.0` |
| Target API smoke | Passed | 8/8 after upgrade |
| Existing record compatibility | Passed | `КП-011 от 22.07.2026` opens in the central record page with two files |
| Repeated metadata plan | Passed | No changes |
| GitHub CI | Passed | Release source commit `f4bd0a3`, run `29945502085` |

## Deferred Migration

The broad legacy repository and use-case folders are intentionally not moved in
one release. The ordered extraction is documented in `migration-plan.md`; each
step requires green tests, an unchanged metadata plan and target smoke when
runtime wiring changes.

Phase 5.5 production acceptance still has separate operational blockers:
restricted-user smoke, controlled runtime failure/retry, and runtime rollback.
They do not invalidate the stable baseline used for this architecture phase and
are not marked as passed.

## Verdict

**PHASE 6.0 COMPLETE — CRM APPLICATION ARCHITECTURE ESTABLISHED**
