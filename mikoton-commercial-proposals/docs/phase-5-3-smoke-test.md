# Phase 5.3 smoke test

Date: 2026-07-20
Target: `http://192.168.100.11:3000` (`Twenty v2.20.0`)
Remote: `mikoton-target`
App version: `0.1.37`
Release source commit: `9c7bd6125353a05ff292d226a67a23be288255b4`
Document-service image: `mikoton-commercial-proposals/document-service:phase5-3`

| Check | Result | Evidence |
|---|---|---|
| Corrective 5.2 fixes | Passed | Plain-object validation, editor state fixes, field errors, fixed-scale preview, canonical reload and context warnings are covered by unit tests. |
| TypeScript lint/typecheck | Passed | WSL build and final typecheck, 0 errors. |
| TypeScript unit tests | Passed | 4 files, 89 tests. |
| Python tests | Passed | 8 tests, including 20 items / 8 stages without truncation. |
| Docker build/readiness | Passed | v1/v2 templates, storage, temp directory, fonts and LibreOffice ready. `/readyz` also passed from `twenty-server-1`. |
| Schema/template matrix | Passed | `LEGACY_V1 -> 1.0/1`; `AGGREGATE_V2 -> 2.0/2`; mismatches are rejected. |
| Snapshot v2 | Passed | Canonical aggregate snapshot stored with deterministic SHA-256. Target hash: `7eb57e97d5d147dd8644d7b3f1ccc45ea1dc3dcd98b536c521e6304a12396388`. |
| Template capacity | Passed | Golden XLSX test writes 20 items and 8 stages; mapping limit is 50 items and 10 stages. |
| Real LibreOffice generation | Passed | Local real export produced valid XLSX and PDF; target export produced one-page PDF. |
| Service idempotency | Passed | Same key/hash reuses generation manifest and storage keys without a second PDF export. Different hash is rejected. |
| Attachment checkpoint | Passed | Target result contains exactly XLSX and PDF with `twentyFileId`; replay returns the same file ids. |
| WSL App build | Passed | `release-artifacts/mikoton-commercial-proposals-0.1.37.tgz`, 1,447,138 bytes, SHA-256 `d404ff4a60481baa64de00fc01c28d894553a6eab8469706578d64d60d90457b`. |
| Private publish/install | Passed | Release manifest reports publish and install success; Settings -> Applications shows current/latest `0.1.37`. |
| Metadata plan before deploy | Passed | 0 add, 9 app-owned in-place updates, 0 destroy. |
| Repeated metadata plan | Passed | `No changes. Twenty metadata matches your manifest.` |
| Target aggregate API smoke | Passed | 8 tests; aggregate fixture has 8 items, 4 stages, fractional quantities, discounts and a long description. |
| Pre-generation validation | Passed | Incomplete stage returned HTTP 400 / `COMMERCIAL_PROPOSAL_GENERATION_VALIDATION_FAILED`; status stayed `DRAFT`, revision stayed 4 and `generatedAt` stayed null. |
| Target v2 generation | Passed | `DRAFT -> GENERATED`, schema `2.0`, template `2`, amount `810.50 RUB`, XLSX/PDF attachments. |
| Target idempotency | Passed | Same generation key returned `generated=false`, the same `generationId`, snapshot hash and Twenty file ids; no duplicate attachments. |
| Legacy target regression | Passed | Separate `LEGACY_V1` record generated with template `1` and two attachments. |
| Target UI smoke | Passed | Command opened the component, displayed `AGGREGATE_V2`, item/stage counts and total; success state displayed and repeat button was disabled. |
| Files tab | Passed | Proposal `cff8f4a1-20ea-45b8-9315-c7fb8d214b64` shows exactly two files: XLSX and PDF. |
| Target XLSX | Passed with limitation | `КП-012 от 20.07.2026`; 8,945 bytes; SHA-256 `b139807de183dfdd1b877972a6739b29a65e915aaadb294cf5c45f30044888d0`. ZIP and workbook parsed without corruption; cells, formulas and print area were verified. Microsoft Excel was not available for a separate repair-warning check. |
| Target PDF | Passed | 76,490 bytes; SHA-256 `da095d6f2adb488528b1c9ca47b1db9a04b88d4b52bf311fd59d073d85e2c76d`; `%PDF-`, one page, rendered and visually inspected with no clipping or blank pages. |
| CatalogItem | Not implemented | Intentionally deferred to Prompt 5.4. |

Target UI proposal retained for review:

- proposal id: `cff8f4a1-20ea-45b8-9315-c7fb8d214b64`;
- number: `КП-012 от 20.07.2026`;
- generation id: `c0c587fdc090d8f8d4ede321d33c1990`;
- status: `GENERATED`;
- model/schema/template: `AGGREGATE_V2` / `2.0` / `2`;
- generated at: `2026-07-20T15:19:37.000Z`;
- amount: `28,900 RUB`.

The persistent UI record uses two items and one stage for concise visual review.
The automated target fixture separately verifies the required 8-item/4-stage
flow and is cleaned up after the test. No App uninstall or metadata sync is
performed by target smoke tests.

No API keys, service secrets, internal storage paths or active signed URLs are
recorded here.
