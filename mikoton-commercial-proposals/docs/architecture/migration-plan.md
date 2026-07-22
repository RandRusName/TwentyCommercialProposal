# Incremental Migration Plan

| Step | Current source | Target | Dependency change | Risk / rollback |
|---|---|---|---|---|
| 1 | cross-cutting helpers | `src/platform` | business modules depend on Foundation | Low; revert import-only commit |
| 2 | `services/catalog-item-repository.ts` and catalog routes | Catalog module | routes depend on Catalog query port | Medium; compatibility adapter retained |
| 3 | document client and contracts | Documents module | Proposal uses generation port | Medium; legacy service shim retained |
| 4 | Opportunity/Company reads | Sales module | Proposal routes use Sales ports | Low; Twenty repository remains adapter |
| 5 | proposal domain/use cases/routes | Commercial Proposals layers | presentation becomes thin | High; split into small commits |
| 6 | giant Twenty repository | module repositories + low-level client | remove cross-context knowledge | High; contract tests first |
| 7 | hardcoded business defaults | Administration settings provider | compatibility defaults -> persisted singleton | High; backward-compatible migration |

Every step requires a separate commit, green CI, unchanged metadata plan and a
target smoke when runtime wiring changes. No destructive migration or automatic
uninstall is a rollback mechanism.
