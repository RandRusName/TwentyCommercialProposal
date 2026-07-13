import { defineCommandMenuItem, STANDARD_OBJECT } from 'twenty-sdk/define';

import {
  CREATE_COMMERCIAL_PROPOSAL_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  CREATE_COMMERCIAL_PROPOSAL_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineCommandMenuItem({
  universalIdentifier:
    CREATE_COMMERCIAL_PROPOSAL_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  label: 'Создать коммерческое предложение',
  shortLabel: 'Создать КП',
  isPinned: true,
  availabilityType: 'GLOBAL_OBJECT_CONTEXT',
  availabilityObjectUniversalIdentifier:
    STANDARD_OBJECT.opportunity.universalIdentifier,
  conditionalAvailabilityExpression: 'numberOfSelectedRecords == 1',
  frontComponentUniversalIdentifier:
    CREATE_COMMERCIAL_PROPOSAL_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
});
