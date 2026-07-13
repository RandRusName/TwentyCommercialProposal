# Permissions

The app defines one default application role.

Current role grants:

- broad read/update/soft-delete access inherited from the SDK starter pattern
  for logic functions;
- no destroy permission;
- explicit read/update permission for `commercialProposal`;
- no explicit destroy permission for `commercialProposal`.

The app logic needs to:

- read Opportunity context;
- read related Company context;
- read existing CommercialProposal by `idempotencyKey`;
- create CommercialProposal drafts;
- open the created record in Twenty UI.

Routes use `isAuthRequired: true`. The repository reads and writes through
`CoreApiClient`; SDK/Workspace permission behavior for restricted users still
needs target verification.

The Opportunity command menu item is scoped to `GLOBAL_OBJECT_CONTEXT` for the
standard Opportunity object and includes a single-record availability expression:

```text
numberOfSelectedRecords == 1
```

The current SDK metadata makes this a context guard, not a complete permission
check. Server-side route authentication and Twenty data permissions must still
be verified on the target Workspace with allowed and restricted users.

Integration setup now has a hard uninstall guard:

```text
App uninstall is forbidden outside an ephemeral test instance
```

`TWENTY_TEST_INSTANCE_MODE=target` does not sync app metadata and does not run
uninstall.

Required target checks before Phase 4:

- a user without Opportunity read access cannot create a proposal for that
  Opportunity;
- a user without CommercialProposal create access cannot create a draft;
- the Opportunity command menu item is hidden or fails safely for users without
  the required permissions;
- errors remain structured and do not expose SDK stack traces, tokens or raw
  payloads.

These checks were not executed for the Phase 3 vertical slice on 2026-07-13.
They remain blocking for `READY FOR PHASE 4`.
