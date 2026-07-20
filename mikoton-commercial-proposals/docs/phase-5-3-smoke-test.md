# Phase 5.3 smoke test

Date: 2026-07-20

| Check | Result | Evidence |
|---|---|---|
| TypeScript lint/typecheck | Passed | WSL build, 0 errors |
| TypeScript unit tests | Passed | 89 tests |
| Python tests | Passed | 7 tests |
| Docker build/readiness | Passed | v1/v2 templates, storage and LibreOffice ready |
| Real LibreOffice generation | Passed | XLSX 9,436 bytes; PDF 86,444 bytes |
| Service idempotency | Passed | same key/hash reused generation and storage keys |
| WSL App build | Passed | tarball SHA-256 `adf9826b1efed7f087930cb35f27b24989303fbf493511226c15c67d11c2537d` |
| Metadata plan | Passed | 0 add, 9 in-place updates, 0 destroy |
| Target document-service | Passed | `/readyz` from `twenty-server-1`, all checks true |
| Target App/UI generation | Pending | Requires private publish/install after release commit |

No API keys, service secrets or active signed URLs are recorded here.
