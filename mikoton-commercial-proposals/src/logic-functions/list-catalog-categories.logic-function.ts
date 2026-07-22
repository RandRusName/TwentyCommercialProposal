import { defineLogicFunction, HTTPMethod } from 'twenty-sdk/define';
import type { RoutePayload } from 'twenty-sdk/logic-function';

import { LIST_CATALOG_CATEGORIES_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { failure, json, toApplicationError } from 'src/logic-functions/http-response';
import { createLogicFunctionLogger } from 'src/logic-functions/logic-function-logger';
import { CatalogItemRepository } from 'src/services/catalog-item-repository';

type ListCatalogCategoriesRequest = {
  activeOnly?: boolean;
};

const handler = async (event: RoutePayload<ListCatalogCategoriesRequest>) => {
  const logger = createLogicFunctionLogger('list-catalog-categories');
  try {
    const activeOnly = event.body?.activeOnly !== false;
    const result = await new CatalogItemRepository().listCategories(activeOnly);
    logger.success({ resultCount: result.categories.length });
    return json({ status: 'success', ...result, requestId: logger.requestId });
  } catch (error) {
    const applicationError = toApplicationError(error);
    logger.failure(applicationError.code, {
      activeOnly: event.body?.activeOnly,
    });
    return failure(applicationError);
  }
};

export default defineLogicFunction({
  universalIdentifier: LIST_CATALOG_CATEGORIES_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'List Catalog Categories',
  description: 'Authenticated catalog category listing for the proposal editor',
  timeoutSeconds: 10,
  httpRouteTriggerSettings: {
    path: '/catalog-items/categories',
    httpMethod: HTTPMethod.POST,
    isAuthRequired: true,
  },
  handler,
});
