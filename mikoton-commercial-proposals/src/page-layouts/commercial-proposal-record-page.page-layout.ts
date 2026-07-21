import {
  definePageLayout,
  PageLayoutTabLayoutMode,
  PageLayoutType,
} from 'twenty-sdk/define';

import {
  COMMERCIAL_PROPOSAL_OBJECT_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_RECORD_PAGE_FILES_TAB_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_RECORD_PAGE_FILES_WIDGET_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_RECORD_PAGE_HOME_TAB_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_RECORD_PAGE_HOME_WIDGET_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_RECORD_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_RECORD_PAGE_NOTES_TAB_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_RECORD_PAGE_NOTES_WIDGET_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_RECORD_PAGE_TASKS_TAB_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_RECORD_PAGE_TASKS_WIDGET_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_RECORD_PAGE_TIMELINE_TAB_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_RECORD_PAGE_TIMELINE_WIDGET_UNIVERSAL_IDENTIFIER,
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
      title: 'Home',
      position: 10,
      icon: 'IconHome',
      layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
      widgets: [
        {
          universalIdentifier:
            COMMERCIAL_PROPOSAL_RECORD_PAGE_HOME_WIDGET_UNIVERSAL_IDENTIFIER,
          title: 'Commercial Proposal',
          type: 'FRONT_COMPONENT',
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
    {
      universalIdentifier:
        COMMERCIAL_PROPOSAL_RECORD_PAGE_TIMELINE_TAB_UNIVERSAL_IDENTIFIER,
      title: 'Timeline',
      position: 20,
      icon: 'IconTimelineEvent',
      layoutMode: PageLayoutTabLayoutMode.CANVAS,
      widgets: [
        {
          universalIdentifier:
            COMMERCIAL_PROPOSAL_RECORD_PAGE_TIMELINE_WIDGET_UNIVERSAL_IDENTIFIER,
          title: 'Timeline',
          type: 'TIMELINE',
          objectUniversalIdentifier:
            COMMERCIAL_PROPOSAL_OBJECT_UNIVERSAL_IDENTIFIER,
          configuration: { configurationType: 'TIMELINE' },
        },
      ],
    },
    {
      universalIdentifier:
        COMMERCIAL_PROPOSAL_RECORD_PAGE_TASKS_TAB_UNIVERSAL_IDENTIFIER,
      title: 'Tasks',
      position: 30,
      icon: 'IconCheckbox',
      layoutMode: PageLayoutTabLayoutMode.CANVAS,
      widgets: [
        {
          universalIdentifier:
            COMMERCIAL_PROPOSAL_RECORD_PAGE_TASKS_WIDGET_UNIVERSAL_IDENTIFIER,
          title: 'Tasks',
          type: 'TASKS',
          objectUniversalIdentifier:
            COMMERCIAL_PROPOSAL_OBJECT_UNIVERSAL_IDENTIFIER,
          configuration: { configurationType: 'TASKS' },
        },
      ],
    },
    {
      universalIdentifier:
        COMMERCIAL_PROPOSAL_RECORD_PAGE_NOTES_TAB_UNIVERSAL_IDENTIFIER,
      title: 'Notes',
      position: 40,
      icon: 'IconNotes',
      layoutMode: PageLayoutTabLayoutMode.CANVAS,
      widgets: [
        {
          universalIdentifier:
            COMMERCIAL_PROPOSAL_RECORD_PAGE_NOTES_WIDGET_UNIVERSAL_IDENTIFIER,
          title: 'Notes',
          type: 'NOTES',
          objectUniversalIdentifier:
            COMMERCIAL_PROPOSAL_OBJECT_UNIVERSAL_IDENTIFIER,
          configuration: { configurationType: 'NOTES' },
        },
      ],
    },
    {
      universalIdentifier:
        COMMERCIAL_PROPOSAL_RECORD_PAGE_FILES_TAB_UNIVERSAL_IDENTIFIER,
      title: 'Files',
      position: 50,
      icon: 'IconPaperclip',
      layoutMode: PageLayoutTabLayoutMode.CANVAS,
      widgets: [
        {
          universalIdentifier:
            COMMERCIAL_PROPOSAL_RECORD_PAGE_FILES_WIDGET_UNIVERSAL_IDENTIFIER,
          title: 'Files',
          type: 'FILES',
          objectUniversalIdentifier:
            COMMERCIAL_PROPOSAL_OBJECT_UNIVERSAL_IDENTIFIER,
          configuration: { configurationType: 'FILES' },
        },
      ],
    },
  ],
});
