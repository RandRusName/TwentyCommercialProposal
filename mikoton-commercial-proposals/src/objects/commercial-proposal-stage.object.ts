import { defineObject, FieldType, RelationType } from 'twenty-sdk/define';

import {
  COMMERCIAL_PROPOSAL_FIELD_STAGES_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_OBJECT_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_STAGE_FIELD_CLIENT_KEY_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_STAGE_FIELD_COMMERCIAL_PROPOSAL_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_STAGE_FIELD_DESCRIPTION_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_STAGE_FIELD_DURATION_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_STAGE_FIELD_POSITION_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_STAGE_FIELD_RESULT_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_STAGE_FIELD_TITLE_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_STAGE_OBJECT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineObject({
  universalIdentifier: COMMERCIAL_PROPOSAL_STAGE_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'commercialProposalStage',
  namePlural: 'commercialProposalStages',
  labelSingular: 'Commercial Proposal Stage',
  labelPlural: 'Commercial Proposal Stages',
  description: 'Commercial proposal delivery stage',
  icon: 'IconTimeline',
  isSearchable: false,
  isUICreatable: false,
  isUIEditable: false,
  labelIdentifierFieldMetadataUniversalIdentifier:
    COMMERCIAL_PROPOSAL_STAGE_FIELD_TITLE_UNIVERSAL_IDENTIFIER,
  fields: [
    {
      universalIdentifier:
        COMMERCIAL_PROPOSAL_STAGE_FIELD_COMMERCIAL_PROPOSAL_UNIVERSAL_IDENTIFIER,
      type: FieldType.RELATION,
      name: 'commercialProposal',
      label: 'Commercial Proposal',
      description: 'Parent commercial proposal',
      isNullable: false,
      relationTargetObjectMetadataUniversalIdentifier:
        COMMERCIAL_PROPOSAL_OBJECT_UNIVERSAL_IDENTIFIER,
      relationTargetFieldMetadataUniversalIdentifier:
        COMMERCIAL_PROPOSAL_FIELD_STAGES_UNIVERSAL_IDENTIFIER,
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        joinColumnName: 'commercialProposalId',
      },
    },
    {
      universalIdentifier:
        COMMERCIAL_PROPOSAL_STAGE_FIELD_CLIENT_KEY_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'clientKey',
      label: 'Client key',
      description: 'Client-generated UUID used for replay-safe upsert',
      defaultValue: "''",
      isNullable: false,
    },
    {
      universalIdentifier:
        COMMERCIAL_PROPOSAL_STAGE_FIELD_POSITION_UNIVERSAL_IDENTIFIER,
      type: FieldType.NUMBER,
      name: 'sortOrder',
      label: 'Position',
      description: 'Server-normalized stage order',
      defaultValue: 1,
      isNullable: false,
      universalSettings: { decimals: 0 },
    },
    {
      universalIdentifier:
        COMMERCIAL_PROPOSAL_STAGE_FIELD_TITLE_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'title',
      label: 'Title',
      description: 'Stage title',
      defaultValue: "''",
      isNullable: false,
    },
    {
      universalIdentifier:
        COMMERCIAL_PROPOSAL_STAGE_FIELD_RESULT_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'result',
      label: 'Result',
      description: 'Expected stage result',
      isNullable: true,
      defaultValue: null,
      universalSettings: { displayedMaxRows: 4 },
    },
    {
      universalIdentifier:
        COMMERCIAL_PROPOSAL_STAGE_FIELD_DURATION_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'duration',
      label: 'Duration',
      description: 'Expected stage duration',
      isNullable: true,
      defaultValue: null,
    },
    {
      universalIdentifier:
        COMMERCIAL_PROPOSAL_STAGE_FIELD_DESCRIPTION_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'description',
      label: 'Description',
      description: 'Optional stage description',
      isNullable: true,
      defaultValue: null,
      universalSettings: { displayedMaxRows: 4 },
    },
  ],
});
