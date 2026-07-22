import { defineIndex } from 'twenty-sdk/define';
import { COMMERCIAL_PROPOSAL_FIELD_STATUS_UNIVERSAL_IDENTIFIER, COMMERCIAL_PROPOSAL_INDEX_STATUS_UNIVERSAL_IDENTIFIER, COMMERCIAL_PROPOSAL_OBJECT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

export default defineIndex({
  universalIdentifier: COMMERCIAL_PROPOSAL_INDEX_STATUS_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: COMMERCIAL_PROPOSAL_OBJECT_UNIVERSAL_IDENTIFIER,
  indexType: 'BTREE',
  fields: [{ universalIdentifier: '5f7ba1bc-9625-470c-a412-e25a3604013a', fieldUniversalIdentifier: COMMERCIAL_PROPOSAL_FIELD_STATUS_UNIVERSAL_IDENTIFIER }],
});
