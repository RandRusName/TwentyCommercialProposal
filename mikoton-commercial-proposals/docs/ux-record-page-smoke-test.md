# Commercial Proposal Record Page UX Validation

## Build Under Test

- Target: `http://192.168.100.11:3000`
- Twenty: `v2.20.0`
- App version: `0.1.47`
- Release source commit: `ef76a6a`
- Date: `2026-07-21`
- Tarball: `release-artifacts/mikoton-commercial-proposals-0.1.47.tgz`
- Tarball size: `2,479,524` bytes
- Tarball SHA-256: `8da667147b3b23136e625d8b56a372596389d8989d7c8e6be5b2010ea3d5b42a`

## Automated Validation

| Check | Result | Evidence |
|---|---|---|
| Lint | Passed | WSL production build, 0 warnings and 0 errors |
| Typecheck | Passed | WSL `corepack yarn typecheck` |
| Unit tests | Passed | 8 files, 120 tests |
| Target integration smoke | Passed | 1 file, 8 tests; target mode did not sync or uninstall the App |
| Tarball validation | Passed | 12 manifest paths checked; forward slashes only; compiled logic function present |
| Private publish | Passed | `mikoton-commercial-proposals v0.1.47` published to `mikoton-target` |
| Install/upgrade | Passed | CLI returned `Application installed` |
| Repeated metadata plan | Passed | `No changes. Twenty metadata matches your manifest.` |

## Target Browser Smoke

The installed App was reloaded in the authenticated target UI. Proposal
`c42fe098-1e1f-4d1e-a0cb-a2bda4ca7bff` and the catalog list were inspected.

| Check | Result | Evidence |
|---|---|---|
| Full-width proposal card | Passed | The App-owned record page has one Home tab and no pinned right-side native panel |
| Technical fields hidden | Passed | The business card contains no generic `FIELDS` widget and does not show JSON, idempotency or revision fields |
| Collapsible documents | Passed | `Документы` starts collapsed with a count of 2; `Показать файлы` reveals exactly one XLSX and one PDF; `Скрыть файлы` collapses the section |
| Existing generated record | Passed | `КП-014 от 21.07.2026`, status `GENERATED`, total `50,000 RUB`, one item and one complete stage |
| Native catalog currency | Passed | Default catalog view now uses the `price` CURRENCY field (`Цена`), not legacy NUMBER/TEXT columns |
| Price migration | Passed | Official GraphQL API backfilled and verified 10 existing catalog records; repeated dry-run found 0 candidates |
| App metadata language | Passed for target locale | Both App navigation entries and App-owned object/view names are consistently Russian |
| Front-component locale | Passed | Editor content is Russian under the target `ru-RU` execution context; `en` and `ru-RU` catalogs have matching keys |

Generated XLSX/PDF remain attached to the CommercialProposal in Twenty. Active
signed URLs and credentials are intentionally omitted from this report.

## Catalog Semantics

- `Тип позиции` is the commercial nature: service, product, license, package or other.
- `Категория каталога` is taxonomy for catalog search and filtering; it is not copied to the proposal document.
- `Блок работ в КП` is copied to the proposal item and appears as the work section in XLSX/PDF.

## Platform Limitation

Twenty SDK 2.20 injects locale catalogs into front-component bundles and exposes
the current Twenty locale through `useLocale`/`useTranslate`. It does not expose
runtime-localized App metadata labels for navigation, objects and views. Those
static labels are therefore Russian on this Russian target; the editor itself
continues to inherit `en` or `ru-RU` from Twenty.

A separate restricted-user denial smoke was not repeated for this UX-only
release.
