import type {
  CatalogItemDto,
  CatalogSearchRequest,
  NormalizedCatalogSearchRequest,
} from 'src/services/catalog-item-repository';

export type CatalogSearchResult = {
  items: CatalogItemDto[];
  categories: string[];
  pageCategories: string[];
  pageInfo: {
    limit: number;
    endCursor: string | null;
    hasNextPage: boolean;
    resultCompleteness: 'COMPLETE' | 'PARTIAL';
  };
};

export interface CatalogQueryService {
  search(request: NormalizedCatalogSearchRequest): Promise<CatalogSearchResult>;
  listCategories(activeOnly: boolean): Promise<{
    categories: string[];
    pageInfo: { resultCompleteness: 'COMPLETE' | 'PARTIAL' };
  }>;
}

export type { CatalogSearchRequest };
