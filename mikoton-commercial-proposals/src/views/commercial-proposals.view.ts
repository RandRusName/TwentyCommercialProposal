import {
  defineView,
  ViewKey,
  ViewOpenRecordIn,
  ViewSortDirection,
  ViewType,
  ViewVisibility,
} from 'twenty-sdk/define';

import {
  COMMERCIAL_PROPOSAL_FIELD_AMOUNT_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_FIELD_COMPANY_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_FIELD_GENERATED_AT_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_FIELD_NUMBER_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_FIELD_OPPORTUNITY_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_FIELD_STATUS_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_FIELD_TITLE_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_OBJECT_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_VIEW_ALL_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_VIEW_FIELD_AMOUNT_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_VIEW_FIELD_COMPANY_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_VIEW_FIELD_GENERATED_AT_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_VIEW_FIELD_NUMBER_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_VIEW_FIELD_OPPORTUNITY_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_VIEW_FIELD_STATUS_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_VIEW_FIELD_TITLE_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineView({
  universalIdentifier: COMMERCIAL_PROPOSAL_VIEW_ALL_UNIVERSAL_IDENTIFIER,
  name: 'All Commercial Proposals',
  objectUniversalIdentifier: COMMERCIAL_PROPOSAL_OBJECT_UNIVERSAL_IDENTIFIER,
  type: ViewType.TABLE,
  key: ViewKey.INDEX,
  icon: 'IconFileDescription',
  position: 0,
  visibility: ViewVisibility.WORKSPACE,
  openRecordIn: ViewOpenRecordIn.RECORD_PAGE,
  fields: [
    {
      universalIdentifier:
        COMMERCIAL_PROPOSAL_VIEW_FIELD_TITLE_UNIVERSAL_IDENTIFIER,
      fieldMetadataUniversalIdentifier:
        COMMERCIAL_PROPOSAL_FIELD_TITLE_UNIVERSAL_IDENTIFIER,
      position: 0,
      size: 220,
      isVisible: true,
    },
    {
      universalIdentifier:
        COMMERCIAL_PROPOSAL_VIEW_FIELD_NUMBER_UNIVERSAL_IDENTIFIER,
      fieldMetadataUniversalIdentifier:
        COMMERCIAL_PROPOSAL_FIELD_NUMBER_UNIVERSAL_IDENTIFIER,
      position: 1,
      size: 120,
      isVisible: true,
    },
    {
      universalIdentifier:
        COMMERCIAL_PROPOSAL_VIEW_FIELD_STATUS_UNIVERSAL_IDENTIFIER,
      fieldMetadataUniversalIdentifier:
        COMMERCIAL_PROPOSAL_FIELD_STATUS_UNIVERSAL_IDENTIFIER,
      position: 2,
      size: 120,
      isVisible: true,
    },
    {
      universalIdentifier:
        COMMERCIAL_PROPOSAL_VIEW_FIELD_OPPORTUNITY_UNIVERSAL_IDENTIFIER,
      fieldMetadataUniversalIdentifier:
        COMMERCIAL_PROPOSAL_FIELD_OPPORTUNITY_UNIVERSAL_IDENTIFIER,
      position: 3,
      size: 220,
      isVisible: true,
    },
    {
      universalIdentifier:
        COMMERCIAL_PROPOSAL_VIEW_FIELD_COMPANY_UNIVERSAL_IDENTIFIER,
      fieldMetadataUniversalIdentifier:
        COMMERCIAL_PROPOSAL_FIELD_COMPANY_UNIVERSAL_IDENTIFIER,
      position: 4,
      size: 200,
      isVisible: true,
    },
    {
      universalIdentifier:
        COMMERCIAL_PROPOSAL_VIEW_FIELD_AMOUNT_UNIVERSAL_IDENTIFIER,
      fieldMetadataUniversalIdentifier:
        COMMERCIAL_PROPOSAL_FIELD_AMOUNT_UNIVERSAL_IDENTIFIER,
      position: 5,
      size: 120,
      isVisible: true,
    },
    {
      universalIdentifier:
        COMMERCIAL_PROPOSAL_VIEW_FIELD_GENERATED_AT_UNIVERSAL_IDENTIFIER,
      fieldMetadataUniversalIdentifier:
        COMMERCIAL_PROPOSAL_FIELD_GENERATED_AT_UNIVERSAL_IDENTIFIER,
      position: 6,
      size: 160,
      isVisible: true,
    },
  ],
  sorts: [
    {
      universalIdentifier: 'e40fc0d9-a4f6-4e6d-a961-ca5fb60b22d8',
      fieldMetadataUniversalIdentifier:
        COMMERCIAL_PROPOSAL_FIELD_GENERATED_AT_UNIVERSAL_IDENTIFIER,
      direction: ViewSortDirection.DESC,
    },
  ],
});
