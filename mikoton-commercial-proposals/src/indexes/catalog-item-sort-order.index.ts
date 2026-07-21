import { defineIndex } from 'twenty-sdk/define';

import {
  CATALOG_ITEM_FIELD_SORT_ORDER_UNIVERSAL_IDENTIFIER,
  CATALOG_ITEM_INDEX_SORT_ORDER_UNIVERSAL_IDENTIFIER,
  CATALOG_ITEM_OBJECT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineIndex({
  universalIdentifier: CATALOG_ITEM_INDEX_SORT_ORDER_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: CATALOG_ITEM_OBJECT_UNIVERSAL_IDENTIFIER,
  indexType: 'BTREE',
  fields: [{
    universalIdentifier: 'b9edb7f9-ea45-4e38-8d5f-5eba997e7fea',
    fieldUniversalIdentifier: CATALOG_ITEM_FIELD_SORT_ORDER_UNIVERSAL_IDENTIFIER,
  }],
});
