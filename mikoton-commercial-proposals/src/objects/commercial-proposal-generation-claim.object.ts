import { defineObject, FieldType } from 'twenty-sdk/define';

import {
  COMMERCIAL_PROPOSAL_GENERATION_CLAIM_FIELD_EDITOR_REVISION_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_GENERATION_CLAIM_FIELD_FINGERPRINT_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_GENERATION_CLAIM_FIELD_LEASE_EXPIRES_AT_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_GENERATION_CLAIM_FIELD_OPERATION_ID_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_GENERATION_CLAIM_FIELD_OWNER_TOKEN_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_GENERATION_CLAIM_FIELD_PROPOSAL_KEY_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_GENERATION_CLAIM_OBJECT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineObject({
  universalIdentifier:
    COMMERCIAL_PROPOSAL_GENERATION_CLAIM_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'commercialProposalGenerationClaim',
  namePlural: 'commercialProposalGenerationClaims',
  labelSingular: 'Generation claim',
  labelPlural: 'Generation claims',
  description:
    'Technical one-row-per-proposal lock used to serialize document generation',
  icon: 'IconLock',
  isSearchable: false,
  isUICreatable: false,
  isUIEditable: false,
  labelIdentifierFieldMetadataUniversalIdentifier:
    COMMERCIAL_PROPOSAL_GENERATION_CLAIM_FIELD_PROPOSAL_KEY_UNIVERSAL_IDENTIFIER,
  fields: [
    {
      universalIdentifier:
        COMMERCIAL_PROPOSAL_GENERATION_CLAIM_FIELD_PROPOSAL_KEY_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'proposalKey',
      label: 'Proposal key',
      description: 'CommercialProposal id owned by this generation claim',
      defaultValue: "''",
      isNullable: false,
      isUIEditable: false,
    },
    {
      universalIdentifier:
        COMMERCIAL_PROPOSAL_GENERATION_CLAIM_FIELD_OPERATION_ID_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'operationId',
      label: 'Operation id',
      description: 'Logical generation idempotency key for the user operation',
      defaultValue: "''",
      isNullable: false,
      isUIEditable: false,
    },
    {
      universalIdentifier:
        COMMERCIAL_PROPOSAL_GENERATION_CLAIM_FIELD_OWNER_TOKEN_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'ownerToken',
      label: 'Owner token',
      description:
        'Physical worker/execution token used for lease fencing; distinct from operationId',
      defaultValue: "''",
      isNullable: false,
      isUIEditable: false,
    },
    {
      universalIdentifier:
        COMMERCIAL_PROPOSAL_GENERATION_CLAIM_FIELD_EDITOR_REVISION_UNIVERSAL_IDENTIFIER,
      type: FieldType.NUMBER,
      name: 'editorRevision',
      label: 'Editor revision',
      description: 'Proposal editorRevision captured when the claim was acquired',
      defaultValue: 0,
      isNullable: false,
      isUIEditable: false,
    },
    {
      universalIdentifier:
        COMMERCIAL_PROPOSAL_GENERATION_CLAIM_FIELD_FINGERPRINT_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'fingerprint',
      label: 'Fingerprint',
      description: 'Canonical content fingerprint captured when the claim was acquired',
      defaultValue: "''",
      isNullable: false,
      isUIEditable: false,
    },
    {
      universalIdentifier:
        COMMERCIAL_PROPOSAL_GENERATION_CLAIM_FIELD_LEASE_EXPIRES_AT_UNIVERSAL_IDENTIFIER,
      type: FieldType.DATE_TIME,
      name: 'leaseExpiresAt',
      label: 'Lease expires at',
      description: 'Stale-lock recovery deadline for a crashed generation owner',
      isNullable: false,
      defaultValue: null,
      isUIEditable: false,
    },
  ],
});
