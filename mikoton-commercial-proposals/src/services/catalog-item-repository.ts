import { CoreApiClient } from 'twenty-client-sdk/core';

import { ApplicationError } from 'src/domain/commercial-proposal';

export const CATALOG_ITEM_TYPES = [
  'SERVICE',
  'PRODUCT',
  'LICENSE',
  'PACKAGE',
  'OTHER',
] as const;

export type CatalogItemType = (typeof CATALOG_ITEM_TYPES)[number];

export type CatalogItemDto = {
  id: string;
  name: string;
  itemType: CatalogItemType;
  category: string | null;
  defaultBlock: string;
  description: string | null;
  defaultUnit: string;
  defaultPrice: number;
  currencyCode: string;
  isActive: boolean;
  sortOrder: number;
  isSelectable: boolean;
  validationMessage: string | null;
};

export type CatalogSearchRequest = {
  query?: string;
  text?: string;
  types?: string[];
  category?: string;
  currencyCode?: string;
  activeOnly?: boolean;
  limit?: number;
  offset?: number;
  cursor?: string;
};

export type NormalizedCatalogSearchRequest = {
  text: string;
  types: CatalogItemType[];
  category: string | null;
  currencyCode: string | null;
  activeOnly: boolean;
  limit: number;
  offset: number;
  cursor: string | null;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const normalizeCatalogSearchRequest = (
  value: unknown,
): NormalizedCatalogSearchRequest => {
  if (value !== undefined && value !== null && !isPlainObject(value)) {
    throw new ApplicationError('INVALID_INPUT', 'Request body must be an object');
  }
  const body = (value ?? {}) as CatalogSearchRequest;
  const types = body.types ?? [];
  if (!Array.isArray(types) || types.some((type) => !CATALOG_ITEM_TYPES.includes(type as CatalogItemType))) {
    throw new ApplicationError('INVALID_INPUT', 'types contains an unsupported catalog item type');
  }
  const currencyCode = body.currencyCode?.trim().toUpperCase() || null;
  if (currencyCode !== null && !/^[A-Z]{3}$/.test(currencyCode)) {
    throw new ApplicationError('INVALID_INPUT', 'currencyCode must be a three-letter ISO code');
  }
  const limit = body.limit ?? 30;
  const offset = body.offset ?? 0;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new ApplicationError('INVALID_INPUT', 'limit must be an integer from 1 to 100');
  }
  if (!Number.isInteger(offset) || offset < 0) {
    throw new ApplicationError('INVALID_INPUT', 'offset must be a non-negative integer');
  }
  return {
    text: (body.query ?? body.text)?.trim().toLocaleLowerCase('ru-RU') ?? '',
    types: types as CatalogItemType[],
    category: body.category?.trim() || null,
    currencyCode,
    activeOnly: body.activeOnly !== false,
    limit,
    offset,
    cursor: body.cursor?.trim() || null,
  };
};

type NativeCurrencyValue = {
  amountMicros?: number | null;
  currencyCode?: string | null;
};

type CatalogRecord = Omit<CatalogItemDto, 'isSelectable' | 'validationMessage'> & {
  price?: NativeCurrencyValue | null;
};

export type ResolvedCatalogItemPrice = {
  amount: number;
  currencyCode: string;
  source: 'NATIVE' | 'LEGACY';
  valid: boolean;
  validationMessage: string | null;
};

export const resolveCatalogItemPrice = (
  record: {
    price?: NativeCurrencyValue | null;
    defaultPrice?: number | null;
    currencyCode?: string | null;
  },
  allowLegacyFallback = process.env.CATALOG_ALLOW_LEGACY_PRICE_FALLBACK === 'true',
): ResolvedCatalogItemPrice => {
  const amountMicros = record.price?.amountMicros;
  const nativeCurrency = record.price?.currencyCode?.trim().toUpperCase() ?? '';
  if (
    typeof amountMicros === 'number' &&
    Number.isSafeInteger(amountMicros) &&
    amountMicros >= 0 &&
    /^[A-Z]{3}$/.test(nativeCurrency)
  ) {
    return {
      amount: amountMicros / 1_000_000,
      currencyCode: nativeCurrency,
      source: 'NATIVE',
      valid: true,
      validationMessage: null,
    };
  }
  const nativePriceWasProvided = record.price !== undefined && record.price !== null;
  const nativeValidationMessage = nativePriceWasProvided
    ? typeof amountMicros !== 'number' || !Number.isSafeInteger(amountMicros) || amountMicros < 0
      ? 'Некорректная цена'
      : !/^[A-Z]{3}$/.test(nativeCurrency)
        ? 'Некорректная валюта'
        : 'Укажите цену и валюту'
    : 'Укажите цену и валюту';
  const legacyCurrency = record.currencyCode?.trim().toUpperCase() ?? '';
  if (
    allowLegacyFallback &&
    typeof record.defaultPrice === 'number' &&
    Number.isFinite(record.defaultPrice) &&
    record.defaultPrice >= 0 &&
    /^[A-Z]{3}$/.test(legacyCurrency)
  ) {
    return {
      amount: record.defaultPrice,
      currencyCode: legacyCurrency,
      source: 'LEGACY',
      valid: true,
      validationMessage: null,
    };
  }
  return {
    amount: 0,
    currencyCode: nativeCurrency || legacyCurrency,
    source: 'NATIVE',
    valid: false,
    validationMessage: nativeValidationMessage,
  };
};

const getCatalogItemValidationMessage = (record: Partial<CatalogRecord>) => {
  if (typeof record.name !== 'string' || record.name.trim() === '') return 'Не указано название';
  if (typeof record.defaultBlock !== 'string' || record.defaultBlock.trim() === '') return 'Не указан блок работ';
  if (typeof record.defaultUnit !== 'string' || record.defaultUnit.trim() === '') return 'Не указана единица измерения';
  if (typeof record.defaultPrice !== 'number' || !Number.isFinite(record.defaultPrice) || record.defaultPrice < 0) return 'Некорректная цена';
  if (typeof record.currencyCode !== 'string' || !/^[A-Z]{3}$/.test(record.currencyCode)) return 'Некорректная валюта';
  if (typeof record.sortOrder !== 'number' || !Number.isInteger(record.sortOrder)) return 'Некорректный порядок';
  return null;
};

const mapCatalogItem = (
  record: Partial<CatalogRecord> & { id: string },
  requestedCurrency: string | null,
): CatalogItemDto => {
  const isActive = record.isActive === true;
  const price = resolveCatalogItemPrice(record);
  const currencyCode = price.currencyCode;
  const defaultPrice = price.amount;
  const currencyMatches = requestedCurrency === null || currencyCode === requestedCurrency;
  const validationMessage = price.validationMessage ?? getCatalogItemValidationMessage({
    ...record,
    defaultPrice,
    currencyCode,
  });
  return {
    id: record.id,
    name: record.name ?? '',
    itemType: record.itemType ?? 'SERVICE',
    category: record.category ?? null,
    defaultBlock: record.defaultBlock ?? 'Работы',
    description: record.description ?? null,
    defaultUnit: record.defaultUnit ?? 'час',
    defaultPrice,
    currencyCode,
    isActive,
    sortOrder: record.sortOrder ?? 100,
    isSelectable: isActive && currencyMatches && validationMessage === null,
    validationMessage: validationMessage ?? (!isActive
      ? 'Позиция неактивна'
      : currencyMatches
        ? null
        : `Позиция доступна только для ${currencyCode}`),
  };
};

export class CatalogItemRepository {
  constructor(
    private readonly client: InstanceType<typeof CoreApiClient> = new CoreApiClient(),
  ) {}

  async search(request: NormalizedCatalogSearchRequest) {
    try {
      const collected: CatalogItemDto[] = [];
      const categories = new Set<string>();
      let after = request.cursor ?? undefined;
      let hasNextPage = true;
      let scannedPages = 0;
      const maxPagesPerRequest = 20;

      while (hasNextPage && collected.length < request.limit && scannedPages < maxPagesPerRequest) {
        const response = await (this.client.query as (selection: unknown) => Promise<any>)({
          catalogItems: {
          __args: { first: 100, ...(after === undefined ? {} : { after }) },
          edges: {
            node: {
              id: true,
              name: true,
              itemType: true,
              category: true,
              defaultBlock: true,
              description: true,
              defaultUnit: true,
              price: {
                amountMicros: true,
                currencyCode: true,
              },
              defaultPrice: true,
              currencyCode: true,
              isActive: true,
              sortOrder: true,
            },
          },
          pageInfo: { endCursor: true, hasNextPage: true },
        },
        });
        const records: CatalogItemDto[] = (response.catalogItems?.edges ?? [])
        .map((edge: { node?: CatalogRecord | null }) => edge.node)
        .filter((record: CatalogRecord | null | undefined): record is CatalogRecord => record != null)
        .map((record: CatalogRecord) => mapCatalogItem(record, request.currencyCode));
        const textMatches = (item: CatalogItemDto) =>
        request.text === '' ||
        `${item.name} ${item.description ?? ''} ${item.category ?? ''}`
          .toLocaleLowerCase('ru-RU')
          .includes(request.text);
        for (const item of records) {
          if (item.category !== null) categories.add(item.category);
        }
        const filtered = records
        .filter((item: CatalogItemDto) => !request.activeOnly || item.isActive)
        .filter((item: CatalogItemDto) => request.types.length === 0 || request.types.includes(item.itemType))
        .filter((item: CatalogItemDto) => request.category === null || item.category === request.category)
        .filter((item: CatalogItemDto) => request.currencyCode === null || item.currencyCode === request.currencyCode)
        .filter(textMatches)
        .sort((left: CatalogItemDto, right: CatalogItemDto) =>
          left.sortOrder - right.sortOrder ||
          left.name.localeCompare(right.name, 'ru') ||
          left.id.localeCompare(right.id),
        );
        collected.push(...filtered.slice(0, request.limit - collected.length));
        hasNextPage = response.catalogItems?.pageInfo?.hasNextPage === true;
        after = hasNextPage
          ? response.catalogItems?.pageInfo?.endCursor ?? undefined
          : undefined;
        scannedPages += 1;
        if (hasNextPage && after === undefined) break;
      }
      return {
        items: collected,
        categories: [...categories].sort((a, b) => a.localeCompare(b, 'ru')),
        pageInfo: {
          limit: request.limit,
          endCursor: after ?? null,
          hasNextPage,
          resultCompleteness: hasNextPage && scannedPages >= maxPagesPerRequest
            ? 'PARTIAL'
            : 'COMPLETE',
        },
      };
    } catch (error) {
      if (error instanceof ApplicationError) throw error;
      throw new ApplicationError(
        'CATALOG_SEARCH_FAILED',
        'Не удалось загрузить каталог работ и услуг',
        error,
      );
    }
  }
}
