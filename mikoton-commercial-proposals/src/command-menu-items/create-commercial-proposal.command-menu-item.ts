import { defineCommandMenuItem, STANDARD_OBJECT } from 'twenty-sdk/define';

import {
  CREATE_COMMERCIAL_PROPOSAL_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  CREATE_COMMERCIAL_PROPOSAL_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineCommandMenuItem({
  universalIdentifier:
    CREATE_COMMERCIAL_PROPOSAL_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  label: 'Create commercial proposal',
  shortLabel: 'Create CP',
  isPinned: true,
  availabilityType: 'GLOBAL_OBJECT_CONTEXT',
  availabilityObjectUniversalIdentifier:
    STANDARD_OBJECT.opportunity.universalIdentifier,
  frontComponentUniversalIdentifier:
    CREATE_COMMERCIAL_PROPOSAL_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
});
