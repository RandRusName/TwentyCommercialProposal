import { defineApplication, FieldType } from 'twenty-sdk/define';

import {
  APP_DESCRIPTION,
  APP_DISPLAY_NAME,
  APPLICATION_UNIVERSAL_IDENTIFIER,
  TWENTY_API_URL_APPLICATION_VARIABLE_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineApplication({
  universalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
  displayName: APP_DISPLAY_NAME,
  description: APP_DESCRIPTION,
  applicationVariables: {
    TWENTY_API_URL: {
      universalIdentifier: TWENTY_API_URL_APPLICATION_VARIABLE_UNIVERSAL_IDENTIFIER,
      description: 'Base URL of the Twenty instance used by front components to call app routes.',
      isSecret: false,
      type: FieldType.TEXT,
      value: 'http://192.168.100.11:3000',
    },
  },
});
