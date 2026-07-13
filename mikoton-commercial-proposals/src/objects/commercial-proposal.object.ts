import {
  defineObject,
  FieldType,
  RelationType,
  STANDARD_OBJECT,
} from 'twenty-sdk/define';

import {
  COMMERCIAL_PROPOSAL_FIELD_AMOUNT_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_FIELD_COMPANY_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_FIELD_CURRENCY_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_FIELD_DOCX_URL_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_FIELD_FILES_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_FIELD_GENERATED_AT_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_FIELD_IDEMPOTENCY_KEY_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_FIELD_LANGUAGE_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_FIELD_LAST_ERROR_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_FIELD_NUMBER_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_FIELD_OPPORTUNITY_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_FIELD_PAYLOAD_SNAPSHOT_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_FIELD_PDF_URL_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_FIELD_RESULT_METADATA_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_FIELD_SOURCE_TYPE_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_FIELD_STATUS_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_FIELD_TEMPLATE_CODE_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_FIELD_TEMPLATE_VERSION_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_FIELD_TITLE_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_OBJECT_UNIVERSAL_IDENTIFIER,
  COMPANY_FIELD_COMMERCIAL_PROPOSALS_UNIVERSAL_IDENTIFIER,
  OPPORTUNITY_FIELD_COMMERCIAL_PROPOSALS_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineObject({
  universalIdentifier: COMMERCIAL_PROPOSAL_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'commercialProposal',
  namePlural: 'commercialProposals',
  labelSingular: 'Commercial Proposal',
  labelPlural: 'Commercial Proposals',
  description: 'Commercial proposal drafts created from opportunities',
  icon: 'IconFileDescription',
  isSearchable: true,
  isUICreatable: false,
  isUIEditable: true,
  labelIdentifierFieldMetadataUniversalIdentifier:
    COMMERCIAL_PROPOSAL_FIELD_TITLE_UNIVERSAL_IDENTIFIER,
  fields: [
    {
      universalIdentifier: COMMERCIAL_PROPOSAL_FIELD_TITLE_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'title',
      label: 'Title',
      description: 'Human-readable proposal title',
      defaultValue: "''",
      isNullable: false,
    },
    {
      universalIdentifier:
        COMMERCIAL_PROPOSAL_FIELD_NUMBER_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'number',
      label: 'Number',
      description: 'Draft commercial proposal number',
      defaultValue: "''",
      isNullable: false,
      isUnique: false,
    },
    {
      universalIdentifier:
        COMMERCIAL_PROPOSAL_FIELD_STATUS_UNIVERSAL_IDENTIFIER,
      type: FieldType.SELECT,
      name: 'status',
      label: 'Status',
      description: 'Commercial proposal lifecycle status',
      defaultValue: "'DRAFT'",
      isNullable: false,
      options: [
        { position: 0, label: 'Draft', value: 'DRAFT', color: 'gray' },
        {
          position: 1,
          label: 'Generating',
          value: 'GENERATING',
          color: 'yellow',
        },
        { position: 2, label: 'Generated', value: 'GENERATED', color: 'blue' },
        { position: 3, label: 'Sent', value: 'SENT', color: 'purple' },
        { position: 4, label: 'Accepted', value: 'ACCEPTED', color: 'green' },
        { position: 5, label: 'Rejected', value: 'REJECTED', color: 'red' },
        { position: 6, label: 'Failed', value: 'FAILED', color: 'red' },
        { position: 7, label: 'Cancelled', value: 'CANCELLED', color: 'gray' },
      ],
    },
    {
      universalIdentifier:
        COMMERCIAL_PROPOSAL_FIELD_SOURCE_TYPE_UNIVERSAL_IDENTIFIER,
      type: FieldType.SELECT,
      name: 'sourceType',
      label: 'Source type',
      description: 'Object type that initiated the commercial proposal',
      defaultValue: "'OPPORTUNITY'",
      isNullable: false,
      options: [
        { position: 0, label: 'Opportunity', value: 'OPPORTUNITY', color: 'blue' },
      ],
    },
    {
      universalIdentifier:
        COMMERCIAL_PROPOSAL_FIELD_TEMPLATE_CODE_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'templateCode',
      label: 'Template code',
      description: 'Commercial proposal template code requested by the client',
      defaultValue: "''",
      isNullable: false,
    },
    {
      universalIdentifier:
        COMMERCIAL_PROPOSAL_FIELD_TEMPLATE_VERSION_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'templateVersion',
      label: 'Template version',
      description: 'Resolved template version, filled by document generation',
      isNullable: true,
      defaultValue: null,
    },
    {
      universalIdentifier:
        COMMERCIAL_PROPOSAL_FIELD_LANGUAGE_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'language',
      label: 'Language',
      description: 'BCP-47 language tag requested for the commercial proposal',
      defaultValue: "'ru-RU'",
      isNullable: false,
    },
    {
      universalIdentifier:
        COMMERCIAL_PROPOSAL_FIELD_PAYLOAD_SNAPSHOT_UNIVERSAL_IDENTIFIER,
      type: FieldType.RAW_JSON,
      name: 'payloadSnapshot',
      label: 'Payload snapshot',
      description: 'Minimal server-side snapshot of accepted draft input',
      isNullable: true,
      defaultValue: null,
    },
    {
      universalIdentifier:
        COMMERCIAL_PROPOSAL_FIELD_RESULT_METADATA_UNIVERSAL_IDENTIFIER,
      type: FieldType.RAW_JSON,
      name: 'resultMetadata',
      label: 'Result metadata',
      description: 'Future document generation result metadata',
      isNullable: true,
      defaultValue: null,
    },
    {
      universalIdentifier:
        COMMERCIAL_PROPOSAL_FIELD_AMOUNT_UNIVERSAL_IDENTIFIER,
      type: FieldType.NUMBER,
      name: 'amount',
      label: 'Amount',
      description: 'Amount snapshot from the opportunity',
      defaultValue: 0,
      isNullable: true,
      universalSettings: {
        decimals: 2,
      },
    },
    {
      universalIdentifier:
        COMMERCIAL_PROPOSAL_FIELD_CURRENCY_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'currencyCode',
      label: 'Currency code',
      description: 'Currency code snapshot from the opportunity',
      defaultValue: "'RUB'",
      isNullable: true,
    },
    {
      universalIdentifier:
        COMMERCIAL_PROPOSAL_FIELD_OPPORTUNITY_UNIVERSAL_IDENTIFIER,
      type: FieldType.RELATION,
      name: 'opportunity',
      label: 'Opportunity',
      description: 'Source opportunity for this proposal',
      isNullable: false,
      relationTargetObjectMetadataUniversalIdentifier:
        STANDARD_OBJECT.opportunity.universalIdentifier,
      relationTargetFieldMetadataUniversalIdentifier:
        OPPORTUNITY_FIELD_COMMERCIAL_PROPOSALS_UNIVERSAL_IDENTIFIER,
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        joinColumnName: 'opportunityId',
      },
    },
    {
      universalIdentifier:
        COMMERCIAL_PROPOSAL_FIELD_COMPANY_UNIVERSAL_IDENTIFIER,
      type: FieldType.RELATION,
      name: 'company',
      label: 'Company',
      description: 'Company linked through the source opportunity',
      isNullable: true,
      relationTargetObjectMetadataUniversalIdentifier:
        STANDARD_OBJECT.company.universalIdentifier,
      relationTargetFieldMetadataUniversalIdentifier:
        COMPANY_FIELD_COMMERCIAL_PROPOSALS_UNIVERSAL_IDENTIFIER,
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        joinColumnName: 'companyId',
      },
    },
    {
      universalIdentifier:
        COMMERCIAL_PROPOSAL_FIELD_GENERATED_AT_UNIVERSAL_IDENTIFIER,
      type: FieldType.DATE_TIME,
      name: 'generatedAt',
      label: 'Generated at',
      description: 'Time when document generation completed successfully',
      isNullable: true,
      defaultValue: null,
    },
    {
      universalIdentifier:
        COMMERCIAL_PROPOSAL_FIELD_DOCX_URL_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'docxUrl',
      label: 'DOCX URL',
      description: 'Future document-service DOCX URL',
      isNullable: true,
      defaultValue: null,
    },
    {
      universalIdentifier:
        COMMERCIAL_PROPOSAL_FIELD_PDF_URL_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'pdfUrl',
      label: 'PDF URL',
      description: 'Future document-service PDF URL',
      isNullable: true,
      defaultValue: null,
    },
    {
      universalIdentifier:
        COMMERCIAL_PROPOSAL_FIELD_FILES_UNIVERSAL_IDENTIFIER,
      type: FieldType.FILES,
      name: 'files',
      label: 'Files',
      description: 'Future generated proposal files',
      isNullable: true,
      universalSettings: {
        maxNumberOfValues: 10,
      },
    },
    {
      universalIdentifier:
        COMMERCIAL_PROPOSAL_FIELD_IDEMPOTENCY_KEY_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'idempotencyKey',
      label: 'Idempotency key',
      description: 'Client-generated key preventing duplicate draft creation',
      defaultValue: "''",
      isNullable: false,
    },
    {
      universalIdentifier:
        COMMERCIAL_PROPOSAL_FIELD_LAST_ERROR_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'lastError',
      label: 'Last error',
      description: 'Last app-level processing error',
      isNullable: true,
      defaultValue: null,
      universalSettings: {
        displayedMaxRows: 3,
      },
    },
  ],
});
