# ADR-005: Document Generation Port

Status: Accepted

## Decision

Commercial Proposals invokes document generation through the generic
`DocumentGenerationPort`. The HTTP document-service implementation lives in
Documents infrastructure.

## Consequences

Proposal business logic is isolated from HTTP authentication, MinIO,
LibreOffice and workbook internals. The current legacy service file remains a
compatibility implementation during migration; presentation code imports the
Documents adapter path.
