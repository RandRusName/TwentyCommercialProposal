# ADR-006: Application Settings

Status: Accepted

## Decision

Separate infrastructure secrets from Workspace business settings. Introduce a
settings provider contract and compatibility defaults now; defer persisted
singleton metadata to a dedicated backward-compatible migration.

## Consequences

No new metadata is created in Phase 6.0. Historical snapshots keep their
contractor/date/currency values. Future settings bootstrap must be idempotent
and contain no secrets.
