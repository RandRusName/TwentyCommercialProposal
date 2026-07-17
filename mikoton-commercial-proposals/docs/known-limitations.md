# Known Limitations

- GitHub CI was not observed green in this session because changes were not
  pushed and no workflow URL was available.
- Ephemeral integration tests require a temporary Twenty instance and were not
  executed locally in this Phase 4 session.
- Phase 3 target UI vertical slice is verified for Opportunity to
  `CommercialProposal` DRAFT.
- Restricted-user permission scenario is still not verified on the target
  Workspace.
- Document-service container build, target deployment and target readiness were
  verified on 2026-07-17.
- `DOCUMENT_SERVICE_URL` and `DOCUMENT_SERVICE_SECRET` were configured on the
  target Twenty app installation through the metadata API.
- Target storage uses MinIO/S3-compatible storage with private bucket and
  expiring signed URLs.
- Compose currently uses `minio/minio:latest` and `minio/mc:latest` to avoid a
  non-existent pinned tag. Pin image digests after the first successful target
  deployment.
- Template v1 supports up to 5 work items and 1 to 3 plan stages. More work
  items fail validation instead of being silently truncated.
- Download URL refresh without regeneration is represented in metadata but does
  not yet have a dedicated front-component refresh action.
- CommercialProposal default UI metadata has been changed to remove obsolete
  DOCX/PDF URL fields. Target metadata apply must be accepted only if the plan
  is limited to app-owned fields.
- JSON/debug fields remain stored for audit but should not be part of the
  default business view. If Twenty `v2.20.0` still exposes them in the record
  field settings picker, that is a platform UI behavior rather than a runtime
  generation dependency.
- Manual UI generation smoke and manual Microsoft Excel repair-warning check
  are not yet executed for the current build.
- Forced target `FAILED -> retry -> GENERATED` recovery test is not yet
  executed.
- No DOCX generation is implemented.
- No email/send workflow is implemented.
