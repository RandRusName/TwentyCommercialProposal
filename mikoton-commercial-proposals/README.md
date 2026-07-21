# Mikoton Commercial Proposals

The aggregate editor supports manual rows and reusable `CatalogItem` defaults through `Добавить из каталога`. Catalog selection copies values into an independent `CommercialProposalItem` snapshot; later catalog changes never rewrite an existing proposal.

Persisted `AGGREGATE_V2` proposals can be generated with schema `2.0` into macro-free XLSX and LibreOffice PDF files. Template v2 supports 50 work items and 10 stages; legacy records retain schema/template v1.

Twenty App for creating a `CommercialProposal` draft from a selected
Opportunity in Twenty CRM.

Target Twenty instance: `http://192.168.100.11:3000`.

Target server and SDK versions:

- Twenty Server: `v2.20.0`
- `twenty-sdk@2.20.0`
- `twenty-client-sdk@2.20.0`

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
- structured application errors;
- draft metadata fields for source, template, language and payload snapshot.
- functional vertical slice from Opportunity command menu to a
  `CommercialProposal` DRAFT success state.
- document generation:
  - legacy XLSM template v1 and macro-free XLSX template v2;
  - declarative versioned mappings;
  - external document-service with persistent idempotency manifests;
  - command/front component/route for generation;
  - XLSX/PDF attachment to the CommercialProposal `Files` tab.

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
  --url http://192.168.100.11:3000 \
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
NAT setups Windows can open `http://192.168.100.11:3000`, while WSL cannot.

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
- app-owned central CommercialProposal record page with Home editor plus native Timeline, Tasks, Notes and Files tabs;
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

Target UI smoke and restricted-user checks require access to the target Twenty
Workspace. The app must not be considered ready for Phase 4 until those checks
are run and documented in `docs/smoke-test-report.md`.

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
& "C:\Users\user\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" `
  -m unittest discover -s .\document-service\tests -v
```

Generation route:

```http
POST /s/commercial-proposals/generate
```

The route requires server-side app variables:

- `DOCUMENT_SERVICE_URL`
- `DOCUMENT_SERVICE_SECRET`

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
`mikoton-target`, and installs or upgrades the app on `http://192.168.100.11:3000`.

See `docs/private-deployment.md`, `docs/tarball-build.md`, `docs/upgrade.md`
and `docs/rollback.md`.
