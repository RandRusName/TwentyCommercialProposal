import { defineIndex } from 'twenty-sdk/define';

import {
  CATALOG_ITEM_FIELD_CURRENCY_CODE_UNIVERSAL_IDENTIFIER,
  CATALOG_ITEM_INDEX_CURRENCY_UNIVERSAL_IDENTIFIER,
  CATALOG_ITEM_OBJECT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineIndex({
  universalIdentifier: CATALOG_ITEM_INDEX_CURRENCY_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: CATALOG_ITEM_OBJECT_UNIVERSAL_IDENTIFIER,
  indexType: 'BTREE',
  fields: [{
    universalIdentifier: 'd3077901-5a55-4012-8649-a2c1094fb7b7',
    fieldUniversalIdentifier: CATALOG_ITEM_FIELD_CURRENCY_CODE_UNIVERSAL_IDENTIFIER,
  }],
});
