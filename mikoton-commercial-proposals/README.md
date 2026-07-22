# Mikoton Commercial Proposals

This repository now treats the deliverable as a single modular **Mikoton CRM
Application** for Twenty. Commercial Proposals remains the first production
business module; the package name and universal identifiers stay unchanged for
upgrade compatibility. See `docs/architecture/README.md`.

The aggregate editor supports manual rows and reusable `CatalogItem` defaults through `Добавить из каталога`. Catalog selection copies values into an independent `CommercialProposalItem` snapshot; later catalog changes never rewrite an existing proposal.

Persisted `AGGREGATE_V2` proposals can be generated with schema `2.0` into macro-free XLSX and LibreOffice PDF files. Template v2 supports 50 work items and 10 stages; legacy records retain schema/template v1.

Twenty App for creating a `CommercialProposal` draft from a selected
Opportunity in Twenty CRM.

Target Twenty instance: `$TWENTY_API_URL` (for example
`https://your-twenty-instance.example`).

App version: `0.1.53`.

Target server and SDK versions:

- Twenty Server: `v2.20.0`
- `twenty-sdk@2.20.0`
- `twenty-client-sdk@2.20.0`

## Production Closure Status

Phase 5.5 **CORRECTIVE** hardening is implemented and deployed as App `0.1.53`
(`operationId` vs `ownerToken` fencing, 10-minute lease renewal, ownership-lost
behavior, catalog cursor v2 / categories route, currency and `itemType`
hardening). Target install, backup/restore, metadata plan, API smoke and UI E2E
are recorded in `docs/phase-5-5-production-acceptance.md`. Restricted-user,
controlled runtime recovery/rollback and final-commit CI evidence remain open,
so the evidence-based verdict is **NOT READY FOR PRODUCTION USE**. Deployment
remains private and runs only from a machine on the internal network.

## Scope

Implemented in this phase:

- custom `commercialProposal` object;
- relations to standard `opportunity` and `company`;
- navigation item for Commercial Proposals;
- Opportunity command menu item;
- front component for single-opportunity draft creation;
- authenticated logic functions for context loading and draft creation;
- business-safe draft label `Черновик` and final generation numbering in
  `КП-### от DD.MM.YYYY` format;
- required `idempotencyKey` with unique metadata index and conflict recovery;
- database-backed yearly final-number reservation through nullable unique
  `finalNumberKey` (`YYYY:NNN`), with bounded conflict retry;
- generation claim via unique `CommercialProposalGenerationClaim.proposalKey`
  (`operationId` logical op vs `ownerToken` physical fence; 10-minute lease
  renewal; stale takeover; ownership lost → no FAILED / no claim delete / no
  attachments; parallel same `operationId` → `IN_PROGRESS`/409);
- structured application errors;
- draft metadata fields for source, template, language and payload snapshot.
- functional vertical slice from Opportunity command menu to a
  `CommercialProposal` DRAFT success state.
- document generation:
  - legacy XLSM template v1 and macro-free XLSX template v2;
  - declarative versioned mappings;
  - external document-service with persistent idempotency manifests;
  - command/front component/route for generation;
  - XLSX/PDF attachment to the CommercialProposal and a collapsible document
    section on its business card.
- native Twenty `CURRENCY` price field for catalog items, with a safe API
  backfill utility for existing legacy prices;
- backend `normalizeCurrencyCode` (trim+upper, `[A-Z]{3}`);
- catalog cursor v2 (`filterFingerprint`, `skip` 0..100); search empty
  `categories` + `pageCategories`; `POST /catalog-items/categories` (PARTIAL
  on safety limit); `itemType` allowlist on assignment;
- fail-closed document-service authentication and bounded request bodies;
- fail-closed `DOCUMENT_STORAGE_ACCESS_KEY` / `DOCUMENT_STORAGE_SECRET_KEY`
  (no silent `MINIO_ACCESS_KEY` fallback);
- `en`/`ru-RU` front-component localization inherited from the Twenty execution
  locale. App metadata labels are Russian on the current target because SDK
  2.20 does not localize navigation/object/view metadata at runtime.

Not implemented in this phase:

- DOCX generation;
- public Marketplace distribution;
- Company entry point;
- CPQ features.

## Local Checks

Use `yarn.cmd` on Windows PowerShell if script execution blocks `yarn.ps1`.

```powershell
yarn.cmd install --immutable
yarn.cmd lint
yarn.cmd typecheck
yarn.cmd test:unit
yarn.cmd test:document-service
yarn.cmd test:integration
yarn.cmd test:secrets
yarn.cmd test:private-urls
yarn.cmd twenty dev:build .
yarn.cmd twenty dev:build --tarball .
```

For a production-ready private tarball, use the one-button WSL build instead of
running `yarn.cmd twenty dev:build --tarball .` directly on Windows. Windows
builds can write Windows path separators into `manifest.json`, which breaks
installation on Linux Twenty servers.

```cmd
build.bat
```

Full dependency reset before build:

```cmd
build.bat --clean
```

Optional patch bump before a local build only:

```cmd
build.bat --bump
```

`build.bat` does not publish to Twenty and does not require a clean Git tree.

## One-Click Private Deploy

For a full private release to the internal Twenty server:

```cmd
deploy.bat
```

This will:

1. require a clean Git working tree;
2. bump the patch version in `package.json`;
3. run the full WSL build and tarball validation;
4. private publish to `mikoton-target`;
5. install or upgrade the app on Twenty;
6. write a local release manifest under `release-artifacts/`.

Additional deploy modes:

```cmd
deploy.bat --clean
deploy.bat --no-install
deploy.bat --no-bump
```

`deploy.bat` performs private publish and install/upgrade only inside WSL.
It does not run `git commit`, `git push`, or `git tag`.

Before the first deploy, configure `mikoton-target` once inside WSL:

```bash
corepack yarn twenty remote:add \
  --as mikoton-target \
  --url "$TWENTY_API_URL" \
  --api-key "<target-api-key>"
corepack yarn twenty remote:status
```

`deploy.bat` uses this configured remote. It does not accept API keys as
arguments and does not run OAuth fallback automatically.

Requirements for `build.bat`:

- Windows 10/11
- WSL2 with a Linux distribution
- Node.js `>= 24.5.0` inside WSL
- Corepack enabled inside WSL
- `tar` and `sha256sum` inside WSL

If Node.js is missing or too old inside WSL, install Node.js 24 with nvm and
run `build.bat` again.

If dependencies were previously installed from Windows with `yarn.cmd install`,
run `build.bat --clean` once before the first WSL production build.

### WSL networking for private deploy

`deploy.bat` must reach the internal Twenty host from inside WSL. On some WSL2
NAT setups Windows can open `$TWENTY_API_URL`, while WSL cannot.

If deploy fails with a WSL network error, enable mirrored networking once:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup-wsl-mirrored-network.ps1 -Apply
```

Then run `deploy.bat` again.

See `docs/private-deployment.md` for tarball validation details and output location.

## Commercial Proposal Editor

The aggregate editor flow includes:

- `CommercialProposalItem` and `CommercialProposalStage` app-owned metadata;
- model-versioned `CommercialProposal` fields, including `contentModelVersion`;
- authenticated aggregate routes:
  - `POST /s/commercial-proposals/:id/editor-context`;
  - `POST /s/commercial-proposals/:id/save-editor`;
  - `POST /s/commercial-proposals/:id/recalculate`;
- deterministic fixed-scale money calculation;
- replay-safe save with `operationId` and child `clientKey`;
- ownership validation for child ids;
- duplicate `clientKey`/id and persisted-integrity validation;
- canonical total calculation from re-read persisted children;
- best-effort final revision re-check;
- strict generation dispatch: `AGGREGATE_V2` uses schema `2.0` and template `2`;
- app-owned full-width CommercialProposal record page with a single editor tab;
- `Открыть карточку КП` command for a single CommercialProposal;
- explicit-save editor for header, work items, stages and terms;
- local preview plus authoritative server recalculation;
- dirty/reset, conflict and read-only states.

New drafts start as an empty `AGGREGATE_V2` aggregate with `amount = 0` and
`number = "Черновик"`. Opportunity amount is shown only as `Прогноз сделки`.
Existing `LEGACY_V1` drafts keep their historical amount until the user saves
at least one valid item; that conversion is explicit and irreversible.

The app-owned record page deliberately has no generic `FIELDS` widget. Technical
JSON, idempotency and revision fields therefore stay out of the standard
business card while remaining available to administrators in Settings.

Generated XLSX/PDF files are still attached to the CommercialProposal record,
but the business card shows them in a collapsed `Documents` section by default.
Twenty SDK 2.20 has no supported API for collapsing the host's native pinned
Timeline/Tasks/Notes/Files area, so the app uses a single full-width tab instead.

The App ships `en` and `ru-RU` locale catalogs. Navigation metadata and the
central editor use the locale inherited from the current Twenty user. The work
catalog uses a native `CURRENCY` field, matching Twenty's amount/currency editor;
legacy numeric price and text currency fields remain read-only compatibility
data for records created before this migration.

Schema `2.0` generation is enabled for persisted `AGGREGATE_V2` records. Template
v2 supports 50 work items and 10 stages and produces macro-free XLSX plus PDF.
The editor also includes an inline `CatalogItem` picker. Catalog selection copies
values into proposal-owned item snapshots; later catalog changes do not mutate
saved proposals.

`test:integration` requires an ephemeral Twenty instance:

```powershell
$env:TWENTY_TEST_INSTANCE_MODE = "ephemeral"
$env:TWENTY_API_URL = "<ephemeral-url>"
$env:TWENTY_API_KEY = "<ephemeral-api-key>"
yarn.cmd test:integration
```

Target API and administrator UI smoke passed on App `0.1.53`. Restricted-user
and controlled failure/rollback evidence is still open; see
`docs/phase-5-5-production-acceptance.md`.

## Opportunity to Draft Flow

The command menu item is available in a single Opportunity context and opens the
front component `Создать коммерческое предложение`.

The component loads Opportunity context through the authenticated app route:

```http
POST /s/commercial-proposals/opportunity-context
```

The route returns only the safe DTO needed by the UI: Opportunity id/name,
optional Company id/name, normalized amount, and source `currencyCode`.

Draft creation uses:

```json
{
  "source": {
    "object": "opportunity",
    "recordId": "opportunity-uuid"
  },
  "templateCode": "standard-commercial-proposal",
  "language": "ru-RU",
  "idempotencyKey": "uuid"
}
```

The idempotency key is generated once per UI operation and reused on retry. A
successful response shows the created draft number, title, status, and an
`Открыть коммерческое предложение` action. Direct navigation uses Twenty side
panel record navigation and does not hardcode a workspace slug.

Created DRAFT records keep:

- `generatedAt = null`;
- `resultMetadata = null`;
- `lastError = null`;
- `sourceType = OPPORTUNITY`;
- `templateCode = standard-commercial-proposal`;
- `language = ru-RU`;
- `amount = Opportunity.amountMicros / 1_000_000` when Opportunity uses Twenty
  currency micros;
- `currencyCode` from the Opportunity source value, without defaulting to RUB.

## Document Generation

Phase 4 uses an external document-service. The source template is still the
versioned user-provided XLSM file, but generated Excel output is a normal
macro-free XLSX file. The Twenty App does not run VBA inside logic functions.

Local assets:

```text
templates/mikoton-commercial-proposal-v1.xlsm
templates/mikoton-commercial-proposal-v1.mapping.json
document-service/
```

Local document-service test:

```powershell
$env:PYTHONPATH = (Resolve-Path .\document-service).Path
python -m unittest discover -s .\document-service\tests -v
```

Generation route:

```http
POST /s/commercial-proposals/generate
```

The route requires server-side app variables:

- `DOCUMENT_SERVICE_URL`
- `DOCUMENT_SERVICE_SECRET`

Same-proposal concurrent generation is serialized by a unique generation claim
with `ownerToken` fencing. A second live attempt (including parallel same
`operationId`) returns `COMMERCIAL_PROPOSAL_GENERATION_IN_PROGRESS` (HTTP 409).
See `docs/document-generation.md`, `docs/template-mapping-v1.md` and
`docs/document-service-runbook.md`.

## Private Deployment

The target Twenty server is on a private network. GitHub Actions must not deploy
to it and must not receive its API key.

Preferred one-click private deployment:

```cmd
cd C:\IT_Projects\TwentyCommercialProposals\mikoton-commercial-proposals
deploy.bat
```

`deploy.bat` bumps the patch version, runs the WSL build, private publishes to
`mikoton-target`, and installs or upgrades the app on `$TWENTY_API_URL`.

See `docs/private-deployment.md`, `docs/tarball-build.md`, `docs/upgrade.md`
and `docs/rollback.md`.
