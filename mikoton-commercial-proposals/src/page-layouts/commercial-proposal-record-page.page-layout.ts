import {
  definePageLayout,
  PageLayoutTabLayoutMode,
  PageLayoutType,
} from 'twenty-sdk/define';

import {
  COMMERCIAL_PROPOSAL_OBJECT_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_RECORD_PAGE_HOME_TAB_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_RECORD_PAGE_HOME_WIDGET_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_RECORD_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
  EDIT_COMMERCIAL_PROPOSAL_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default definePageLayout({
  universalIdentifier:
    COMMERCIAL_PROPOSAL_RECORD_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
  name: 'Commercial Proposal Record Page',
  type: PageLayoutType.RECORD_PAGE,
  objectUniversalIdentifier: COMMERCIAL_PROPOSAL_OBJECT_UNIVERSAL_IDENTIFIER,
  tabs: [
    {
      universalIdentifier:
        COMMERCIAL_PROPOSAL_RECORD_PAGE_HOME_TAB_UNIVERSAL_IDENTIFIER,
      title: 'Коммерческое предложение',
      position: 10,
      icon: 'IconFileInvoice',
      // A single canvas tab renders full-width in Twenty 2.20. Generated files
      // are exposed by the front component as a collapsible business section.
      layoutMode: PageLayoutTabLayoutMode.CANVAS,
      widgets: [
        {
          universalIdentifier:
            COMMERCIAL_PROPOSAL_RECORD_PAGE_HOME_WIDGET_UNIVERSAL_IDENTIFIER,
          title: 'Коммерческое предложение',
          type: 'FRONT_COMPONENT',
          gridPosition: {
            row: 0,
            column: 0,
            rowSpan: 12,
            columnSpan: 12,
          },
          objectUniversalIdentifier:
            COMMERCIAL_PROPOSAL_OBJECT_UNIVERSAL_IDENTIFIER,
          configuration: {
            configurationType: 'FRONT_COMPONENT',
            frontComponentUniversalIdentifier:
              EDIT_COMMERCIAL_PROPOSAL_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
          },
        },
      ],
    },
  ],
});
