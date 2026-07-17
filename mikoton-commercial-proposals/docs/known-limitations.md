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
- Obsolete DOCX/PDF URL fields were removed from app metadata. Target metadata
  plan on 2026-07-17 returned no changes after deployment of app `0.1.31`.
- JSON/debug fields remain stored for audit but should not be part of the
  default business view. If Twenty `v2.20.0` still exposes them in the record
  field settings picker, that is a platform UI behavior rather than a runtime
  generation dependency.
- Target API smoke for app `0.1.31` confirmed `GENERATED`, final number
  `КП-010 от 17.07.2026`, two Twenty Attachment records in the
  CommercialProposal Files tab, XLSM/PDF formats, and idempotent repeated
  generation.
- Starting with the next deployment after app `0.1.31`, generated Excel files
  are `.xlsx` without VBA/macros. A new target smoke is required to replace the
  older XLSM/PDF evidence above.
- Manual UI generation smoke and manual Microsoft Excel opening check are not
  yet executed for the XLSX build.
- Forced target `FAILED -> retry -> GENERATED` recovery test is not yet
  executed.
- No DOCX generation is implemented.
- No email/send workflow is implemented.
