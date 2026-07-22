# Production Acceptance Procedure

Production acceptance uses isolated `[SMOKE]` records and never uninstalls the
App from the target Workspace.

## Verified Baseline

- Twenty `v2.20.0`, remote `mikoton-target`.
- App `0.1.53` installed from a private Linux-compatible tarball.
- Document-service and private MinIO storage reachable from Twenty.
- Backup checkpoint and isolated restore rehearsal completed.
- Repeated metadata plan is empty.
- Backend target smoke passes `8/8`.
- Manual UI flow creates, edits and generates `КП-011 от 22.07.2026`.
- XLSX and PDF are attached to the CommercialProposal and downloadable.

Exact hashes and record identifiers are in
`docs/phase-5-5-production-acceptance.md`.

## Remaining Mandatory Acceptance

1. Use a prepared non-admin role and verify allowed and denied records/routes.
2. Inject a controlled document-service/PDF failure, verify `FAILED`, restore
   the dependency, retry with the expected idempotency behavior, and verify
   `GENERATED` without duplicate files.
3. Rehearse an App/document-service rollback without uninstalling the App or
   deleting additive metadata.
4. Obtain a green CI run for the final evidence/config commit.

Until all four are recorded, the evidence-based verdict remains
`NOT READY FOR PRODUCTION USE` even though the normal production flow is
operational.
