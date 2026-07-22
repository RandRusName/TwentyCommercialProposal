# Module Boundaries

## Foundation

Owns errors, identifiers, money/date/pagination conventions, logging,
localization and compatibility. It imports no business module.

## Sales

Adapts Twenty Company, Person and Opportunity. It does not duplicate those
objects and does not know proposal lifecycle.

## Catalog

Owns CatalogItem lifecycle, validation and query/selection contracts. Catalog
items provide defaults; saved proposal lines remain snapshots.

## Commercial Proposals

Owns proposal aggregate, items, stages, numbering, editor, readiness,
generation command and generated-file association. It may depend on Foundation,
Sales, Catalog and Documents.

## Documents

Owns format-neutral generation request/result contracts and technical adapters.
MinIO, LibreOffice, signed URLs and worker credentials cannot leak into proposal
domain code.

## Administration

Owns settings design, compatibility, installation state, migration state and
health diagnostics. No settings metadata object is introduced in Phase 6.0.

## Future Contexts

Analytics is read-oriented. Delivery begins after an accepted proposal. Neither
may turn CommercialProposal into a project, invoice, contract or task tracker.
