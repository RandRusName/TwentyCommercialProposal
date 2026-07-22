# Rollback Runbook

## Preconditions

Record the installed App version, previous tarball SHA-256, document-service
image digest, template/mapping hashes and backup identifiers. For App `0.1.49`
those values are **Pending** until recorded — do not invent them. Rollback is
not an uninstall and must not delete App metadata or business records.

An isolated rollback rehearsal for Phase 5.5 is **NOT DONE** until operator
evidence is written in `phase-5-5-production-acceptance.md`.

## App

1. Stop new generation operations.
2. Verify the previous private artifact is compatible with additive metadata.
3. Use the supported private publish/install flow to restore the previous App
   version when Twenty permits it. Do not run `app:uninstall`.
4. Verify existing proposals, files and app-owned navigation.

Additive fields, indexes and objects can remain. Never remove them solely to
match an older binary.

`CommercialProposalGenerationClaim` is additive (including `operationId`,
`ownerToken`, lease fields). Rolling back the App binary without destroying
metadata leaves the claim object/index in place (forward-compatible). Older
binaries that do not read or write claims simply ignore the object; do not drop
claim metadata as part of a normal rollback. Pre-`0.1.49` binaries lack
`ownerToken` fencing semantics — treat mixed-version generation as unsafe.

## Document Service

Restore the previously recorded image digest with the matching templates and
mappings. Worker storage credentials remain required for s3-compatible mode:
`DOCUMENT_STORAGE_ACCESS_KEY` and `DOCUMENT_STORAGE_SECRET_KEY` must be set
(no `MINIO_ACCESS_KEY` fallback). Preserve environment secrets, restart, and
require `/readyz` success before re-enabling generation.

## Data and Storage

User-created proposals are not rolled back automatically. Restore Twenty data
or MinIO only under an explicit incident decision and from a tested backup,
preserving audit history. Native catalog currency migration is additive; legacy
fields remain available and require no destructive rollback.

An isolated rollback rehearsal is mandatory before production acceptance and
must record the environment, artifact hashes and verification results.
