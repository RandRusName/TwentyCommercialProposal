import { defineLogicFunction, HTTPMethod } from 'twenty-sdk/define';
import { Response, type RoutePayload } from 'twenty-sdk/logic-function';

import { GET_OPPORTUNITY_CONTEXT_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { ApplicationError } from 'src/domain/commercial-proposal';
import { TwentyRecordRepository } from 'src/services/twenty-record-repository';

type OpportunityContextRequest = {
  opportunityId?: string;
};

const HTTP_STATUS_BY_ERROR_CODE = {
  INVALID_INPUT: 400,
  UNSUPPORTED_SOURCE: 400,
  OPPORTUNITY_NOT_FOUND: 404,
  OPPORTUNITY_FORBIDDEN: 403,
  DUPLICATE_REQUEST: 409,
  COMMERCIAL_PROPOSAL_CREATE_FAILED: 500,
  INTERNAL_ERROR: 500,
} as const;

const json = (body: unknown, status = 200) =>
  new Response(body, {
    status,
    headers: {
      'content-type': 'application/json',
    },
  });

const handler = async (event: RoutePayload<OpportunityContextRequest>) => {
  try {
    const opportunityId = event.body?.opportunityId;

    if (!opportunityId) {
      throw new ApplicationError('INVALID_INPUT', 'opportunityId is required');
    }

    const repository = new TwentyRecordRepository();
    const opportunity = await repository.getOpportunityContext(opportunityId);

    return json({ status: 'success', opportunity });
  } catch (error) {
    const applicationError =
      error instanceof ApplicationError
        ? error
        : new ApplicationError(
            'INTERNAL_ERROR',
            'Внутренняя ошибка приложения',
            error,
          );

    console.error('get-opportunity-context failed', {
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
  universalIdentifier: GET_OPPORTUNITY_CONTEXT_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'Get Opportunity Context',
  description: 'Returns source opportunity and company context for CP creation',
  timeoutSeconds: 10,
  httpRouteTriggerSettings: {
    path: '/commercial-proposals/opportunity-context',
    httpMethod: HTTPMethod.POST,
    isAuthRequired: true,
  },
  handler,
});
