import { useEffect, useMemo, useState } from 'react';
import { useColorScheme, useTranslate } from 'twenty-sdk/front-component';

import type { CatalogItemOption } from 'src/front-components/commercial-proposal-editor/editor-types';
import { getEditorStyles } from 'src/front-components/commercial-proposal-editor/editor-styles';
import { callAppRoute } from 'src/front-components/utils/call-app-route';

type SearchResponse = {
  status: 'success';
  items: CatalogItemOption[];
  categories: string[];
};

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
  const [items, setItems] = useState<CatalogItemOption[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setLoading(true);
      setError(null);
      void callAppRoute<SearchResponse>('/catalog-items/search', {
        text: query,
        category: category || undefined,
        currencyCode: currencyCode || undefined,
        activeOnly: true,
        limit: 100,
      })
        .then((response) => {
          setItems(response.items);
          setCategories(response.categories);
        })
        .catch(() => setError(t('Unable to load the catalog. Try again.')))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timeout);
  }, [query, category, currencyCode, reload, t]);

  const selectedItems = useMemo(
    () => items.filter((item) => selected.has(item.id)),
    [items, selected],
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
                    const next = new Set(current);
                    if (next.has(item.id)) next.delete(item.id);
                    else next.add(item.id);
                    return next;
                  })
                }
              />
              <span>
                <strong>{item.name}</strong>
                <span style={{ ...styles.muted, display: 'block' }}>
                  {item.category ?? t('Uncategorized')} · {item.defaultBlock} ·{' '}
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
