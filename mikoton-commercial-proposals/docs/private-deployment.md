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
2. automatic patch version bump;
3. WSL build via `scripts/build-wsl.sh`;
4. tarball validation;
5. private publish to `mikoton-target`;
6. install or upgrade on Twenty;
7. local release manifest under `release-artifacts/`.

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

Create a local `.env` file or export the variable in WSL:

```bash
export TWENTY_API_KEY="<target-api-key>"
```

The deploy script reads the API key only from the WSL environment or local
`.env`. It is not passed as a command-line argument and is not stored in
`.bat` files.

If remote `mikoton-target` is already configured in the Twenty CLI, the deploy
script uses that configuration and does not require `TWENTY_API_KEY` again.

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
option to publish a prebuilt `.tgz` path directly.

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
