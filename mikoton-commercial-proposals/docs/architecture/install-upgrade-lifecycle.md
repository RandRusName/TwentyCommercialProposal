# Install And Upgrade Lifecycle

## Pre-install

1. Verify Twenty version against `>=2.20.0 <2.21.0`.
2. Verify clean source and immutable dependencies.
3. Create database, Twenty file storage, MinIO and runtime-config backups.
4. Build and validate a Linux tarball and secret scan it.
5. Run metadata plan; stop on foreign or destructive changes.
6. Verify required server-side variables without printing values.

## Install / Upgrade

Private publish and install occur locally inside the internal network. Never
uninstall on target. Metadata identifiers remain stable.

## Post-install

Verify installed version, module registry, health/readiness, empty repeated
plan, authenticated routes and target smoke. Document-service downtime must not
prevent App installation; it blocks only generation readiness.

## Migration And Recovery

Data migrations are dry-run-first, API-based, idempotent and separately
approved. Rollback prefers forward fixes or a supported previous App/image;
database/storage restore uses the recorded checkpoint. Destructive automatic
migration is forbidden.
