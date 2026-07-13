import { defineLogicFunction, HTTPMethod } from 'twenty-sdk/define';
import { Response, type RoutePayload } from 'twenty-sdk/logic-function';

import { GET_OPPORTUNITY_CONTEXT_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { ApplicationError } from 'src/domain/commercial-proposal';
import { TwentyRecordRepository } from 'src/services/twenty-record-repository';

type OpportunityContextRequest = {
  opportunityId?: string;
};

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
      return json(
        {
          status: 'failed',
          error: {
            code: 'INVALID_INPUT',
            message: 'opportunityId is required',
          },
        },
        400,
      );
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
      applicationError.code === 'OPPORTUNITY_FORBIDDEN' ? 403 : 404,
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
