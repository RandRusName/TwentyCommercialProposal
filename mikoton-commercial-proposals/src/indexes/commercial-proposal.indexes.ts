import { defineIndex } from 'twenty-sdk/define';

import {
  COMMERCIAL_PROPOSAL_FIELD_COMPANY_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_FIELD_IDEMPOTENCY_KEY_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_FIELD_NUMBER_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_FIELD_OPPORTUNITY_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_FIELD_STATUS_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_INDEX_COMPANY_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_INDEX_IDEMPOTENCY_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_INDEX_NUMBER_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_INDEX_OPPORTUNITY_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_INDEX_STATUS_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_OBJECT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export const commercialProposalNumberIndex = defineIndex({
  universalIdentifier: COMMERCIAL_PROPOSAL_INDEX_NUMBER_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: COMMERCIAL_PROPOSAL_OBJECT_UNIVERSAL_IDENTIFIER,
  indexType: 'BTREE',
  fields: [
    {
      universalIdentifier: 'cae84ee1-3408-4215-9cf8-d910adafd631',
      fieldUniversalIdentifier:
        COMMERCIAL_PROPOSAL_FIELD_NUMBER_UNIVERSAL_IDENTIFIER,
    },
  ],
});

export const commercialProposalStatusIndex = defineIndex({
  universalIdentifier: COMMERCIAL_PROPOSAL_INDEX_STATUS_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: COMMERCIAL_PROPOSAL_OBJECT_UNIVERSAL_IDENTIFIER,
  indexType: 'BTREE',
  fields: [
    {
      universalIdentifier: '5f7ba1bc-9625-470c-a412-e25a3604013a',
      fieldUniversalIdentifier:
        COMMERCIAL_PROPOSAL_FIELD_STATUS_UNIVERSAL_IDENTIFIER,
    },
  ],
});

export const commercialProposalOpportunityIndex = defineIndex({
  universalIdentifier:
    COMMERCIAL_PROPOSAL_INDEX_OPPORTUNITY_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: COMMERCIAL_PROPOSAL_OBJECT_UNIVERSAL_IDENTIFIER,
  indexType: 'BTREE',
  fields: [
    {
      universalIdentifier: 'c233e4ed-83f8-4df2-87a5-d187f8379000',
      fieldUniversalIdentifier:
        COMMERCIAL_PROPOSAL_FIELD_OPPORTUNITY_UNIVERSAL_IDENTIFIER,
    },
  ],
});

export const commercialProposalCompanyIndex = defineIndex({
  universalIdentifier: COMMERCIAL_PROPOSAL_INDEX_COMPANY_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: COMMERCIAL_PROPOSAL_OBJECT_UNIVERSAL_IDENTIFIER,
  indexType: 'BTREE',
  fields: [
    {
      universalIdentifier: '1f4d4f76-03f9-453a-a123-a07958d7033b',
      fieldUniversalIdentifier:
        COMMERCIAL_PROPOSAL_FIELD_COMPANY_UNIVERSAL_IDENTIFIER,
    },
  ],
});

export const commercialProposalIdempotencyIndex = defineIndex({
  universalIdentifier:
    COMMERCIAL_PROPOSAL_INDEX_IDEMPOTENCY_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: COMMERCIAL_PROPOSAL_OBJECT_UNIVERSAL_IDENTIFIER,
  indexType: 'BTREE',
  fields: [
    {
      universalIdentifier: 'b315c80a-8631-4213-9168-792f05f94ba3',
      fieldUniversalIdentifier:
        COMMERCIAL_PROPOSAL_FIELD_IDEMPOTENCY_KEY_UNIVERSAL_IDENTIFIER,
    },
  ],
});
