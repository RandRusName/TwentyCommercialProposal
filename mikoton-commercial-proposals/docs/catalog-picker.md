# Catalog Picker

## Production Behavior

The picker supports type filtering, opaque cursor-backed search, stable
selections across pages/search terms, and stale-response rejection. The backend
remains authoritative for active state, native price, currency and proposal
ownership.

Currency codes use backend `normalizeCurrencyCode`: trim + upper; empty/null
become unset; non-empty values must match `[A-Z]{3}` (e.g. `'rub'` → `'RUB'`).
The first catalog selection may initialize an empty proposal currency. Once a
proposal has a currency or rows, only matching catalog items are selectable.

The proposal editor keeps manual row creation and adds `Добавить из каталога`.

The inline picker provides debounced search (300 ms), category and proposal-currency filtering, loading/error/retry states and multi-select. Selected entries become ordinary unsaved editor rows; **no autosave** occurs on add.

## Categories

- Full category list: authenticated `POST /catalog-items/categories`
  (`resultCompleteness`: `COMPLETE` or `PARTIAL` if the safety page limit is hit).
- Search does **not** return a complete category list: `categories` is always
  `[]`; use `pageCategories` for categories observed on the current search page.

## Opaque cursor (v2)

Search returns an opaque base64url cursor:

```text
{ v: 2, after, skip, filterFingerprint }
```

- `filterFingerprint` binds the cursor to the current text/types/category/
  currency/`activeOnly` filters; mismatch → `INVALID_INPUT`.
- `skip` must be an integer in `0..100` (upstream raw page size).
- `after` rejects over-long values and `{`-containing payloads.
- Version must be `2`; unknown keys / malformed JSON → `INVALID_INPUT`.

Twenty 2.20 `catalogItems` in this app does not expose the needed server-side
filters/`orderBy`, so filtering is applied over upstream pages. Continuation
within a session has no gaps or duplicates; global `sortOrder` across the full
catalog is best-effort relative to upstream page order.

Malformed `itemType` rows appear disabled (`isSelectable: false`) and are not
treated as selectable `SERVICE`.

Each generated row gets a fresh UUID `clientKey`, no Twenty record id, and a nullable `catalogItemId`. The editor shows `Каталог` or `Вручную` as the source. The backend validates newly assigned catalog relations and remains authoritative.
