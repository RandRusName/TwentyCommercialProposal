import { defineCommandMenuItem, numberOfSelectedRecords } from 'twenty-sdk/define';

import {
  COMMERCIAL_PROPOSAL_OBJECT_UNIVERSAL_IDENTIFIER,
  EDIT_COMMERCIAL_PROPOSAL_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  EDIT_COMMERCIAL_PROPOSAL_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineCommandMenuItem({
  universalIdentifier:
    EDIT_COMMERCIAL_PROPOSAL_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  label: 'Редактировать КП',
  shortLabel: 'Редактировать',
  isPinned: true,
  availabilityType: 'GLOBAL_OBJECT_CONTEXT',
  availabilityObjectUniversalIdentifier:
    COMMERCIAL_PROPOSAL_OBJECT_UNIVERSAL_IDENTIFIER,
  conditionalAvailabilityExpression: numberOfSelectedRecords === 1,
  frontComponentUniversalIdentifier:
    EDIT_COMMERCIAL_PROPOSAL_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
});
