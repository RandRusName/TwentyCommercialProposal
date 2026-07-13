import { defineLogicFunction, HTTPMethod } from 'twenty-sdk/define';
import { Response, type RoutePayload } from 'twenty-sdk/logic-function';

import { GENERATE_COMMERCIAL_PROPOSAL_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import {
  ApplicationError,
  generateCommercialProposalDocuments,
  normalizeGenerateCommercialProposalRequest,
  type GenerateCommercialProposalRequest,
} from 'src/domain/commercial-proposal';
import { HttpDocumentServiceClient } from 'src/services/document-service-client';
import { TwentyRecordRepository } from 'src/services/twenty-record-repository';

const HTTP_STATUS_BY_ERROR_CODE = {
  INVALID_INPUT: 400,
  UNSUPPORTED_SOURCE: 400,
  OPPORTUNITY_NOT_FOUND: 404,
  OPPORTUNITY_FORBIDDEN: 403,
  DUPLICATE_REQUEST: 409,
  COMMERCIAL_PROPOSAL_CREATE_FAILED: 500,
  COMMERCIAL_PROPOSAL_NOT_FOUND: 404,
  COMMERCIAL_PROPOSAL_FORBIDDEN: 403,
  COMMERCIAL_PROPOSAL_INVALID_STATUS: 409,
  DOCUMENT_SERVICE_UNAVAILABLE: 503,
  DOCUMENT_SERVICE_TIMEOUT: 504,
  DOCUMENT_GENERATION_FAILED: 500,
  INTERNAL_ERROR: 500,
} as const;

const json = (body: unknown, status = 200) =>
  new Response(body, {
    status,
    headers: {
      'content-type': 'application/json',
    },
  });

const handler = async (
  event: RoutePayload<GenerateCommercialProposalRequest>,
) => {
  try {
    const result = await generateCommercialProposalDocuments({
      input: normalizeGenerateCommercialProposalRequest(
        event.body ?? undefined,
      ),
      repository: new TwentyRecordRepository(),
      documentClient: new HttpDocumentServiceClient(),
    });

    return json({ status: 'success', ...result });
  } catch (error) {
    const applicationError =
      error instanceof ApplicationError
        ? error
        : new ApplicationError(
            'INTERNAL_ERROR',
            'Внутренняя ошибка приложения',
            error,
          );

    console.error('generate-commercial-proposal failed', {
      code: applicationError.code,
      cause:
        applicationError.cause instanceof Error
          ? applicationError.cause.message
          : undefined,
    });

    return json(
      {
        status: 'failed',
        error: {
          code: applicationError.code,
          message: applicationError.message,
        },
      },
      HTTP_STATUS_BY_ERROR_CODE[applicationError.code],
    );
  }
};

export default defineLogicFunction({
  universalIdentifier:
    GENERATE_COMMERCIAL_PROPOSAL_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'Generate Commercial Proposal Documents',
  description:
    'Calls the external document service and stores generated XLSM/PDF metadata',
  timeoutSeconds: 60,
  httpRouteTriggerSettings: {
    path: '/commercial-proposals/generate',
    httpMethod: HTTPMethod.POST,
    isAuthRequired: true,
  },
  handler,
});
