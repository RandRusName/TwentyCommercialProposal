# Production Acceptance Procedure

Production acceptance is evidence-based and runs against isolated smoke data.

1. Record final commit, package version, tarball SHA-256, document-service image
   digest, and template/mapping hashes.
2. Obtain a green GitHub Actions run for that exact commit.
3. Create and verify Twenty plus MinIO backups; rehearse restore in isolation.
4. Run WSL metadata plan and require zero destructive changes.
5. Deploy the document-service and App; run repeated plan and require no drift.
6. Execute admin and restricted-user E2E, concurrency, runtime failure/retry,
   timeout-after-success, and partial-attachment recovery scenarios.
7. Manually inspect XLSX and PDF and verify historical proposals/files.
8. Rehearse rollback without uninstall.

No single local test, previous smoke report or administrator session substitutes
for these checks.
