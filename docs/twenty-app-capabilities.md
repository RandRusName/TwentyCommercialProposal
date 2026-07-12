# Twenty Apps SDK Capability Review

Target instance: `http://192.168.100.11:3000/`

Target Twenty version: `v2.20.0`, verified through `GET /client-config`.

SDK version to use: `twenty-sdk@2.20.0`, verified as npm `latest` on 2026-07-12.

Starter version to use: `create-twenty-app@2.20.0`, verified as npm `latest` on 2026-07-12.

## Verification Sources

- Live instance:
  - `GET /healthz`
  - `GET /client-config`
  - `POST /graphql`
  - `POST /metadata`
- npm:
  - `npm view twenty-sdk version dist-tags`
  - `npm view create-twenty-app version dist-tags`
  - downloaded `twenty-sdk-2.20.0.tgz`
  - downloaded `create-twenty-app-2.20.0.tgz`
- Local reference checkout:
  - `C:\IT_Projects\twenty`, branch `custom/russian-crm`, commit `bfc879d980`, local SDK `2.7.0`

## Starter Structure

`create-twenty-app@2.20.0` starter contains:

- `package.json`
- `yarn.lock`
- `.nvmrc`
- `tsconfig.json`
- `tsconfig.spec.json`
- `vitest.config.ts`
- `vitest.unit.config.ts`
- `AGENTS.md`
- `README.md`
- `SETUP.md`
- `public/logo.svg`
- `src/application-config.ts`
- `src/default-role.ts`
- `src/constants/universal-identifiers.ts`
- `src/front-components/`
- `src/navigation-menu-items/`
- `src/page-layouts/`
- `src/__tests__/`
- GitHub workflow templates

This confirms the official path is an SDK-managed app project, not edits inside Twenty core.

## Capability Matrix

| Capability | Status in SDK 2.20.0 | Evidence | Notes |
|---|---:|---|---|
| Custom objects | Supported | `defineObject`, `ObjectConfig` | Object manifest includes names, labels, icon, fields, searchability, label identifier. |
| Custom fields | Supported | `defineField`, `FieldType` | Includes text, rich text, date, select, relation, files, raw JSON, etc. |
| Relations | Supported | `FieldType.RELATION`, `RelationType` | Supports `MANY_TO_ONE` and `ONE_TO_MANY`; delete behavior via `OnDeleteAction`. |
| Front components | Supported | `defineFrontComponent` | React component exported through SDK build system. |
| Record actions | Not as separate API | No `defineRecordAction` export found | Use `defineCommandMenuItem` scoped to object context, or record page layout/widget. |
| Command menu items | Supported | `defineCommandMenuItem` | Supports `GLOBAL`, `GLOBAL_OBJECT_CONTEXT`, `RECORD_SELECTION`, `FALLBACK`. |
| Navigation items | Supported | `defineNavigationMenuItem` | Can point to view, link, target object, folder, or page layout. |
| Logic functions | Supported | `defineLogicFunction` | Supports cron, database event, HTTP route, tool, and workflow-action trigger settings. |
| Permissions | Supported | `defineApplicationRole`, `defineRole`, `definePermissionFlag` | Supports object permissions, field permissions, system permission flags, and row-level predicate types. |
| File storage | Partially supported | `FieldType.FILES`, Files widget, SDK CLI `file-api` | Field/widget support is clear. App-side upload/write flow must be tested with auth. |
| Page layouts | Supported | `definePageLayout`, `definePageLayoutTab`, standard page layout IDs | Record page customization is feasible through page layouts/widgets. |
| Views | Supported | `defineView`, `defineViewField` | Useful for proposal list views and app navigation. |
| Indexes | Supported | `defineIndex` | Useful for proposal number, source record, status, created date. |

## Company and Opportunity Entry Point

Feasible approaches:

1. `defineCommandMenuItem`
   - Recommended first implementation.
   - Set `availabilityType: 'GLOBAL_OBJECT_CONTEXT'`.
   - Scope by `availabilityObjectUniversalIdentifier` to `Company` and/or `Opportunity`.
   - Attach a front component through `frontComponentUniversalIdentifier`.
   - Use `conditionalAvailabilityExpression` to ensure exactly one record or valid page context when needed.

2. Record page front component/widget
   - Feasible if we customize the standard `companyRecordPage` or `opportunityRecordPage`.
   - Better for a persistent visible panel/button.
   - Slightly higher risk because record page layout interaction must be tested on the live workspace.

3. Core Twenty patch
   - Not recommended.
   - Breaks app isolation and upgrade path.

## SDK Limitations and Risks

- Public GraphQL introspection is disabled on the target instance.
- Authenticated schema/API checks still require workspace/admin credentials.
- No standalone `record action` definition was found in SDK `2.20.0`.
- File generation is not a native document rendering feature of Apps SDK; it should be delegated to an external service.
- Logic functions should be treated as orchestration code, not a heavy document rendering runtime.
- Local checkout SDK `2.7.0` is stale relative to the target `v2.20.0` instance.

## Compatibility Conclusion

The target Twenty instance `v2.20.0` is compatible with the current `twenty-sdk@2.20.0` and `create-twenty-app@2.20.0`.

Proceed with an SDK app, not a Twenty core modification.
