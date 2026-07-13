# Private Deployment

The target Twenty server is available only on the internal network:

```text
http://192.168.100.11:3000
```

GitHub Actions must not access this server, and the target API key must not be
stored in GitHub Secrets for this project. CI validates code, integration tests
against an ephemeral Twenty instance, and tarball build only.

## One-Click Deploy

From `mikoton-commercial-proposals/` on Windows:

```cmd
deploy.bat
```

This is the preferred private release flow. It performs:

1. clean Git working tree check;
2. Twenty health, version, remote auth and logic-function runtime preflight;
3. automatic patch version bump;
4. WSL build via `scripts/build-wsl.sh`;
5. tarball validation;
6. private publish to `mikoton-target`;
7. install or upgrade on Twenty;
8. local release manifest under `release-artifacts/`.

Additional modes:

```cmd
deploy.bat --clean
deploy.bat --no-install
deploy.bat --no-bump
```

`deploy.bat` does not run `git commit`, `git push`, or `git tag`.

If deploy fails after the version bump, `package.json` is restored to the
previous version automatically.

## Local Environment

Configure the Twenty CLI remote once from inside WSL. Do not put the key in
`deploy.bat` and do not pass it to `deploy.bat`.

```bash
corepack yarn twenty remote:add \
  --as mikoton-target \
  --url http://192.168.100.11:3000 \
  --api-key "<target-api-key>"
```

Then verify:

```bash
corepack yarn twenty remote:status
```

Expected target:

```text
Remote:  mikoton-target
Server:  http://192.168.100.11:3000
Auth:    api-key (valid)
```

The deploy script uses the configured remote. If `mikoton-target` is missing or
auth is invalid, deployment stops with a clear error. It does not start OAuth
fallback automatically.

## Required Twenty Server Runtime

This app uses authenticated Twenty App logic-function routes:

```text
/s/commercial-proposals/opportunity-context
/s/commercial-proposals/drafts
```

On Twenty `v2.20.0`, logic-function execution is disabled by default outside
development unless the server environment enables a driver. Upstream
`ConfigVariables` defaults `LOGIC_FUNCTION_TYPE` to `DISABLED`, and the disabled
driver throws:

```text
Logic function execution is disabled. Set LOGIC_FUNCTION_TYPE to LOCAL or LAMBDA to enable.
```

For the internal self-hosted target, enable local execution in the Twenty server
environment and restart the server:

```env
LOGIC_FUNCTION_TYPE=LOCAL
```

Use `LOGIC_FUNCTION_TYPE=LAMBDA` only if the full AWS Lambda function runtime is
configured for Twenty. Do not set `isAuthRequired: false`, do not put API keys
in the front component, and do not bypass the route through direct privileged UI
calls.

`deploy.bat` runs a safe runtime preflight before bumping the package version.
It calls the installed context route with a nonexistent Opportunity id. A
healthy runtime returns the app's structured `OPPORTUNITY_NOT_FOUND` response.
If Twenty returns platform `403 FORBIDDEN_EXCEPTION` with `Logic function
execution failed`, deployment stops before version bump or private publish.

## WSL Networking

Private deploy reaches `http://192.168.100.11:3000` from inside WSL. On some
WSL2 NAT setups Windows can reach the internal host, while WSL cannot.

Symptom:

```text
ERROR: WSL cannot reach http://192.168.100.11:3000
Windows can reach http://192.168.100.11:3000, but WSL cannot.
```

Fix once with mirrored networking:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup-wsl-mirrored-network.ps1 -Apply
```

This writes `%USERPROFILE%\.wslconfig`, restarts WSL, and re-checks access.
After that, run `deploy.bat` again.

## Build Only

Use `build.bat` when you need a validated tarball without contacting Twenty:

```cmd
build.bat
build.bat --clean
build.bat --bump
```

`build.bat` does not require a clean Git tree and does not publish by default.

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

## Confirmed CLI Commands (SDK 2.20.0)

```bash
corepack yarn twenty remote:status
corepack yarn twenty app:publish --private -r mikoton-target .
corepack yarn twenty app:install -r mikoton-target .
```

`app:publish` builds from the app directory inside WSL. There is no documented
option in SDK `2.20.0` to publish a prebuilt `.tgz` path directly, so the script
re-validates the tarball produced by publish.

## Legacy PowerShell Script

`scripts/deploy-private.ps1` remains available for manual use, but it builds on
Windows and can produce Windows path separators in `manifest.json`. Prefer
`deploy.bat` for production releases.

## What Deploy Does Not Do

- no Git push;
- no npm publish;
- no public Marketplace publish;
- no uninstall;
- no OAuth fallback when remote auth is invalid.
