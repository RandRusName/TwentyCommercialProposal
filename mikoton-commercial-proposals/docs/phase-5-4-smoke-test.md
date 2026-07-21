# Prompt 5.4 Smoke Test

Date: 2026-07-20

## Local Evidence

- Metadata plan on `mikoton-target`: `29 add`, `11 change`, `0 destroy`.
- TypeScript unit tests: 110 passed across 6 files.
- Python document-service tests: 10 passed.
- Document-service Docker image: built successfully.
- Real local HTTP generation: 20 work items and 8 stages generated a two-page PDF with no blank pages and preserved all rows/stages.
- Microsoft Excel 16 opened the generated XLSX without a repair warning; formulas and fit-to-page settings were readable.
- WSL tarball build: passed; manifest paths validated.
- Pre-release tarball: `release-artifacts/mikoton-commercial-proposals-0.1.37.tgz`, SHA-256 `5f66e52e157ed1e69d95c8c1ffd556754dade353ac4c594bf23e960f2c5ff95e`.

## Target Evidence

Target deployment, catalog UI smoke, target 20-item/8-stage multi-page generation and restricted-user verification are pending at this point in the implementation run. They must not be marked passed until executed. No secrets or signed URLs are recorded here.
