# Application Settings

## Infrastructure Configuration

Environment/application variables hold secrets and deployment-specific values:
`DOCUMENT_SERVICE_URL`, `DOCUMENT_SERVICE_SECRET`, storage credentials,
`TWENTY_FILE_UPLOAD_API_KEY` and timeouts. They are server-side only.

## Business Configuration

The future `CRMApplicationSettings` singleton owns default currency, business
timezone, proposal prefix, validity days, contractor identity, language and
enabled modules. `CrmApplicationSettingsProvider` and compatibility defaults
exist in code; no metadata object is created in Phase 6.0.

Singleton rules:

- one record per Workspace;
- validated and updated through Administration use cases;
- secrets are forbidden;
- missing settings use versioned compatibility defaults;
- later bootstrap is idempotent;
- migration never silently changes historical snapshots.

Current hardcoded values remain compatibility behavior until a later,
separately planned metadata migration.
