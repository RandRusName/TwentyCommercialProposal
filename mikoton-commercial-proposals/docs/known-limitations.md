# Known Limitations

This file describes accepted platform or product limitations. Unverified
production acceptance items are tracked separately in
`phase-5-5-production-acceptance.md` and are not reclassified as limitations.

Same-proposal generation concurrency is **not** a limitation: ownership is
atomic via the unique index on
`CommercialProposalGenerationClaim.proposalKey`, with a **10-minute** lease,
`ownerToken` fencing, and stale-lock recovery. Parallel same `operationId`
returns `IN_PROGRESS` (409), not a second owner. This is **not** SDK-level
linearizability or multi-object transactions.

- Twenty SDK 2.20 exposes no App-level transaction or compare-and-set primitive
  spanning the proposal, items and stages. Editor revision conflict detection
  is best-effort; child saves are replay-safe through parent plus `clientKey`.
  Generation ownership is separate and uses the unique claim index plus
  `ownerToken` fencing above.
- Catalog search uses an opaque **v2** cursor (`filterFingerprint`-bound)
  with client-side filtering because the Twenty 2.20 `catalogItems` query in
  this app does not expose the needed server-side filters/`orderBy`.
  Continuation has no gaps or duplicates within a search session; global
  `sortOrder` across the full catalog is best-effort relative to upstream page
  order. Search returns empty `categories`; use `POST /catalog-items/categories`
  for the full list (`PARTIAL` if the safety page limit is hit).
- The SDK exposes no supported navigation blocker for a front component. The
  editor shows dirty state and requires a clean save before generation, but it
  cannot intercept every host navigation or browser close.
- Technical fields are omitted from the app-owned business record page and are
  UI read-only where supported. Administrators can still inspect them in
  Twenty Settings because SDK 2.20 has no global `isHidden` metadata flag.
- App metadata labels are static in SDK 2.20. Front components support `en` and
  `ru-RU`, while navigation/object/view labels remain Russian on this target.
- Generated spreadsheets are macro-free `.xlsx` files. DOCX, email, approval,
  e-signature, public Marketplace publishing and automatic repricing are out of
  scope.
- Template v2 supports at most 50 work items and 10 stages. Validation rejects
  larger aggregates without truncation.
- PDF production depends on LibreOffice and requires a manual visual regression
  after template, font or LibreOffice image changes.
- A dedicated refresh-without-regeneration route for expired document-service
  signed URLs is not implemented. Existing Twenty attachment URLs remain usable
  and take precedence over expired document-service URLs.
- Catalog values are snapshots. Later catalog edits, repricing or deactivation
  never mutate historical proposal items.
- No automatic merge is attempted after an editor conflict.
