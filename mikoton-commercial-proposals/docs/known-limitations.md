# Known Limitations

- Template v2 supports at most 50 work items and 10 stages; larger proposals are rejected, never truncated.
- Generation uses a best-effort editor revision recheck because Twenty v2.20.0 exposes no App-level multi-object transaction/CAS primitive.
- LibreOffice PDF output requires a manual visual check after material template changes.

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
- Target API smoke for app `0.1.32` confirmed `GENERATED`, final number
  `КП-011 от 17.07.2026`, two Twenty Attachment records in the
  CommercialProposal Files tab, XLSX/PDF formats, and idempotent repeated
  generation.
- Generated Excel files are `.xlsx` without VBA/macros. Target download check
  confirmed the XLSX ZIP package opens and does not contain `xl/vbaProject.bin`
  or a `macroEnabled` content type.
- Manual UI generation smoke and manual Microsoft Excel opening check are not
  yet executed for the XLSX build.
- Forced target `FAILED -> retry -> GENERATED` recovery test is not yet
  executed.
- No DOCX generation is implemented.
- No email/send workflow is implemented.
- The aggregate editor is explicit-save only. Twenty SDK v2.20.0 does not expose
  a supported front-component navigation blocker, so closing with unsaved data
  is indicated in the UI but cannot be intercepted reliably.
- Editor conflict handling reloads the canonical aggregate on explicit user
  action; automatic merge is intentionally not implemented.
- `AGGREGATE_V2` generation is enabled through schema `2.0` and macro-free XLSX
  template v2. Template v2 currently supports at most 50 work items and 10
  stages; larger proposals are rejected instead of truncated.
- Microsoft Excel was not available during Prompt 5.3 target validation. The
  downloaded XLSX passed ZIP/workbook parsing, formula and print-area checks,
  while LibreOffice produced and rendered a valid one-page PDF.
- Optimistic concurrency is best-effort unless a future target/platform spike
  proves an official CAS/conditional update primitive is available.
- Child `clientKey` replay safety is application-level parent+clientKey lookup;
  no database-level compound uniqueness guarantee is claimed in Prompt 5.1.
