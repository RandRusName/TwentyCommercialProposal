# Template Versioning

Current template:

```text
templateCode = mikoton-commercial-proposal
templateVersion = 1
```

Files:

```text
templates/mikoton-commercial-proposal-v1.xlsm
templates/mikoton-commercial-proposal-v1.mapping.json
```

Rules:

- Never edit the original user-provided workbook directly.
- Add a new `vN` template file for mapping-breaking changes.
- Keep old templates available while generated records reference them.
- Store resolved `templateCode` and `templateVersion` on `CommercialProposal`.
- Store generation file metadata in `resultMetadata`.

