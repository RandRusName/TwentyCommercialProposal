import {
  defineNavigationMenuItem,
  NavigationMenuItemType,
} from 'twenty-sdk/define';

import {
  COMMERCIAL_PROPOSAL_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_OBJECT_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_VIEW_ALL_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineNavigationMenuItem({
  universalIdentifier:
    COMMERCIAL_PROPOSAL_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  type: NavigationMenuItemType.OBJECT,
  name: 'Commercial Proposals',
  icon: 'IconFileDescription',
  position: 30,
  targetObjectUniversalIdentifier:
    COMMERCIAL_PROPOSAL_OBJECT_UNIVERSAL_IDENTIFIER,
  viewUniversalIdentifier: COMMERCIAL_PROPOSAL_VIEW_ALL_UNIVERSAL_IDENTIFIER,
});
