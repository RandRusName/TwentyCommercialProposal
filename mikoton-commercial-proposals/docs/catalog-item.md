# CatalogItem

`CatalogItem` is a reusable source of initial values for proposal work items. It is not a pricing source of truth after selection.

| Field | Type | Required | Default |
|---|---|---:|---|
| `name` | TEXT | yes | empty |
| `itemType` | SELECT | yes | `SERVICE` |
| `category` | TEXT | no | `null` |
| `defaultBlock` | TEXT | yes | `Работы` |
| `description` | TEXT | no | `null` |
| `defaultUnit` | TEXT | yes | `час` |
| `price` | CURRENCY | no | `null` |
| `defaultPrice` | NUMBER(2) | legacy, read-only | `0` |
| `currencyCode` | TEXT | legacy, read-only | `RUB` |
| `isActive` | BOOLEAN | yes | `true` |
| `sortOrder` | NUMBER(0) | yes | `100` |

`CommercialProposalItem.catalogItem` is nullable. Selecting a catalog item copies block, name, description, unit, price and currency into the proposal item. Later catalog edits or deactivation do not alter saved proposals, snapshots or generated files. Deleting used catalog records is not a supported workflow; deactivate them instead.

The native Twenty list is the catalog administration UI. Search uses authenticated `POST /s/commercial-proposals/catalog-items/search` with a maximum page size of 100.

`itemType` describes the commercial nature of an entry: service, product,
license, package, or other. `category` is a catalog taxonomy used for search and
filtering and is not copied into the generated proposal. `defaultBlock` is the
work-section label copied into `CommercialProposalItem.block` and the printed
proposal.

New and migrated records use `price`, Twenty's native `CURRENCY` value
(`amountMicros` plus `currencyCode`). Repository reads prefer this field and
convert micros by dividing by `1_000_000`. The old `defaultPrice` and
`currencyCode` fields remain as a non-editable fallback so existing catalog
records keep working until they are backfilled through the official API.

Existing records can be migrated without direct database access:

```bash
node scripts/backfill-catalog-native-price.mjs
node scripts/backfill-catalog-native-price.mjs --apply
```

The first command is a dry run. The apply mode skips records that already have
a native price, updates only `CatalogItem.price`, and verifies every result.
