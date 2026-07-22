import { describe, expect, it, vi } from 'vitest';
import { FieldType } from 'twenty-sdk/define';

import * as universalIdentifiers from 'src/constants/universal-identifiers';
import { createEditorItemFromCatalogItem } from 'src/front-components/commercial-proposal-editor/editor-helpers';
import catalogItemObject from 'src/objects/catalog-item.object';
import commercialProposalItemObject from 'src/objects/commercial-proposal-item.object';
import catalogItemsView from 'src/views/catalog-items.view';
import {
  buildCatalogFilterFingerprint,
  CatalogItemRepository,
  decodeCatalogCursor,
  normalizeCatalogSearchRequest,
  resolveCatalogItemPrice,
  type CatalogItemDto,
} from 'src/services/catalog-item-repository';

type CatalogItemFixture = Omit<CatalogItemDto, 'isSelectable' | 'validationMessage'> & {
  price?: { amountMicros: number | null; currencyCode: string | null } | null;
};

const catalogItem = (
  overrides: Partial<CatalogItemFixture> = {},
): CatalogItemFixture => ({
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
  price: { amountMicros: 5_000_000_000, currencyCode: 'RUB' },
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
    expect(fields.price).toMatchObject({
      type: FieldType.CURRENCY,
      isNullable: true,
      defaultValue: null,
    });
    expect(fields.defaultPrice).toMatchObject({ isNullable: false, defaultValue: 0, isUIEditable: false });
    expect(fields.currencyCode).toMatchObject({ isNullable: false, defaultValue: "'RUB'", isUIEditable: false });
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
    expect(viewFields).toHaveLength(8);
    expect(viewFields.find((field) => field.universalIdentifier === universalIdentifiers.CATALOG_ITEM_VIEW_FIELD_NATIVE_PRICE_UNIVERSAL_IDENTIFIER))
      .toMatchObject({
        fieldMetadataUniversalIdentifier:
          universalIdentifiers.CATALOG_ITEM_FIELD_PRICE_UNIVERSAL_IDENTIFIER,
      });
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
      catalogItem({
        id: '4',
        name: 'USD',
        currencyCode: 'USD',
        price: { amountMicros: 5_000_000_000, currencyCode: 'USD' },
        sortOrder: 1,
      }),
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
    expect(result.categories).toEqual([]);
    expect(result.pageCategories).toEqual(['Аналитика']);
  });

  it('returns malformed native records as disabled instead of breaking search', async () => {
    const client = {
      query: vi.fn(async () => ({
        catalogItems: {
          edges: [{
            node: catalogItem({
              id: 'bad',
              price: { amountMicros: -1, currencyCode: 'RUB' },
            }),
          }],
        },
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

  it('disables malformed itemType in search without treating it as selectable SERVICE', async () => {
    const client = {
      query: vi.fn(async () => ({
        catalogItems: {
          edges: [{
            node: catalogItem({
              id: 'bad-type',
              itemType: 'UNKNOWN' as never,
            }),
          }],
        },
      })),
    };
    const result = await new CatalogItemRepository(client as never).search(
      normalizeCatalogSearchRequest({ activeOnly: false }),
    );

    expect(result.items[0]).toMatchObject({
      id: 'bad-type',
      isSelectable: false,
      validationMessage: 'Некорректный тип позиции',
    });
    expect(result.items[0]?.itemType).not.toBe('SERVICE');
  });

  it('prefers the native currency field and converts micros to decimals', async () => {
    const client = {
      query: vi.fn(async () => ({
        catalogItems: {
          edges: [{
            node: {
              ...catalogItem({ defaultPrice: 1, currencyCode: 'USD' }),
              price: { amountMicros: 5_500_000_000, currencyCode: 'RUB' },
            },
          }],
        },
      })),
    };
    const result = await new CatalogItemRepository(client as never).search(
      normalizeCatalogSearchRequest({ currencyCode: 'RUB' }),
    );

    expect(result.items[0]).toMatchObject({
      defaultPrice: 5500,
      currencyCode: 'RUB',
      isSelectable: true,
    });
  });

  it.each(['RUB', 'USD', 'EUR'])('accepts native %s currency values', (currencyCode) => {
    expect(resolveCatalogItemPrice({
      price: { amountMicros: 123_450_000, currencyCode },
      defaultPrice: 999,
      currencyCode: 'RUB',
    })).toMatchObject({
      amount: 123.45,
      currencyCode,
      source: 'NATIVE',
      valid: true,
    });
  });

  it('keeps legacy price fallback disabled unless explicitly enabled', () => {
    const record = { defaultPrice: 5000, currencyCode: 'RUB' };

    expect(resolveCatalogItemPrice(record, false)).toMatchObject({ valid: false });
    expect(resolveCatalogItemPrice(record, true)).toMatchObject({
      amount: 5000,
      currencyCode: 'RUB',
      source: 'LEGACY',
      valid: true,
    });
  });

  it('continues cursor pagination past 500 upstream records', async () => {
    let page = 0;
    const client = {
      query: vi.fn(async () => {
        const currentPage = page++;
        return {
          catalogItems: {
            edges: Array.from({ length: 100 }, (_, index) => ({
              node: catalogItem({
                id: `${currentPage}-${index}`,
                name: currentPage === 5 && index === 10 ? 'Needle' : `Item ${currentPage}-${index}`,
              }),
            })),
            pageInfo: {
              endCursor: `cursor-${currentPage}`,
              hasNextPage: currentPage < 5,
            },
          },
        };
      }),
    };

    const result = await new CatalogItemRepository(client as never).search(
      normalizeCatalogSearchRequest({ query: 'Needle', limit: 10 }),
    );

    expect(client.query).toHaveBeenCalledTimes(6);
    expect(result.items.map((item) => item.name)).toEqual(['Needle']);
    expect(result.pageInfo.resultCompleteness).toBe('COMPLETE');
  });

  it('rejects malformed cursors', () => {
    expect(() => normalizeCatalogSearchRequest({ cursor: '%%%' })).toThrowError(
      expect.objectContaining({ code: 'INVALID_INPUT' }),
    );
    expect(() => normalizeCatalogSearchRequest({ cursor: Buffer.from('{"v":2}').toString('base64url') })).toThrowError(
      expect.objectContaining({ code: 'INVALID_INPUT' }),
    );
  });

  it('binds cursors to filter fingerprints and rejects cross-filter reuse', () => {
    const rub = normalizeCatalogSearchRequest({ currencyCode: 'RUB' });
    const fingerprint = buildCatalogFilterFingerprint(rub);
    const cursor = Buffer.from(
      JSON.stringify({ v: 2, after: 'page-0', skip: 10, filterFingerprint: fingerprint }),
    ).toString('base64url');

    expect(decodeCatalogCursor(cursor, rub)).toMatchObject({
      v: 2,
      after: 'page-0',
      skip: 10,
      filterFingerprint: fingerprint,
    });

    expect(() =>
      decodeCatalogCursor(cursor, normalizeCatalogSearchRequest({ currencyCode: 'USD' })),
    ).toThrowError(
      expect.objectContaining({
        code: 'INVALID_INPUT',
        message: 'cursor does not match current filters',
      }),
    );
    expect(() =>
      decodeCatalogCursor(cursor, normalizeCatalogSearchRequest({ text: 'crm', currencyCode: 'RUB' })),
    ).toThrowError(expect.objectContaining({ code: 'INVALID_INPUT' }));
    expect(() =>
      decodeCatalogCursor(
        cursor,
        normalizeCatalogSearchRequest({ category: 'Аналитика', currencyCode: 'RUB' }),
      ),
    ).toThrowError(expect.objectContaining({ code: 'INVALID_INPUT' }));
    expect(() =>
      decodeCatalogCursor(
        cursor,
        normalizeCatalogSearchRequest({ currencyCode: 'RUB', activeOnly: false }),
      ),
    ).toThrowError(expect.objectContaining({ code: 'INVALID_INPUT' }));
  });

  it('rejects out-of-bounds skip and oversized after values', () => {
    const request = normalizeCatalogSearchRequest({ currencyCode: 'RUB' });
    const fingerprint = buildCatalogFilterFingerprint(request);

    expect(() =>
      decodeCatalogCursor(
        Buffer.from(
          JSON.stringify({ v: 2, after: null, skip: -1, filterFingerprint: fingerprint }),
        ).toString('base64url'),
        request,
      ),
    ).toThrowError(expect.objectContaining({ code: 'INVALID_INPUT' }));
    expect(() =>
      decodeCatalogCursor(
        Buffer.from(
          JSON.stringify({ v: 2, after: null, skip: 101, filterFingerprint: fingerprint }),
        ).toString('base64url'),
        request,
      ),
    ).toThrowError(expect.objectContaining({ code: 'INVALID_INPUT' }));
    expect(() =>
      decodeCatalogCursor(
        Buffer.from(
          JSON.stringify({
            v: 2,
            after: 'x'.repeat(513),
            skip: 0,
            filterFingerprint: fingerprint,
          }),
        ).toString('base64url'),
        request,
      ),
    ).toThrowError(expect.objectContaining({ code: 'INVALID_INPUT' }));
    expect(() =>
      decodeCatalogCursor(
        Buffer.from(
          JSON.stringify({
            v: 2,
            after: null,
            skip: 0,
            filterFingerprint: fingerprint,
            extra: true,
          }),
        ).toString('base64url'),
        request,
      ),
    ).toThrowError(expect.objectContaining({ code: 'INVALID_INPUT' }));
  });

  it('does not skip filtered matches inside a raw page when paginating', async () => {
    const matching = Array.from({ length: 80 }, (_, index) =>
      catalogItem({
        id: `match-${String(index).padStart(3, '0')}`,
        name: `Match ${String(index).padStart(3, '0')}`,
        sortOrder: index,
      }),
    );
    const nonMatching = Array.from({ length: 20 }, (_, index) =>
      catalogItem({
        id: `other-${index}`,
        name: `Other ${index}`,
        currencyCode: 'USD',
        price: { amountMicros: 1_000_000, currencyCode: 'USD' },
        sortOrder: 1000 + index,
      }),
    );
    const client = {
      query: vi.fn(async ({ catalogItems }: { catalogItems: { __args?: { after?: string } } }) => {
        const after = catalogItems.__args?.after;
        if (after === undefined) {
          return {
            catalogItems: {
              edges: [...matching, ...nonMatching].map((node) => ({ node })),
              pageInfo: { endCursor: 'page-0', hasNextPage: false },
            },
          };
        }
        return {
          catalogItems: {
            edges: [],
            pageInfo: { endCursor: null, hasNextPage: false },
          },
        };
      }),
    };
    const repository = new CatalogItemRepository(client as never);
    const first = await repository.search(
      normalizeCatalogSearchRequest({ currencyCode: 'RUB', limit: 30 }),
    );
    expect(first.items).toHaveLength(30);
    expect(first.pageInfo.hasNextPage).toBe(true);
    expect(first.pageInfo.endCursor).not.toBeNull();

    const second = await repository.search(
      normalizeCatalogSearchRequest({
        currencyCode: 'RUB',
        limit: 30,
        cursor: first.pageInfo.endCursor!,
      }),
    );
    const third = await repository.search(
      normalizeCatalogSearchRequest({
        currencyCode: 'RUB',
        limit: 30,
        cursor: second.pageInfo.endCursor!,
      }),
    );

    const allIds = [...first.items, ...second.items, ...third.items].map((item) => item.id);
    expect(allIds).toHaveLength(80);
    expect(new Set(allIds).size).toBe(80);
    expect(allIds).toEqual(matching.map((item) => item.id));
    expect(third.pageInfo.hasNextPage).toBe(false);
  });

  it('preserves matches across multiple raw pages without duplicates', async () => {
    const pages = [0, 1, 2].map((currentPage) => ({
      edges: Array.from({ length: 100 }, (_, index) => ({
        node: catalogItem({
          id: `p${currentPage}-${index}`,
          name: index % 2 === 0 ? `Keep ${currentPage}-${index}` : `Skip ${currentPage}-${index}`,
          category: index % 2 === 0 ? 'Keep' : 'Skip',
          sortOrder: currentPage * 100 + index,
        }),
      })),
      pageInfo: {
        endCursor: `cursor-${currentPage}`,
        hasNextPage: currentPage < 2,
      },
    }));
    const client = {
      query: vi.fn(async (selection: { catalogItems: { __args?: { after?: string } } }) => {
        const after = selection.catalogItems.__args?.after;
        const pageIndex = after === undefined ? 0 : Number(String(after).replace('cursor-', '')) + 1;
        return { catalogItems: pages[pageIndex] ?? { edges: [], pageInfo: { endCursor: null, hasNextPage: false } } };
      }),
    };
    const repository = new CatalogItemRepository(client as never);
    const seen: string[] = [];
    let cursor: string | null = null;
    for (let round = 0; round < 10; round += 1) {
      const pageResult = await repository.search(
        normalizeCatalogSearchRequest({
          category: 'Keep',
          limit: 40,
          cursor: cursor ?? undefined,
        }),
      );
      seen.push(...pageResult.items.map((item) => item.id));
      if (!pageResult.pageInfo.hasNextPage) break;
      cursor = pageResult.pageInfo.endCursor;
    }

    expect(seen).toHaveLength(150);
    expect(new Set(seen).size).toBe(150);
  });
});

describe('catalog categories listing', () => {
  it('collects unique categories across raw pages with stable sorting', async () => {
    const pages = [0, 1, 2, 3, 4, 5].map((currentPage) => ({
      edges: Array.from({ length: 100 }, (_, index) => ({
        node: catalogItem({
          id: `p${currentPage}-${index}`,
          name: `Item ${currentPage}-${index}`,
          category:
            currentPage === 5 && index === 0
              ? 'Поздняя категория'
              : currentPage % 2 === 0
                ? 'Альфа'
                : 'Бета',
          sortOrder: currentPage * 100 + index,
        }),
      })),
      pageInfo: {
        endCursor: `cursor-${currentPage}`,
        hasNextPage: currentPage < 5,
      },
    }));
    const client = {
      query: vi.fn(async (selection: { catalogItems: { __args?: { after?: string } } }) => {
        const after = selection.catalogItems.__args?.after;
        const pageIndex = after === undefined ? 0 : Number(String(after).replace('cursor-', '')) + 1;
        return {
          catalogItems:
            pages[pageIndex] ?? { edges: [], pageInfo: { endCursor: null, hasNextPage: false } },
        };
      }),
    };

    const result = await new CatalogItemRepository(client as never).listCategories(true);

    expect(client.query).toHaveBeenCalledTimes(6);
    expect(result.categories).toEqual(['Альфа', 'Бета', 'Поздняя категория']);
    expect(result.pageInfo.resultCompleteness).toBe('COMPLETE');
  });

  it('marks category scan as PARTIAL when the safety limit is hit', async () => {
    const client = {
      query: vi.fn(async () => ({
        catalogItems: {
          edges: [{ node: catalogItem({ category: 'Альфа' }) }],
          pageInfo: { endCursor: 'next', hasNextPage: true },
        },
      })),
    };

    const result = await new CatalogItemRepository(client as never).listCategories(
      true,
      { maxRawPages: 2 },
    );

    expect(client.query).toHaveBeenCalledTimes(2);
    expect(result.pageInfo.resultCompleteness).toBe('PARTIAL');
    expect(result.categories).toEqual(['Альфа']);
  });

  it('ignores malformed records while scanning categories', async () => {
    const client = {
      query: vi.fn(async () => ({
        catalogItems: {
          edges: [
            { node: null },
            { node: catalogItem({ category: 'Ок' }) },
            { node: catalogItem({ category: null }) },
          ],
          pageInfo: { endCursor: null, hasNextPage: false },
        },
      })),
    };

    const result = await new CatalogItemRepository(client as never).listCategories(true);
    expect(result.categories).toEqual(['Ок']);
    expect(result.pageInfo.resultCompleteness).toBe('COMPLETE');
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
