# Dependency Rules

Allowed module dependencies:

```text
foundation <- sales
foundation <- catalog
foundation <- documents
foundation <- administration
foundation + sales + catalog + documents <- commercial-proposals
```

Forbidden:

- Foundation importing a business module.
- Sales, Catalog or Documents importing Commercial Proposals.
- Cycles between modules.
- Module domain code importing React, Twenty SDK, HTTP or `process.env`.
- Presentation code importing document-service internals directly.

`scripts/test-architecture.mjs` scans imports, detects module cycles and asserts
that current generation, catalog and Opportunity routes use their module
adapters. The gate intentionally permits documented legacy-folder adapters
during migration. Its scope tightens as files move into modules.
