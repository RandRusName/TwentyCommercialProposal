# ADR-007: Module Dependency Rules

Status: Accepted

## Decision

Foundation has no business dependencies. Commercial Proposals may depend on
Foundation, Sales, Catalog and Documents. Sales, Catalog and Documents cannot
depend on Commercial Proposals, and module cycles are forbidden.

## Consequences

`yarn test:architecture` scans imports and critical adapter wiring in CI.
Legacy folders are transitional and explicitly excluded only where required;
the gate becomes stricter as each migration step lands.
