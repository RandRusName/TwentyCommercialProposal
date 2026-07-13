# Mikoton Commercial Proposals

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
- server-side draft numbering in `CP-YYYYMMDD-HHmmss-XXXX` format;
- required `idempotencyKey` with unique metadata index and conflict recovery;
- structured application errors;
- draft metadata fields for source, template, language and payload snapshot.

Not implemented in this phase:

- DOCX/PDF generation;
- document-service call;
- generated file upload/storage flow;
- Company entry point;
- record-page widget;
- proposal items;
- CPQ features.

## Local Checks

Use `yarn.cmd` on Windows PowerShell if script execution blocks `yarn.ps1`.

```powershell
yarn.cmd install --immutable
yarn.cmd lint
yarn.cmd typecheck
yarn.cmd test:unit
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

See `docs/tarball-build.md` for tarball validation details and output location.

`test:integration` requires an ephemeral Twenty instance:

```powershell
$env:TWENTY_TEST_INSTANCE_MODE = "ephemeral"
$env:TWENTY_API_URL = "<ephemeral-url>"
$env:TWENTY_API_KEY = "<ephemeral-api-key>"
yarn.cmd test:integration
```

Remote metadata `plan/apply` and UI smoke require an API key for the target
Twenty instance. The app must not be considered ready for Phase 3 until those
checks are run and documented in `docs/dry-run-report.md` and
`docs/smoke-test-report.md`.

## Private Deployment

The target Twenty server is on a private network. GitHub Actions must not deploy
to it and must not receive its API key.

Local private deployment flow:

```powershell
cd C:\IT_Projects\TwentyCommercialProposals\mikoton-commercial-proposals
$env:TWENTY_API_KEY = "<target-api-key>"
.\scripts\deploy-private.ps1 `
  -TwentyUrl "http://192.168.100.11:3000" `
  -RemoteName "mikoton-target"
```

See `docs/private-deployment.md`, `docs/tarball-build.md`, `docs/upgrade.md`
and `docs/rollback.md`.
