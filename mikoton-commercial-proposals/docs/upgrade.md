# Upgrade

The app is delivered as a private Twenty App tarball and published to the
internal Twenty registry.

## Versioning

Use SemVer in `package.json`.

Before every private publication:

- bump `package.json` version intentionally;
- commit the version change;
- do not let the deployment script silently bump versions;
- do not republish the same version unless Twenty explicitly allows and the
  operation is intentional.

Example:

```text
0.1.0 -> 0.1.1
```

The deployment script verifies the package version is valid SemVer and writes
the Git commit SHA into the local release manifest.

## Backup First

Before first install and every upgrade:

- create a PostgreSQL backup for Twenty;
- create a file/object storage backup for Twenty;
- record Twenty version;
- record app version;
- verify that restore procedure is known.

Do not treat uninstall as rollback.

## Upgrade Flow

```powershell
git pull
git checkout <approved-commit-or-tag>
yarn.cmd install --immutable
yarn.cmd lint
yarn.cmd typecheck
yarn.cmd test:unit
yarn.cmd twenty dev:build --tarball .
yarn.cmd twenty app:publish --private -r mikoton-target .
yarn.cmd twenty app:install -r mikoton-target .
```

Or use:

```powershell
.\scripts\deploy-private.ps1 -TwentyUrl "http://192.168.100.11:3000" -RemoteName "mikoton-target"
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
