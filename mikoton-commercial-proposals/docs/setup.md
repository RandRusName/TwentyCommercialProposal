# Setup

## Prerequisites

- Node.js compatible with `.nvmrc` and `package.json`.
- Yarn 4.
- Network access to `http://192.168.100.11:3000`.
- API key from the target Twenty workspace.

The target instance was checked on 2026-07-12:

- `GET http://192.168.100.11:3000/healthz` returned `200`.
- `GET http://192.168.100.11:3000/client-config` returned `appVersion: v2.20.0`.
- `isWorkspaceSchemaDDLLocked: false`.

## Install

```powershell
yarn.cmd install
```

Dependencies are pinned to Twenty `2.20.0` in `package.json`.

## Authenticate Remote

The target server does not expose a CLI OAuth client id, so the CLI requires an
API key:

```powershell
yarn.cmd twenty remote:add --as mikoton-remote --url http://192.168.100.11:3000 --api-key "<TWENTY_API_KEY>"
yarn.cmd twenty remote:use mikoton-remote
```

Do not commit API keys or `.env` files.

## Safe Metadata Preview

Run a plan before any apply:

```powershell
yarn.cmd twenty plan -r mikoton-remote .
```

If the plan contains destructive changes, stop and review it before applying.

## Apply

Only after a clean plan:

```powershell
yarn.cmd twenty apply -r mikoton-remote .
```

For local development with automatic sync:

```powershell
yarn.cmd twenty dev -r mikoton-remote .
```
