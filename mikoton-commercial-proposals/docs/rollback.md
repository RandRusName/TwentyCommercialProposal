# Rollback

Uninstall is not the standard rollback path for this app. Uninstall can remove
or detach app-owned metadata and is forbidden by the test guard outside
ephemeral CI instances.

## Preferred Rollback

1. Stop new deployment attempts.
2. Preserve logs and the failed tarball checksum.
3. Restore Twenty PostgreSQL backup if metadata or data integrity is affected.
4. Restore file/object storage backup if generated assets or storage data are
   affected.
5. If Twenty supports installing an older private app version safely, install
   the previous known-good version.
6. Run backend smoke and UI smoke.

## Confirmed In This Session

- The code prevents app uninstall in non-ephemeral test setup.
- The deployment script never calls uninstall.

## Not Confirmed

- Downgrade from one private app version to an older version was not tested.
- Restore from backup was not executed.
- Twenty private registry version rollback semantics were not verified.
