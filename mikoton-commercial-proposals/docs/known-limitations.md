# Known Limitations

- GitHub CI was not observed green in this session because changes were not
  pushed and no workflow URL was available.
- Ephemeral integration test code was added, but it was not executed locally
  because no ephemeral Twenty credentials were available outside CI.
- Private publish/install was not executed on the target Workspace during this
  session.
- Remote UI smoke was not executed; navigation, command menu, front component
  and real draft creation still require target Workspace verification.
- Parallel idempotency is designed around a unique `idempotencyKey` index in
  `twenty-sdk@2.20.0` plus read-after-conflict recovery. It still requires a
  real metadata plan/apply to confirm the target Workspace accepts the unique
  index without destructive changes.
- `amount` remains `NUMBER + currency` to avoid a potentially destructive
  field type migration to `FieldType.CURRENCY`.
- Permission behavior for restricted users was not verified on the target
  Workspace. The logic function uses authenticated routes and Core API access,
  but a limited-user smoke test is still required.
- Twenty SDK `2.20.0` generated tarballs include `.mjs.map` source maps; no CLI
  help option to disable them was found.
- Private upgrade flow and metadata duplication check were not executed.
- Backup point was not created in this session.
- No Company command entry point is implemented.
- No DOCX/PDF generation is implemented.
- No document-service integration is implemented.
- Files storage is modeled but not used yet.
- No email/send workflow is implemented.
