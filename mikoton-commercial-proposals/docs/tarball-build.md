# Tarball Build

Twenty SDK `2.20.0` supports private tarball build with:

```powershell
yarn.cmd twenty dev:build --tarball .
```

Observed local output on 2026-07-13:

```text
.twenty/output/mikoton-commercial-proposals-0.1.0.tgz
```

Observed SHA-256 after the latest local build:

```text
32ce56f46e8b7246b5bf0e994e789c312f80b65c8f440da1eb50b34371ad6059
```

## Required Checks

The tarball must:

- exist;
- have `.tgz` extension;
- be larger than zero bytes;
- contain `manifest.json`;
- contain front component bundle;
- contain logic function bundles;
- not contain `.env` files;
- not contain API keys or local credentials.

Local inspection commands:

```powershell
Get-ChildItem -Recurse .twenty\output -Filter *.tgz
tar -tzf .twenty\output\mikoton-commercial-proposals-0.1.0.tgz
Get-FileHash .twenty\output\mikoton-commercial-proposals-0.1.0.tgz -Algorithm SHA256
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
