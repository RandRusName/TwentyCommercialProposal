# Tarball Build

Production private tarballs for this Twenty App must be built inside WSL/Linux.
Building directly on Windows with:

```powershell
yarn.cmd twenty dev:build --tarball .
```

can produce `manifest.json` entries with Windows separators such as:

```text
src\logic-functions\create-commercial-proposal-draft.logic-function.mjs
```

The tarball itself contains POSIX paths, so Linux Twenty servers fail with:

```text
File not found in package:
src\logic-functions\create-commercial-proposal-draft.logic-function.mjs
```

## One-Button Build

From the project root on Windows:

```cmd
build.bat
```

Full dependency reset:

```cmd
build.bat --clean
```

Optional patch bump before a local build only:

```cmd
build.bat --bump
```

For build plus private publish and install/upgrade, use:

```cmd
deploy.bat
```

See `docs/private-deployment.md`.

`build.bat`:

1. resolves the project directory from the `.bat` location (`%~dp0`);
2. converts the Windows path to a WSL path with `wslpath`;
3. checks that WSL, Node.js, and Corepack are available inside WSL;
4. runs `scripts/build-wsl.sh` inside WSL;
5. keeps the console window open with `pause`.

`build.bat` does not deploy, publish, install, or call remote Twenty APIs.

## WSL Build Script

`scripts/build-wsl.sh` performs the Linux-side workflow:

```text
clean generated artifacts
→ optional node_modules cleanup with --clean
→ corepack yarn install --immutable
→ corepack yarn lint
→ corepack yarn typecheck
→ corepack yarn test:unit
→ corepack yarn twenty dev:build --tarball .
→ tarball inspection
→ manifest validation
→ copy to release-artifacts/
```

Generated artifacts removed before each build:

```text
.twenty/output
release-artifacts
```

`node_modules` is removed only when `build.bat --clean` is used.

## Requirements

- Windows 10/11
- WSL2
- Linux distribution inside WSL
- Node.js `>= 24.5.0` inside WSL
- Corepack inside WSL
- `tar`
- `sha256sum`

If Node.js is missing or below `24.5.0` inside WSL, install Node.js 24 with nvm.
The build script does not install Node automatically.

If `node_modules` was installed previously from Windows (`yarn.cmd install`),
run `build.bat --clean` once so dependencies are rebuilt for Linux inside WSL.
Otherwise native packages such as `sharp` will fail to load in WSL.

The WSL script automatically sources `~/.nvm/nvm.sh` when nvm is installed.

## Output

On success, the build prints:

```text
BUILD SUCCESSFUL

Tarball:
<Windows path>

WSL path:
<WSL path>

Size:
<size in bytes>

SHA-256:
<hash>
```

The release copy is written to:

```text
release-artifacts/mikoton-commercial-proposals-<version>.tgz
```

Example:

```text
release-artifacts/mikoton-commercial-proposals-0.1.0.tgz
```

The raw SDK output also remains under:

```text
.twenty/output/
```

## Required Checks

The WSL build verifies that the tarball:

- exists;
- has `.tgz` extension;
- is larger than zero bytes;
- contains `manifest.json`;
- contains `front-components`;
- contains `logic-functions`;
- does not contain `.env` files;
- does not contain Windows path separators in manifest package paths (`built*Path`, `src/...`);
- contains every packaged file path referenced by `manifest.json`;
- contains `create-commercial-proposal-draft.logic-function.mjs` when the
  corresponding TypeScript source exists.

Manual inspection commands inside WSL:

```bash
find .twenty/output -type f -name '*.tgz'
tar -tzf release-artifacts/mikoton-commercial-proposals-0.1.0.tgz
sha256sum release-artifacts/mikoton-commercial-proposals-0.1.0.tgz
```

Windows inspection:

```powershell
Get-ChildItem release-artifacts -Filter *.tgz
tar -tzf release-artifacts\mikoton-commercial-proposals-0.1.0.tgz
Get-FileHash release-artifacts\mikoton-commercial-proposals-0.1.0.tgz -Algorithm SHA256
```

## Source Maps

Twenty SDK `2.20.0` includes `.mjs.map` files in the generated tarball. No
documented `dev:build --tarball` option to disable source maps was found in the
CLI help. This is recorded as an operational limitation rather than silently
claimed as passed.

## Storage Rules

Tarballs are generated artifacts and must not be committed. The ignored local
locations are:

```text
.twenty/
release-artifacts/
```

Production tarballs are built locally inside the internal network. The public
GitHub repository should not publish production tarballs as Releases or Actions
artifacts by default.
