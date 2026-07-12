# Permissions

The app defines one default application role.

Current role grants:

- read/update/soft-delete access at broad object level, inherited from the SDK
  starter pattern for logic functions;
- no destroy permission;
- explicit read/update permission for `commercialProposal`;
- no explicit destroy permission for `commercialProposal`.

The app logic needs to:

- read Opportunity context;
- read related Company context;
- read existing CommercialProposal by `idempotencyKey`;
- create CommercialProposal drafts;
- open the created record in Twenty UI.

Known limitation: the SDK role model available in `twenty-sdk@2.20.0` does not
show a narrower create-only object permission in the local type surface. Before
production, reduce broad read/update permissions if Twenty exposes narrower
role capabilities in the installed workspace.
