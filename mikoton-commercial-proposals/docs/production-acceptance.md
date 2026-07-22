# Production Acceptance Procedure

Production acceptance is evidence-based and runs against isolated smoke data.
App version for Phase 5.5 code closure: `0.1.48`. Code fixes are implemented;
target/operator checks below remain mandatory. Verdict stays **NOT READY** until
they are recorded. Artifact hashes, CI run ids and operator timestamps are to
be recorded at the final release commit — do not invent them.

1. Record final commit, package version (`0.1.48` or later patch), tarball
   SHA-256, document-service image digest, and template/mapping hashes.
2. Obtain a green GitHub Actions run for that exact commit.
3. Create and verify Twenty plus MinIO backups; rehearse restore in isolation.
4. Run WSL metadata plan and require zero destructive changes; apply metadata
   including `CommercialProposalGenerationClaim`.
5. Deploy the document-service (with required `DOCUMENT_STORAGE_*` worker
   credentials) and App; run repeated plan and require no drift.
6. Execute admin and restricted-user E2E, concurrency (same-proposal claim),
   runtime failure/retry, timeout-after-success, and partial-attachment recovery
   scenarios on the target.
7. Manually inspect XLSX and PDF and verify historical proposals/files.
8. Rehearse rollback without uninstall (claim object is additive /
   forward-compatible).

No single local test, previous smoke report or administrator session substitutes
for these checks. See `phase-5-5-production-acceptance.md` for the current
evidence matrix.
