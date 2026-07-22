# ADR-004: Twenty Core Remains Unchanged

Status: Accepted

## Decision

Use official Twenty `v2.20.0` images, SDK, Core API and metadata mechanisms.
Never fork, patch or directly mutate the Twenty database for App behavior.

## Consequences

Platform limitations are recorded honestly. Deployment configuration may
enable supported runtime features, but App portability and official upgrade
paths take precedence over local core customization.
