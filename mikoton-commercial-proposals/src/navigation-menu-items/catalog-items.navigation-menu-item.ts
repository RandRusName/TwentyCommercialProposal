import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';

import {
  CATALOG_ITEM_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  CATALOG_ITEM_OBJECT_UNIVERSAL_IDENTIFIER,
  CATALOG_ITEM_VIEW_ALL_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineNavigationMenuItem({
  universalIdentifier: CATALOG_ITEM_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  type: NavigationMenuItemType.OBJECT,
  name: 'Каталог работ и услуг',
  icon: 'IconLibrary',
  position: 31,
  targetObjectUniversalIdentifier: CATALOG_ITEM_OBJECT_UNIVERSAL_IDENTIFIER,
  viewUniversalIdentifier: CATALOG_ITEM_VIEW_ALL_UNIVERSAL_IDENTIFIER,
});
