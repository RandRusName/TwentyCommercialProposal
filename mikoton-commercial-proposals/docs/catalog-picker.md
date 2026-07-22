# Catalog Picker

## Production Behavior

The picker supports type filtering, cursor-backed search, stable selections
across pages/search terms, and stale-response rejection. The backend remains
authoritative for active state, native price, currency and proposal ownership.

The proposal editor keeps manual row creation and adds `Добавить из каталога`.

The inline picker provides debounced search (300 ms), category and proposal-currency filtering, loading/error/retry states and multi-select. Selected entries become ordinary unsaved editor rows; no autosave occurs. The first catalog selection may initialize an empty proposal currency. Once a proposal has a currency or rows, only matching catalog items are selectable.

Each generated row gets a fresh UUID `clientKey`, no Twenty record id, and a nullable `catalogItemId`. The editor shows `Каталог` or `Вручную` as the source. The backend validates newly assigned catalog relations and remains authoritative.
