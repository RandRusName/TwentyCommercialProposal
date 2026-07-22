# External Capabilities

Document generation is a technical capability behind
`DocumentGenerationPort` and `HttpDocumentServiceAdapter`.

```text
Commercial Proposals
  -> DocumentGenerationPort
  -> HttpDocumentServiceAdapter
  -> document-service
       -> private MinIO
       -> LibreOffice
```

The proposal module knows only normalized payloads, requested formats and
generated-file metadata. It does not know bucket credentials, object paths,
LibreOffice commands or XLSX XML.

The worker authenticates requests, validates schema/template compatibility,
uses idempotent manifests, writes private objects and returns expiring URLs.
Readiness is false when template, storage, PDF engine or writable temporary
storage is unavailable. Logs exclude secrets and full customer payloads.
