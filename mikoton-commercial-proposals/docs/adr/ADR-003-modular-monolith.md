# ADR-003: Modular Monolith

Status: Accepted

## Decision

Use one Twenty App with Foundation, Sales, Catalog, Commercial Proposals,
Documents and Administration modules. External processes are limited to heavy
technical capabilities.

## Consequences

Module boundaries are enforced in CI. No runtime plugin framework, event bus or
microservice split is introduced. Migration is incremental and keeps current
metadata and production flows stable.
