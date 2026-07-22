import { defineLogicFunction, HTTPMethod } from 'twenty-sdk/define';
import type { RoutePayload } from 'twenty-sdk/logic-function';

import { SEARCH_CATALOG_ITEMS_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { failure, json, toApplicationError } from 'src/logic-functions/http-response';
import { createLogicFunctionLogger } from 'src/logic-functions/logic-function-logger';
import {
  CatalogItemRepository,
  normalizeCatalogSearchRequest,
  type CatalogSearchRequest,
} from 'src/services/catalog-item-repository';

const handler = async (event: RoutePayload<CatalogSearchRequest>) => {
  const logger = createLogicFunctionLogger('search-catalog-items');
  try {
    const request = normalizeCatalogSearchRequest(event.body);
    const result = await new CatalogItemRepository().search(request);
    logger.success({ resultCount: result.items.length });
    return json({ status: 'success', ...result, requestId: logger.requestId });
  } catch (error) {
    const applicationError = toApplicationError(error);
    logger.failure(applicationError.code, {
      activeOnly: event.body?.activeOnly,
      limit: event.body?.limit,
      hasText: [event.body?.query, event.body?.text].some(
        (value) => typeof value === 'string' && value.trim() !== '',
      ),
    });
    return failure(applicationError);
  }
};

export default defineLogicFunction({
  universalIdentifier: SEARCH_CATALOG_ITEMS_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'Search Catalog Items',
  description: 'Authenticated bounded catalog search for the proposal editor',
  timeoutSeconds: 10,
  httpRouteTriggerSettings: {
    path: '/catalog-items/search',
    httpMethod: HTTPMethod.POST,
    isAuthRequired: true,
  },
  handler,
});
