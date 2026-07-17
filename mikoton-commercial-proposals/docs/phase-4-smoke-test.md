# Phase 4 Smoke Test

Status: partially executed on target Twenty.

Date: 2026-07-17

## Versions

- Target Twenty: `v2.20.0`
- App version: `0.1.25`
- App release commit: `d855b01a18c80e6cae790fa6e71f1bc211fd0b26`
- Tarball: `mikoton-commercial-proposals-0.1.25.tgz`
- Tarball SHA-256: `f4629f6bf82d07da68ce975627923b503ccd55755541029b7d80b72951591fc5`
- Document-service image: `mikoton-commercial-proposals/document-service:local`
- PDF engine: `LibreOffice headless`
- Storage: MinIO/S3-compatible, private bucket `commercial-proposals`

## Local Verification

- TypeScript unit tests: passed, 45 tests.
- Python document-service tests: passed, 4 tests.
- Docker build: passed.
- Container `/healthz`: passed locally.
- Container `/readyz`: passed locally with LibreOffice available.

## Target Deployment

Document-service and MinIO were deployed on the target host in Docker network:

```text
twenty_default
```

Twenty container reachability:

```text
curl http://document-service:8010/healthz -> 200
curl http://document-service:8010/readyz -> 200
```

Readiness checks:

```json
{
  "template": true,
  "mapping": true,
  "tempWritable": true,
  "storage": true,
  "pdfEngine": true
}
```

Application variables were configured through Twenty metadata API:

- `DOCUMENT_SERVICE_URL=http://document-service:8010`
- `DOCUMENT_SERVICE_SECRET=(secret, not recorded)`

## Backend Target Smoke

Created records:

- Company: `dc050b06-6a70-49e6-b986-1cc4c3c0ee6c`
- Opportunity: `df1f01aa-6a43-4542-a802-922cbb659cd6`
- CommercialProposal: `ee4befdb-c7ec-4902-8314-567bd9498f9a`
- Proposal number: `CP-20260717-115115-CDG1`
- Generation id: `e1ddf00dfcc687d36d450364e3248ea0`

Verified:

- status: `GENERATED`
- `generatedAt`: present
- `lastError`: empty
- Opportunity relation: `df1f01aa-6a43-4542-a802-922cbb659cd6`
- Company relation: `dc050b06-6a70-49e6-b986-1cc4c3c0ee6c`
- repeated request with the same generation key returned `generated=false`
- repeated request returned the same generation id

Generated files:

| Format | File | Size | SHA-256 |
|---|---|---:|---|
| XLSM | `CP-20260717-115115-CDG1-SMOKE-Phase4-2026-07-17T11-51-15.183Z-Company.xlsm` | 24193 | `18bf6ad6559fa88c688a4a4f7228a8fce225921e6392aefbaf8d2a6586cd2f79` |
| PDF | `CP-20260717-115115-CDG1-SMOKE-Phase4-2026-07-17T11-51-15.183Z-Company.pdf` | 91017 | `5775ea394b25933c29cde7573ebdd489ca46ca8702af018a64f4b56fb4ee960c` |

Download URL checks from the workstation:

- XLSM download: HTTP 200, SHA-256 matched, ZIP header present.
- PDF download: HTTP 200, SHA-256 matched, `%PDF-` header present.
- URLs used `http://192.168.100.11:9000` and contained an S3 signature.

Downloaded XLSM package checks:

- `xl/vbaProject.bin`: present
- `xl/drawings/drawing1.xml`: present
- `xl/drawings/vmlDrawing1.vml`: present
- `xl/printerSettings/printerSettings1.bin`: present
- `xl/ctrlProps/ctrlProp1.xml`: present
- `_xlnm.Print_Area`: present

## Not Yet Verified

- Manual UI click path from CommercialProposal record to `Сформировать документ`.
- Manual XLSM opening in Microsoft Excel without repair warning.
- Manual visual comparison of the generated PDF against the XLSM layout.
- Forced `FAILED -> retry -> GENERATED` target scenario.

Current blocker before `READY FOR PHASE 5`:

```text
target UI smoke / manual XLSM-PDF check
```

