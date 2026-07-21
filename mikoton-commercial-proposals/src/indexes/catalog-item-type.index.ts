import { defineIndex } from 'twenty-sdk/define';

import {
  CATALOG_ITEM_FIELD_TYPE_UNIVERSAL_IDENTIFIER,
  CATALOG_ITEM_INDEX_TYPE_UNIVERSAL_IDENTIFIER,
  CATALOG_ITEM_OBJECT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineIndex({
  universalIdentifier: CATALOG_ITEM_INDEX_TYPE_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: CATALOG_ITEM_OBJECT_UNIVERSAL_IDENTIFIER,
  indexType: 'BTREE',
  fields: [{
    universalIdentifier: 'e38bdf0a-c408-40f3-b4d3-b99ec24261dd',
    fieldUniversalIdentifier: CATALOG_ITEM_FIELD_TYPE_UNIVERSAL_IDENTIFIER,
  }],
});
