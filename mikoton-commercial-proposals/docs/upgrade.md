# Upgrade

The app is delivered as a private Twenty App tarball and published to the
internal Twenty registry.

## One-Click Upgrade

Preferred flow on Windows:

```cmd
deploy.bat
```

Each successful deploy:

- bumps the patch version in `package.json`;
- builds and validates a Linux tarball in WSL;
- private publishes to `mikoton-target`;
- installs or upgrades the app on the internal Twenty server;
- writes `release-artifacts/release-<version>.json`.

Republish the same version only when intentional:

```cmd
deploy.bat --no-bump
```

Build and publish without install:

```cmd
deploy.bat --no-install
```

## Versioning

Use SemVer in `package.json`.

`deploy.bat` performs the normal patch bump automatically:

```text
0.1.0 -> 0.1.1
0.1.1 -> 0.1.2
0.1.9 -> 0.1.10
```

The bump is transactional:

- if build, validation, publish, or install fails, `package.json` is restored;
- if deploy succeeds, the new version remains for manual Git commit later.

`build.bat --bump` is available for local build-only version bumps without
private publish.

## Backup First

Before first install and every upgrade:

- create a PostgreSQL backup for Twenty;
- create a file/object storage backup for Twenty;
- record Twenty version;
- record app version;
- verify that restore procedure is known.

Do not treat uninstall as rollback.

## Manual Upgrade Flow

```cmd
git pull
git checkout <approved-commit-or-tag>
deploy.bat
```

Or build only:

```cmd
build.bat --clean
```

## Post-Upgrade Checks

Verify:

- installed version changed;
- `CommercialProposal` object is not duplicated;
- navigation item is not duplicated;
- command menu item is not duplicated;
- relation fields are not duplicated;
- existing CommercialProposal records are still present;
- Opportunity and Company relations still resolve;
- backend target smoke passes.

If Twenty exposes a plan/dry-run for private app upgrade, run it before install.
This was not verified in the current session.

## Failed Deploy Rollback

`deploy.bat` restores the previous `package.json` version when any step fails
after the bump.

It does not roll back:

- a version already published to the internal Twenty registry;
- metadata already applied on the server.

Use `docs/rollback.md` for server-side recovery if needed.
