# Known Limitations

- GitHub CI was not observed green in this session because changes were not
  pushed and no workflow URL was available.
- Ephemeral integration tests require a temporary Twenty instance and were not
  executed locally in this Phase 4 session.
- Phase 3 target UI vertical slice is verified for Opportunity to
  `CommercialProposal` DRAFT.
- Restricted-user permission scenario is still not verified on the target
  Workspace.
- Document-service container build and local readiness were verified locally,
  but target deployment is still required.
- `DOCUMENT_SERVICE_URL` and `DOCUMENT_SERVICE_SECRET` must be configured on the
  target Twenty app installation before generation can work from the UI.
- Target storage should use MinIO/S3-compatible storage. Local storage is only a
  development mode.
- Compose currently uses `minio/minio:latest` and `minio/mc:latest` to avoid a
  non-existent pinned tag. Pin image digests after the first successful target
  deployment.
- Template v1 supports up to 5 work items and 1 to 3 plan stages. More work
  items fail validation instead of being silently truncated.
- Download URL refresh without regeneration is represented in metadata but does
  not yet have a dedicated front-component refresh action.
- No DOCX generation is implemented.
- No email/send workflow is implemented.

