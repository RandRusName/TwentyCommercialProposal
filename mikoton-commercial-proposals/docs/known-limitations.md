# Known Limitations

## Prompt 5.4

- Catalog search reads a bounded candidate set and applies deterministic filtering and sorting in the logic function. Results are capped at 100 records; a larger catalog will require cursor pagination or a server-side search primitive exposed by the SDK.
- Catalog values use snapshot semantics. Later catalog edits or deactivation do not alter existing proposal items.
- Twenty SDK 2.20 exposes no separate `canCreateObjectRecords` application-role flag. The narrowed role was verified through target catalog search, aggregate save, generation and attachment upload, but a separate restricted-user denial scenario was not executed.
- Template v2 supports at most 50 work items and 10 stages. Larger proposals are rejected and never truncated.
- Generation uses best-effort editor revision checking because Twenty v2.20.0 exposes no App-level multi-object transaction or compare-and-set primitive.
- LibreOffice PDF output requires a manual visual check after material template changes.
- Compose pins MinIO server and client release tags, but not image digests. An internal registry mirror and digest pinning remain supply-chain hardening work.
- Download URL refresh is represented in result metadata, but the front component has no dedicated refresh-without-regeneration action yet.
- JSON audit fields remain stored. Twenty v2.20.0 may still expose them in record field settings even when they are omitted from the default business view.
- The app-owned record page hides technical fields from the normal business card by omitting the generic `FIELDS` widget. SDK 2.20 has no declarative global `isHidden`, so administrators can still find these fields in Settings.
- Twenty Server 2.20 creates a new page layout before its tabs during app installation. An explicit default tab cannot reference a tab from the same new manifest, so Home is the first active tab by position and acts as the effective default.
- Generated Excel files are ordinary `.xlsx` files without VBA or macros. This is intentional after the macro-enabled workbook proved unreliable.
- Forced target `FAILED -> retry -> GENERATED` recovery was not executed in this run; failure/retry behavior is covered by automated tests.
- The aggregate editor uses explicit save. The SDK does not expose a supported navigation blocker, so unsaved changes are indicated but closing cannot be intercepted reliably.
- Editor conflicts reload the canonical aggregate on explicit user action; automatic merge is not implemented.
- Child `clientKey` replay safety is application-level parent-and-key lookup. No database-level compound uniqueness guarantee is claimed.
- New drafts intentionally share `number = Черновик`. Twenty App metadata 2.20 cannot declare a partial unique index applying only to generated records, so final yearly number allocation is server-side best-effort under truly concurrent generation.
- No DOCX generation, email sending, approval workflow or Phase 5 functionality is implemented.
