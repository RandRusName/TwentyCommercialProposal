# Phase 4 Smoke Test

Status: target API smoke passed; manual Excel/PDF visual check still pending.

Date: 2026-07-17

## Versions

- Target Twenty: `v2.20.0`
- App version: `0.1.31`
- App release commit: `663aae2685905a6fd6951f9f054d3fbfbae76174`
- Tarball: `mikoton-commercial-proposals-0.1.31.tgz`
- Tarball SHA-256: `a4f723a12994214414c0323d028121d5cbc5576ae2ab58cd36beaa5cd11b3f2d`
- Document-service image: `mikoton-commercial-proposals/document-service:local`
- PDF engine: `LibreOffice headless`
- Storage: MinIO/S3-compatible, private bucket `commercial-proposals`

## Deployment

`deploy.bat` completed successfully on 2026-07-17:

- previous version: `0.1.30`
- published version: `0.1.31`
- private publish: success
- install/upgrade: success
- WSL tarball validation: success

Metadata plan after deployment:

```text
yarn twenty plan -r mikoton-target .
No changes. Twenty metadata matches your manifest.
```

## Target API Smoke

Created records:

- Company: `852b0de3-2f2e-4396-81fe-7205ba69cc0c`
- Opportunity: `0976321b-d66a-4a7c-9494-08f2ed048fe6`
- CommercialProposal: `7d623e71-35a2-4b33-ac3a-a950bdba05fe`
- Proposal number: `КП-010 от 17.07.2026`
- Generation id: `36e7edd0852e1fc178562dd36e30f8ab`

Verified:

- status: `GENERATED`
- `generatedAt`: `2026-07-17T13:19:53.000Z`
- `lastError`: empty
- Opportunity relation: `0976321b-d66a-4a7c-9494-08f2ed048fe6`
- Company relation: `852b0de3-2f2e-4396-81fe-7205ba69cc0c`
- repeated request with the same generation key returned `generated=false`
- result metadata contains `xlsm` and `pdf`
- both result files contain Twenty file ids and Twenty file URLs
- CommercialProposal `Files` tab is backed by two standard Attachment records

Generated attachments:

| Format | File |
|---|---|
| XLSM | `КП-010-от-17.07.2026-SMOKE-Files-Linked-2026-07-17T13-19-51-386Z.xlsm` |
| PDF | `КП-010-от-17.07.2026-SMOKE-Files-Linked-2026-07-17T13-19-51-386Z.pdf` |

## Previously Verified Foundation

- Document-service and MinIO were deployed in the Twenty Docker network.
- `curl http://document-service:8010/healthz` from the Twenty network returned `200`.
- `curl http://document-service:8010/readyz` returned `200`.
- Readiness covered template, mapping, writable temp directory, storage, and PDF engine.
- Downloaded XLSM package checks previously confirmed presence of:
  - `xl/vbaProject.bin`
  - `xl/drawings/drawing1.xml`
  - `xl/drawings/vmlDrawing1.vml`
  - `xl/printerSettings/printerSettings1.bin`
  - `xl/ctrlProps/ctrlProp1.xml`
  - `_xlnm.Print_Area`

## Not Yet Verified

- Manual UI click path from a CommercialProposal record to `Сформировать документ`.
- Manual XLSM opening in Microsoft Excel without repair warning.
- Manual visual comparison of the generated PDF against the XLSM layout.
- Forced `FAILED -> retry -> GENERATED` target scenario.

Current blocker before `READY FOR PHASE 5`:

```text
target UI smoke / manual XLSM-PDF check
```
