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
`CoreApiClient`; SDK/Workspace permission behavior for browser users still needs
target verification.

The Opportunity command menu item is scoped to `GLOBAL_OBJECT_CONTEXT` for the
standard Opportunity object and includes a single-record availability expression:

```text
numberOfSelectedRecords == 1
```

The current SDK metadata makes this a context guard, not a complete permission
check. Server-side route authentication and Twenty data permissions must still
be verified on the target Workspace with allowed and restricted browser users.

## Implemented

- `isAuthRequired: true` is enabled on both app routes.
- The command menu item is limited to a single Opportunity context.
- Backend repository errors are mapped to structured application errors instead
  of raw SDK/GraphQL messages.
- Integration cleanup has a hard uninstall guard outside ephemeral mode.

## Verified On Target

- The `mikoton-target` remote API key is valid for GraphQL and deployment.
- Direct app-route requests with that API key return HTTP `403` before logic
  function execution.
- This confirms API-key GraphQL access is not enough to exercise authenticated
  `/s/...` app routes.

## Not Verified

- Allowed browser user can create a CommercialProposal DRAFT from an
  Opportunity.
- Restricted browser user without Opportunity read access receives `403` or
  cannot access the action.
- Restricted browser user without CommercialProposal create access receives
  `403` or cannot create a record.
- Command visibility reflects permission restrictions beyond the single-record
  context guard.

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

These checks were not executed for the Phase 3 vertical slice on 2026-07-13
because the browser reached the Twenty login screen and no restricted user
session was available. They remain blocking for `READY FOR PHASE 4`.
