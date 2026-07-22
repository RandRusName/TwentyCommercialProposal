import { useEffect, useMemo, useRef, useState } from 'react';
import { useColorScheme, useTranslate } from 'twenty-sdk/front-component';

import type { CatalogItemOption } from 'src/front-components/commercial-proposal-editor/editor-types';
import { getEditorStyles } from 'src/front-components/commercial-proposal-editor/editor-styles';
import { callAppRoute } from 'src/front-components/utils/call-app-route';

type SearchResponse = {
  status: 'success';
  items: CatalogItemOption[];
  categories: string[];
  pageInfo: {
    endCursor: string | null;
    hasNextPage: boolean;
    resultCompleteness: 'COMPLETE' | 'PARTIAL';
  };
};

const CATALOG_TYPES = ['SERVICE', 'PRODUCT', 'LICENSE', 'PACKAGE', 'OTHER'] as const;

export const CatalogPicker = ({
  currencyCode,
  onAdd,
  onClose,
}: {
  currencyCode: string | null;
  onAdd: (items: CatalogItemOption[]) => void;
  onClose: () => void;
}) => {
  const scheme = useColorScheme();
  const { t } = useTranslate();
  const styles = getEditorStyles(scheme);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [itemType, setItemType] = useState('');
  const [items, setItems] = useState<CatalogItemOption[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selected, setSelected] = useState<Map<string, CatalogItemOption>>(new Map());
  const [endCursor, setEndCursor] = useState<string | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const requestSequence = useRef(0);

  useEffect(() => {
    const sequence = ++requestSequence.current;
    const timeout = setTimeout(() => {
      setLoading(true);
      setError(null);
      void callAppRoute<SearchResponse>('/catalog-items/search', {
        text: query,
        category: category || undefined,
        types: itemType === '' ? undefined : [itemType],
        currencyCode: currencyCode || undefined,
        activeOnly: true,
        limit: 100,
      })
        .then((response) => {
          if (sequence !== requestSequence.current) return;
          setItems(response.items);
          setCategories(response.categories);
          setEndCursor(response.pageInfo.endCursor);
          setHasNextPage(response.pageInfo.hasNextPage);
          setSelected((current) => {
            const next = new Map(current);
            for (const item of response.items) {
              if (!item.isSelectable) next.delete(item.id);
              else if (next.has(item.id)) next.set(item.id, item);
            }
            return next;
          });
        })
        .catch(() => {
          if (sequence === requestSequence.current) setError(t('Unable to load the catalog. Try again.'));
        })
        .finally(() => {
          if (sequence === requestSequence.current) setLoading(false);
        });
    }, 300);
    return () => {
      clearTimeout(timeout);
      requestSequence.current += 1;
    };
  }, [query, category, itemType, currencyCode, reload, t]);

  const selectedItems = useMemo(
    () => [...selected.values()],
    [selected],
  );
  const selectedCurrencies = new Set(
    selectedItems.map((item) => item.currencyCode),
  );
  const canAdd = selectedItems.length > 0 && selectedCurrencies.size === 1;

  return (
    <div
      style={{
        ...styles.section,
        border: `1px solid ${scheme === 'dark' ? '#374151' : '#d1d5db'}`,
        borderRadius: '6px',
        padding: '12px',
      }}
    >
      <div style={styles.header}>
        <div>
          <h3 style={styles.sectionTitle}>{t('Add from catalog')}</h3>
          <div style={styles.muted}>
            {t(
              'Values are copied into the proposal and can then be edited independently from the catalog.',
            )}
          </div>
        </div>
        <button type="button" style={styles.button} onClick={onClose}>
          {t('Close')}
        </button>
      </div>
      <div style={{ ...styles.grid, marginTop: '10px' }}>
        <input
          aria-label={t('Search catalog')}
          placeholder={t('Search')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          style={styles.input}
        />
        <select
          aria-label={t('Catalog category')}
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          style={styles.input}
        >
          <option value="">{t('All categories')}</option>
          {categories.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <select
          aria-label={t('Catalog item type')}
          value={itemType}
          onChange={(event) => setItemType(event.target.value)}
          style={styles.input}
        >
          <option value="">{t('All types')}</option>
          {CATALOG_TYPES.map((value) => (
            <option key={value} value={value}>{t(value)}</option>
          ))}
        </select>
      </div>
      {loading && (
        <div style={{ ...styles.muted, marginTop: '10px' }}>
          {t('Loading catalog...')}
        </div>
      )}
      {error !== null && (
        <div style={{ ...styles.error, marginTop: '10px' }}>
          {error}{' '}
          <button
            type="button"
            style={styles.button}
            onClick={() => setReload((value) => value + 1)}
          >
            {t('Retry')}
          </button>
        </div>
      )}
      {!loading && error === null && (
        <div style={{ marginTop: '10px', maxHeight: '300px', overflowY: 'auto' }}>
          {items.length === 0 && (
            <div style={styles.muted}>{t('No matching catalog items found.')}</div>
          )}
          {items.map((item) => (
            <label
              key={item.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '24px 1fr auto',
                gap: '8px',
                alignItems: 'center',
                padding: '8px 0',
              }}
            >
              <input
                type="checkbox"
                checked={selected.has(item.id)}
                disabled={!item.isSelectable}
                onChange={() =>
                  setSelected((current) => {
                    const next = new Map(current);
                    if (next.has(item.id)) next.delete(item.id);
                    else next.set(item.id, item);
                    return next;
                  })
                }
              />
              <span>
                <strong>{item.name}</strong>
                <span style={{ ...styles.muted, display: 'block' }}>
                  {t(item.itemType)} · {item.category ?? t('Uncategorized')} · {item.defaultBlock} ·{' '}
                  {item.defaultUnit}
                  {item.validationMessage === null
                    ? ''
                    : ` · ${item.validationMessage}`}
                </span>
              </span>
              <span>
                {item.defaultPrice} {item.currencyCode}
              </span>
            </label>
          ))}
        </div>
      )}
      {selectedItems.length > 0 && (
        <div style={{ ...styles.muted, marginTop: '10px' }}>
          {t('Selected: {count}', { count: selectedItems.length })}
          {selectedItems.map((item) => (
            <button
              key={item.id}
              type="button"
              style={{ ...styles.button, marginLeft: '6px' }}
              onClick={() => setSelected((current) => {
                const next = new Map(current);
                next.delete(item.id);
                return next;
              })}
            >
              {item.name} ×
            </button>
          ))}
        </div>
      )}
      {hasNextPage && (
        <button
          type="button"
          style={{ ...styles.button, marginTop: '10px' }}
          disabled={loading || endCursor === null}
          onClick={() => {
            if (endCursor === null) return;
            const sequence = ++requestSequence.current;
            setLoading(true);
            void callAppRoute<SearchResponse>('/catalog-items/search', {
              text: query,
              category: category || undefined,
              types: itemType === '' ? undefined : [itemType],
              currencyCode: currencyCode || undefined,
              activeOnly: true,
              limit: 100,
              cursor: endCursor,
            }).then((response) => {
              if (sequence !== requestSequence.current) return;
              setItems((current) => {
                const byId = new Map(current.map((item) => [item.id, item]));
                response.items.forEach((item) => byId.set(item.id, item));
                return [...byId.values()];
              });
              setCategories((current) => [...new Set([...current, ...response.categories])].sort());
              setEndCursor(response.pageInfo.endCursor);
              setHasNextPage(response.pageInfo.hasNextPage);
            }).catch(() => {
              if (sequence === requestSequence.current) setError(t('Unable to load the catalog. Try again.'));
            }).finally(() => {
              if (sequence === requestSequence.current) setLoading(false);
            });
          }}
        >
          {t('Load more')}
        </button>
      )}
      {selectedCurrencies.size > 1 && (
        <div style={{ ...styles.error, marginTop: '10px' }}>
          {t('Select items in one currency.')}
        </div>
      )}
      <div
        style={{ ...styles.actions, marginTop: '10px', justifyContent: 'flex-end' }}
      >
        <button
          type="button"
          style={{ ...styles.primary, opacity: canAdd ? 1 : 0.55 }}
          disabled={!canAdd}
          onClick={() => onAdd(selectedItems)}
        >
          {t('Add selected ({count})', { count: selectedItems.length })}
        </button>
      </div>
    </div>
  );
};
