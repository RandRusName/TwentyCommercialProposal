import { describe, expect, it, vi } from 'vitest';

import * as universalIdentifiers from 'src/constants/universal-identifiers';
import { createEditorItemFromCatalogItem } from 'src/front-components/commercial-proposal-editor/editor-helpers';
import catalogItemObject from 'src/objects/catalog-item.object';
import commercialProposalItemObject from 'src/objects/commercial-proposal-item.object';
import catalogItemsView from 'src/views/catalog-items.view';
import {
  CatalogItemRepository,
  normalizeCatalogSearchRequest,
  type CatalogItemDto,
} from 'src/services/catalog-item-repository';

const catalogItem = (
  overrides: Partial<CatalogItemDto> = {},
): Omit<CatalogItemDto, 'isSelectable' | 'validationMessage'> => ({
  id: '123e4567-e89b-42d3-a456-426614174120',
  name: 'Анализ требований',
  itemType: 'SERVICE',
  category: 'Аналитика',
  defaultBlock: 'Предпроектные работы',
  description: 'Интервью и фиксация требований',
  defaultUnit: 'час',
  defaultPrice: 5000,
  currencyCode: 'RUB',
  isActive: true,
  sortOrder: 20,
  ...overrides,
});

describe('catalog item metadata', () => {
  it('uses unique universal identifiers and exact object defaults', () => {
    const metadata = (catalogItemObject as unknown as { config: {
      nameSingular: string;
      namePlural: string;
      isSearchable: boolean;
      isUICreatable: boolean;
      isUIEditable: boolean;
      fields: Array<Record<string, unknown>>;
    } }).config;
    const identifiers = Object.entries(universalIdentifiers)
      .filter(([name]) => name.includes('CATALOG_ITEM'))
      .map(([, value]) => value);
    expect(new Set(identifiers).size).toBe(identifiers.length);
    expect(metadata).toMatchObject({
      nameSingular: 'catalogItem',
      namePlural: 'catalogItems',
      isSearchable: true,
      isUICreatable: true,
      isUIEditable: true,
    });
    const fields = Object.fromEntries(metadata.fields.map((field) => [field.name, field]));
    expect(fields.defaultPrice).toMatchObject({ isNullable: false, defaultValue: 0 });
    expect(fields.currencyCode).toMatchObject({ isNullable: false, defaultValue: "'RUB'" });
    expect(fields.isActive).toMatchObject({ isNullable: false, defaultValue: true });
    expect(fields.sortOrder).toMatchObject({ isNullable: false, defaultValue: 100 });
  });

  it('declares a nullable provenance relation and all native list columns', () => {
    const itemFields = (commercialProposalItemObject as unknown as { config: { fields: Array<Record<string, unknown>> } }).config.fields;
    const catalogFields = (catalogItemObject as unknown as { config: { fields: Array<Record<string, unknown>> } }).config.fields;
    const viewFields = (catalogItemsView as unknown as { config: { fields: Array<Record<string, unknown>> } }).config.fields;
    expect(itemFields.find((field) => field.name === 'catalogItem'))
      .toMatchObject({ isNullable: true });
    expect(catalogFields.find((field) => field.name === 'proposalItems'))
      .toMatchObject({ isNullable: true });
    expect(viewFields).toHaveLength(9);
  });
});

describe('catalog item search', () => {
  it('normalizes bounded filters and rejects invalid inputs', () => {
    expect(normalizeCatalogSearchRequest({ text: '  CRM ', currencyCode: 'rub' })).toMatchObject({
      text: 'crm',
      currencyCode: 'RUB',
      activeOnly: true,
      limit: 30,
      offset: 0,
    });
    expect(() => normalizeCatalogSearchRequest({ limit: 101 })).toThrowError(
      expect.objectContaining({ code: 'INVALID_INPUT' }),
    );
    expect(() => normalizeCatalogSearchRequest({ types: ['UNKNOWN'] })).toThrowError(
      expect.objectContaining({ code: 'INVALID_INPUT' }),
    );
  });

  it('filters active currency items and sorts deterministically', async () => {
    const records = [
      catalogItem({ id: '3', name: 'Бета', sortOrder: 10 }),
      catalogItem({ id: '2', name: 'Альфа', sortOrder: 10 }),
      catalogItem({ id: '1', name: 'Скрытая', isActive: false, sortOrder: 1 }),
      catalogItem({ id: '4', name: 'USD', currencyCode: 'USD', sortOrder: 1 }),
    ];
    const client = {
      query: vi.fn(async () => ({
        catalogItems: { edges: records.map((node) => ({ node })) },
      })),
    };
    const repository = new CatalogItemRepository(client as never);
    const result = await repository.search(
      normalizeCatalogSearchRequest({ currencyCode: 'RUB', activeOnly: true }),
    );

    expect(result.items.map((item) => item.name)).toEqual(['Альфа', 'Бета']);
    expect(result.items.every((item) => item.isSelectable)).toBe(true);
    expect(result.categories).toEqual(['Аналитика']);
  });

  it('returns malformed native records as disabled instead of breaking search', async () => {
    const client = {
      query: vi.fn(async () => ({
        catalogItems: { edges: [{ node: catalogItem({ id: 'bad', defaultPrice: -1 }) }] },
      })),
    };
    const result = await new CatalogItemRepository(client as never).search(
      normalizeCatalogSearchRequest({ query: 'анализ', activeOnly: false }),
    );

    expect(result.items[0]).toMatchObject({
      id: 'bad',
      isSelectable: false,
      validationMessage: 'Некорректная цена',
    });
  });
});

describe('catalog picker snapshot helper', () => {
  it('copies defaults into an independent editor row', () => {
    const source: CatalogItemDto = {
      ...catalogItem(),
      isSelectable: true,
      validationMessage: null,
    };
    const editorItem = createEditorItemFromCatalogItem(source);
    source.defaultPrice = 9000;
    source.name = 'Изменённое имя';

    expect(editorItem).toMatchObject({
      catalogItemId: '123e4567-e89b-42d3-a456-426614174120',
      name: 'Анализ требований',
      block: 'Предпроектные работы',
      unit: 'час',
      unitPrice: '5000',
      quantity: '1',
      discountPercent: '0',
    });
    expect(editorItem.id).toBeUndefined();
    expect(editorItem.clientKey).toMatch(/^[0-9a-f-]{36}$/i);
  });
});
