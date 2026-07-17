import { defineApplication, FieldType } from 'twenty-sdk/define';

import {
  APP_DESCRIPTION,
  APP_DISPLAY_NAME,
  APPLICATION_UNIVERSAL_IDENTIFIER,
  DOCUMENT_SERVICE_SECRET_APPLICATION_VARIABLE_UNIVERSAL_IDENTIFIER,
  DOCUMENT_SERVICE_URL_APPLICATION_VARIABLE_UNIVERSAL_IDENTIFIER,
  TWENTY_FILE_UPLOAD_API_KEY_APPLICATION_VARIABLE_UNIVERSAL_IDENTIFIER,
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
    DOCUMENT_SERVICE_URL: {
      universalIdentifier:
        DOCUMENT_SERVICE_URL_APPLICATION_VARIABLE_UNIVERSAL_IDENTIFIER,
      description:
        'Server-side document-service base URL used by generation logic functions.',
      isSecret: false,
      type: FieldType.TEXT,
      value: 'http://document-service:8010',
    },
    DOCUMENT_SERVICE_SECRET: {
      universalIdentifier:
        DOCUMENT_SERVICE_SECRET_APPLICATION_VARIABLE_UNIVERSAL_IDENTIFIER,
      description:
        'Server-side bearer secret used to authenticate document-service calls.',
      isSecret: true,
      type: FieldType.TEXT,
    },
    TWENTY_FILE_UPLOAD_API_KEY: {
      universalIdentifier:
        TWENTY_FILE_UPLOAD_API_KEY_APPLICATION_VARIABLE_UNIVERSAL_IDENTIFIER,
      description:
        'Server-side Twenty API key used only to attach generated XLSX/PDF files to CommercialProposal records.',
      isSecret: true,
      type: FieldType.TEXT,
    },
  },
});
