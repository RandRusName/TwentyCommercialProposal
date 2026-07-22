# Production Acceptance Procedure

Production acceptance is evidence-based and runs against isolated smoke data.
App version for Phase 5.5 CORRECTIVE: `0.1.49`. Code commit
`16d5c67ad152101e3847b2af7abd3b56fa6e4047` passed GitHub Actions run
[`29922602764`](https://github.com/RandRusName/TwentyCommercialProposal/actions/runs/29922602764).
The WSL tarball was rebuilt and validated at 2,646,814 bytes with SHA-256
`44143D9BAC0C5AA60C8526EB4A6F724F5B81D4E896C35E4402D4018FE8FD30A7`.
Target/operator checks below remain mandatory. Verdict stays
**PHASE 5.5 INCOMPLETE — NOT READY FOR PRODUCTION** until target evidence is
recorded. Target image digests and operator timestamps are to be recorded at
the final release commit — do not invent them.

1. Record final commit, package version (`0.1.49` or later patch), tarball
   SHA-256, document-service image digest, and template/mapping hashes.
2. Obtain a green GitHub Actions run for that exact commit.
3. Create and verify Twenty plus MinIO backups; rehearse restore in isolation.
4. Run WSL metadata plan and require zero destructive changes; apply metadata
   including `CommercialProposalGenerationClaim` (`operationId`, `ownerToken`,
   lease fields).
5. Deploy the document-service (with required `DOCUMENT_STORAGE_*` worker
   credentials) and App; run repeated plan and require no drift.
6. Execute admin and restricted-user E2E on target, including:
   - parallel same `operationId` → second caller `IN_PROGRESS` / HTTP 409
     (not a second owner);
   - stale lease takeover → new `ownerToken`; old worker
     `COMMERCIAL_PROPOSAL_GENERATION_OWNERSHIP_LOST` with no `FAILED` write,
     no claim delete by the loser, no attachments;
   - runtime failure/retry, timeout-after-success, and partial-attachment
     recovery.
7. Manually inspect XLSX and PDF and verify historical proposals/files.
8. Rehearse rollback without uninstall (claim object is additive /
   forward-compatible).

No single local test, previous smoke report or administrator session substitutes
for these checks. See `phase-5-5-production-acceptance.md` for the current
evidence matrix.
