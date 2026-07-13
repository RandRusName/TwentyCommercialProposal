# Known Limitations

- GitHub CI was not observed green in this session because changes were not
  pushed and no workflow URL was available.
- Ephemeral integration tests require a temporary Twenty instance and were not
  executed locally in this Phase 4 session.
- Phase 3 target UI vertical slice is verified for Opportunity to
  `CommercialProposal` DRAFT.
- Company relation was not exercised in the latest UI smoke because the selected
  smoke Opportunity had no Company.
- Restricted-user permission scenario is still not verified on the target
  Workspace.
- Phase 4 document-service is implemented locally but not deployed on the target
  server.
- `DOCUMENT_SERVICE_URL` and `DOCUMENT_SERVICE_SECRET` have not been configured
  on the target Twenty app installation.
- Current document-service storage is local filesystem under
  `generated-documents/`; production S3/MinIO/Twenty Files storage is not
  configured.
- Current PDF generation uses ReportLab from the normalized payload. It is not
  yet an Excel/LibreOffice print-area export.
- Template v1 supports up to 5 work items and 1 to 3 plan stages. More work
  items fail validation instead of being silently truncated.
- No DOCX generation is implemented.
- No email/send workflow is implemented.

