# Catalog Picker

## Production Behavior

The picker supports type filtering, opaque cursor-backed search, stable
selections across pages/search terms, and stale-response rejection. The backend
remains authoritative for active state, native price, currency and proposal
ownership.

Currency codes are normalized with `normalizeCurrencyCode`: `null`, `''`,
whitespace-only and equivalent empty values become unset (`null`); `'rub'`
becomes `'RUB'`. The first catalog selection may initialize an empty proposal
currency. Once a proposal has a currency or rows, only matching catalog items
are selectable.

The proposal editor keeps manual row creation and adds `Добавить из каталога`.

The inline picker provides debounced search (300 ms), category and proposal-currency filtering, loading/error/retry states and multi-select. Selected entries become ordinary unsaved editor rows; **no autosave** occurs on add.

## Opaque cursor

Search returns an opaque base64url cursor (`v: 1`, upstream `after`, in-page
`skip`). Twenty 2.20 `catalogItems` in this app does not expose the needed
server-side filters/`orderBy`, so filtering is applied client-side over
upstream pages. Continuation within a session has no gaps or duplicates;
global `sortOrder` across the full catalog is best-effort relative to upstream
page order. Malformed cursors are rejected as `INVALID_INPUT`.

Each generated row gets a fresh UUID `clientKey`, no Twenty record id, and a nullable `catalogItemId`. The editor shows `Каталог` or `Вручную` as the source. The backend validates newly assigned catalog relations and remains authoritative.
