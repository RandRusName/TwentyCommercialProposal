# ADR-002: CRM Application Product Boundary

Status: Accepted

## Decision

The product is the Mikoton CRM Application, a ready-to-use application layer on
unchanged Twenty Core. Commercial Proposals is one module inside that product.

## Consequences

One private App remains the installation unit. Standard CRM entities stay owned
by Twenty; App-owned metadata and business modules extend them through official
contracts. Product display naming may evolve without changing package name or
universal identifiers.
