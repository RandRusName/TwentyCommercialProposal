# Rollback Runbook

## Preconditions

Record the installed App version, previous tarball SHA-256, document-service
image digest, template/mapping hashes and backup identifiers. Rollback is not an
uninstall and must not delete App metadata or business records.

## App

1. Stop new generation operations.
2. Verify the previous private artifact is compatible with additive metadata.
3. Use the supported private publish/install flow to restore the previous App
   version when Twenty permits it. Do not run `app:uninstall`.
4. Verify existing proposals, files and app-owned navigation.

Additive fields and indexes can remain. Never remove them solely to match an
older binary.

## Document Service

Restore the previously recorded image digest with the matching templates and
mappings, preserve environment secrets, restart, and require `/readyz` success
before re-enabling generation.

## Data and Storage

User-created proposals are not rolled back automatically. Restore Twenty data
or MinIO only under an explicit incident decision and from a tested backup,
preserving audit history. Native catalog currency migration is additive; legacy
fields remain available and require no destructive rollback.

An isolated rollback rehearsal is mandatory before production acceptance and
must record the environment, artifact hashes and verification results.
