import { defineIndex } from 'twenty-sdk/define';

import {
  CATALOG_ITEM_FIELD_IS_ACTIVE_UNIVERSAL_IDENTIFIER,
  CATALOG_ITEM_INDEX_ACTIVE_UNIVERSAL_IDENTIFIER,
  CATALOG_ITEM_OBJECT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineIndex({
  universalIdentifier: CATALOG_ITEM_INDEX_ACTIVE_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: CATALOG_ITEM_OBJECT_UNIVERSAL_IDENTIFIER,
  indexType: 'BTREE',
  fields: [{
    universalIdentifier: '83c24126-46ae-444c-81eb-f818189cf8db',
    fieldUniversalIdentifier: CATALOG_ITEM_FIELD_IS_ACTIVE_UNIVERSAL_IDENTIFIER,
  }],
});
