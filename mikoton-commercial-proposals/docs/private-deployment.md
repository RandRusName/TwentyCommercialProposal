# Private Deployment

The target Twenty server is available only on the internal network:

```text
http://192.168.100.11:3000
```

GitHub Actions must not access this server, and the target API key must not be
stored in GitHub Secrets for this project. CI validates code, integration tests
against an ephemeral Twenty instance, and tarball build only.

## Local Environment

Create a local `.env` file or set the variable in the current PowerShell
session:

```powershell
$env:TWENTY_API_KEY = "<target-api-key>"
```

The deployment script reads the API key only from `TWENTY_API_KEY` and does not
accept it as a command-line argument.

## Deployment Command

Run from `mikoton-commercial-proposals/`:

```powershell
.\scripts\deploy-private.ps1 `
  -TwentyUrl "http://192.168.100.11:3000" `
  -RemoteName "mikoton-target"
```

The script:

- checks Node, Yarn, Git and tar;
- checks `/healthz`;
- checks `/client-config` and requires Twenty `v2.20.0`;
- requires a clean Git working tree;
- runs install, lint, typecheck and unit tests;
- builds a private `.tgz` tarball;
- computes SHA-256;
- writes a local release manifest under `release-artifacts/`;
- configures a local Twenty remote;
- runs `yarn twenty app:publish --private -r mikoton-target .`;
- runs `yarn twenty app:install -r mikoton-target .`;
- never runs uninstall.

## Manual Verification

After deployment, open:

```text
Settings -> Applications
```

Verify:

- the app is private;
- name is `mikoton-commercial-proposals`;
- version matches `package.json`;
- the app is installed in the expected Workspace;
- public Marketplace was not used.

## Commands Used By The Script

```powershell
yarn.cmd twenty remote:add --as mikoton-target --url http://192.168.100.11:3000 --api-key $env:TWENTY_API_KEY
yarn.cmd twenty app:publish --private -r mikoton-target .
yarn.cmd twenty app:install -r mikoton-target .
```

The API key is redacted in script output.
