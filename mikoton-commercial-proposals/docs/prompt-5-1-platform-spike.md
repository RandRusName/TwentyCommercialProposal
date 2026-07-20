# Prompt 5.1 Platform Spike

Date: 2026-07-20

Target versions:

```text
Twenty CRM: v2.20.0
twenty-sdk: 2.20.0
twenty-client-sdk: 2.20.0
```

Sources checked:

- Installed `twenty-sdk/dist/define/index.d.ts`
- Installed `twenty-sdk/dist/logic-function/index.d.ts`
- Installed `twenty-client-sdk/dist/core/index.d.ts`
- Existing app metadata/index/repository patterns

## Findings

| Capability | Finding | Implementation choice |
|---|---|---|
| Conditional update / CAS | No typed Core SDK primitive was found. `CoreApiClient` exposes generated `query`/`mutation` as `any`; existing object update pattern is `updateCommercialProposal(id, data)`, not conditional update. | Use best-effort optimistic concurrency. Do not claim strict CAS. |
| Update by `id AND editorRevision` | Not proven through installed SDK types. | Initial revision check + final canonical reload. |
| Affected rows / conflict count | Not exposed by `CoreApiClient` typings. | Conflict is observable only through explicit reads and SDK errors. |
| Multi-object transactions | No transaction primitive found in SDK typings. | Staged save with replay-safe child upsert. Do not claim atomic aggregate save. |
| Compound unique indexes | `defineIndex` supports multiple fields and `isUnique?: boolean`. Current app already uses unique single-field indexes. Runtime support must still be validated by metadata plan. | Prompt 5.1 keeps client-key indexes non-unique and uses application lookup/upsert. Compound unique can be revisited after target plan evidence. |
| Globally unique `clientKey` | TEXT fields can be indexed. A global unique `clientKey` would prevent accidental key reuse across proposals but is stricter than the desired `(proposal, clientKey)` logical key. | Use parent + clientKey lookup/upsert. Do not rely on global uniqueness. |
| Delete for app-owned children | Existing integration uses `deleteCommercialProposal`; Core generated mutation naming convention supports delete-style object mutations. | Use app-owned `deleteCommercialProposalItem` / `deleteCommercialProposalStage` through Core client; verify in integration/target. |
| Logic function path parameters | `LogicFunctionEvent` includes `pathParameters: Record<string, string | undefined>`. | Use `/commercial-proposals/:id/...` and `event.pathParameters.id`. |

## Concurrency Guarantee

The implemented guarantee is:

```text
best-effort optimistic concurrency
```

It uses:

1. initial `editorRevision` check;
2. replay-safe child upsert by parent + `clientKey`;
3. final proposal update with `editorRevision + 1`;
4. canonical aggregate reload;
5. structured conflict where stale revision is observable.

It is not:

- a database transaction;
- exactly-once execution;
- linearizable conflict prevention;
- guaranteed CAS.

## Replay Guarantee

The implemented guarantee is:

```text
replay-safe convergent save
```

Completed replay:

```text
operationId == lastEditorOperationId
-> return canonical aggregate without mutation
```

Partial-failure replay:

```text
same operationId + same child clientKeys
-> parent/clientKey lookup updates existing children
-> no duplicate child rows in normal retry path
```

Without a database-level compound unique constraint, simultaneous creates with the same `clientKey` remain application-level best effort.

## Follow-up Required on Target

Before declaring Prompt 5.1 production-ready:

- run metadata plan and verify additive metadata;
- verify query/mutation names for `commercialProposalItems` and `commercialProposalStages`;
- verify delete mutations;
- verify route path params through target smoke;
- document whether target metadata plan accepts any future compound unique index if attempted later.
