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

Preferred one-click private deployment:

```cmd
cd C:\IT_Projects\TwentyCommercialProposals\mikoton-commercial-proposals
deploy.bat
```

`deploy.bat` bumps the patch version, runs the WSL build, private publishes to
`mikoton-target`, and installs or upgrades the app on `http://192.168.100.11:3000`.

Legacy PowerShell deployment script:

```powershell
cd C:\IT_Projects\TwentyCommercialProposals\mikoton-commercial-proposals
$env:TWENTY_API_KEY = "<target-api-key>"
.\scripts\deploy-private.ps1 `
  -TwentyUrl "http://192.168.100.11:3000" `
  -RemoteName "mikoton-target"
```

The legacy script builds on Windows and should be avoided for production
tarballs. Use `deploy.bat` for WSL-only build, publish, and install.

See `docs/private-deployment.md`, `docs/tarball-build.md`, `docs/upgrade.md`
and `docs/rollback.md`.
