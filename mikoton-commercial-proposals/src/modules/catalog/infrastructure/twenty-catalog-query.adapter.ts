import type {
  CatalogQueryService,
  CatalogSearchResult,
} from 'src/modules/catalog/application/catalog-query.port';
import {
  CatalogItemRepository,
  normalizeCatalogSearchRequest,
} from 'src/services/catalog-item-repository';

export class TwentyCatalogQueryAdapter implements CatalogQueryService {
  constructor(private readonly repository = new CatalogItemRepository()) {}

  async search(request: Parameters<CatalogItemRepository['search']>[0]) {
    return (await this.repository.search(request)) as CatalogSearchResult;
  }

  listCategories(activeOnly: boolean) {
    return this.repository.listCategories(activeOnly);
  }
}

export { normalizeCatalogSearchRequest };
