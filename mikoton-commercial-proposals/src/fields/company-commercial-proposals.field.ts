import {
  defineField,
  FieldType,
  RelationType,
  STANDARD_OBJECT,
} from 'twenty-sdk/define';

import {
  COMMERCIAL_PROPOSAL_FIELD_COMPANY_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_OBJECT_UNIVERSAL_IDENTIFIER,
  COMPANY_FIELD_COMMERCIAL_PROPOSALS_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: COMPANY_FIELD_COMMERCIAL_PROPOSALS_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: STANDARD_OBJECT.company.universalIdentifier,
  type: FieldType.RELATION,
  name: 'commercialProposals',
  label: 'Commercial Proposals',
  description: 'Commercial proposals linked to this company',
  isNullable: true,
  relationTargetObjectMetadataUniversalIdentifier:
    COMMERCIAL_PROPOSAL_OBJECT_UNIVERSAL_IDENTIFIER,
  relationTargetFieldMetadataUniversalIdentifier:
    COMMERCIAL_PROPOSAL_FIELD_COMPANY_UNIVERSAL_IDENTIFIER,
  universalSettings: {
    relationType: RelationType.ONE_TO_MANY,
  },
});
