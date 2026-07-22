# Mikoton CRM Application Architecture

The product is one installable Twenty App implemented as a modular monolith.
Commercial Proposals is a business module, not the product boundary.

## Runtime Boundary

```text
Twenty Core
  -> CRM Application
       -> Foundation
       -> Sales
       -> Catalog
       -> Commercial Proposals
       -> Documents
       -> Administration
  -> external document-service / MinIO / LibreOffice
```

Twenty owns the CRM shell, standard records, permissions and API execution.
The App owns its custom metadata and business rules. External services provide
technical capabilities only.

## Phase 6.0 State

- Existing metadata identifiers and production behavior are unchanged.
- Module contracts, adapters and a registry exist under `src/modules`.
- Compatibility primitives begin under `src/platform`.
- CI runs `yarn test:architecture` before unit tests.
- Legacy folders remain during incremental migration; no big-bang move is
  permitted.

See the context map, module boundaries, dependency rules and migration plan in
this directory.
