# Phase 4 Smoke Test

Status: target API smoke passed for app `0.1.32` with XLSX/PDF output; manual Excel/PDF visual check still pending.

Date: 2026-07-17

## Versions

- Target Twenty: `v2.20.0`
- App version: `0.1.32`
- App release commit: `354af194a5a034509a040853e15f63ae7058d54e`
- Tarball: `mikoton-commercial-proposals-0.1.32.tgz`
- Tarball SHA-256: `06118f11a33a087ddee01ec1532241e64e3f5b9858b0ef4d8e10586a39625737`
- Document-service image: `mikoton-commercial-proposals/document-service:local`
- PDF engine: `LibreOffice headless`
- Storage: MinIO/S3-compatible, private bucket `commercial-proposals`

## Deployment

`deploy.bat` completed successfully on 2026-07-17:

- previous version: `0.1.31`
- published version: `0.1.32`
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

- Company: `e436562c-b7c6-4e1e-b0e1-729d27613499`
- Opportunity: `52b3b055-dc01-4c5d-94be-c84b21f0def5`
- CommercialProposal: `df61e378-56c2-4914-8d9d-4c2f9a2110c0`
- Proposal number: `КП-011 от 17.07.2026`
- Generation id: `7dd95dd28629ce5f0ad0f7fefd09de5c`

Verified:

- status: `GENERATED`
- `generatedAt`: `2026-07-17T14:25:59.000Z`
- `lastError`: empty
- Opportunity relation: `52b3b055-dc01-4c5d-94be-c84b21f0def5`
- Company relation: `e436562c-b7c6-4e1e-b0e1-729d27613499`
- repeated request with the same generation key returned `generated=false`
- result metadata contains `xlsx` and `pdf`
- both result files contain Twenty file ids and Twenty file URLs
- CommercialProposal `Files` tab is backed by two standard Attachment records

Generated attachments:

| Format | File |
|---|---|
| XLSX | `КП-011-от-17.07.2026-SMOKE-XLSX-2026-07-17T14-25-56-829Z.xlsx` |
| PDF | `КП-011-от-17.07.2026-SMOKE-XLSX-2026-07-17T14-25-56-829Z.pdf` |

Downloaded XLSX package checks from target:

- ZIP package opens.
- `xl/workbook.xml`: present.
- `xl/worksheets/sheet1.xml`: present.
- `xl/vbaProject.bin`: absent.
- `macroEnabled` content type: absent.

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
- Manual XLSX opening in Microsoft Excel.
- Manual visual comparison of the generated PDF against the XLSX layout.
- Forced `FAILED -> retry -> GENERATED` target scenario.

Current blocker before `READY FOR PHASE 5`:

```text
target UI smoke / manual XLSX-PDF check
```
