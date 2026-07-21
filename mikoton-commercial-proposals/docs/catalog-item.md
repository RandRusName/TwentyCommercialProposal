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
| `defaultPrice` | NUMBER(2) | yes | `0` |
| `currencyCode` | TEXT | yes | `RUB` |
| `isActive` | BOOLEAN | yes | `true` |
| `sortOrder` | NUMBER(0) | yes | `100` |

`CommercialProposalItem.catalogItem` is nullable. Selecting a catalog item copies block, name, description, unit, price and currency into the proposal item. Later catalog edits or deactivation do not alter saved proposals, snapshots or generated files. Deleting used catalog records is not a supported workflow; deactivate them instead.

The native Twenty list is the catalog administration UI. Search uses authenticated `POST /s/commercial-proposals/catalog-items/search` with a maximum page size of 100.
