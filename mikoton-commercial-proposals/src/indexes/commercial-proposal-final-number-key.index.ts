import { defineIndex } from 'twenty-sdk/define';
import { COMMERCIAL_PROPOSAL_FIELD_FINAL_NUMBER_KEY_UNIVERSAL_IDENTIFIER, COMMERCIAL_PROPOSAL_INDEX_FINAL_NUMBER_KEY_UNIVERSAL_IDENTIFIER, COMMERCIAL_PROPOSAL_OBJECT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

export default defineIndex({
  universalIdentifier: COMMERCIAL_PROPOSAL_INDEX_FINAL_NUMBER_KEY_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: COMMERCIAL_PROPOSAL_OBJECT_UNIVERSAL_IDENTIFIER,
  indexType: 'BTREE',
  isUnique: true,
  fields: [{ universalIdentifier: 'ec6c637e-c5f7-4eaf-8d26-b24ddd6fd4f8', fieldUniversalIdentifier: COMMERCIAL_PROPOSAL_FIELD_FINAL_NUMBER_KEY_UNIVERSAL_IDENTIFIER }],
});
