import {
  defineField,
  FieldType,
  RelationType,
  STANDARD_OBJECT,
} from 'twenty-sdk/define';

import {
  COMMERCIAL_PROPOSAL_FIELD_OPPORTUNITY_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_OBJECT_UNIVERSAL_IDENTIFIER,
  OPPORTUNITY_FIELD_COMMERCIAL_PROPOSALS_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier:
    OPPORTUNITY_FIELD_COMMERCIAL_PROPOSALS_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: STANDARD_OBJECT.opportunity.universalIdentifier,
  type: FieldType.RELATION,
  name: 'commercialProposals',
  label: 'Commercial Proposals',
  description: 'Commercial proposals created from this opportunity',
  isNullable: true,
  relationTargetObjectMetadataUniversalIdentifier:
    COMMERCIAL_PROPOSAL_OBJECT_UNIVERSAL_IDENTIFIER,
  relationTargetFieldMetadataUniversalIdentifier:
    COMMERCIAL_PROPOSAL_FIELD_OPPORTUNITY_UNIVERSAL_IDENTIFIER,
  universalSettings: {
    relationType: RelationType.ONE_TO_MANY,
  },
});
