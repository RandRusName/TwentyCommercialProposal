import { defineLogicFunction, HTTPMethod } from 'twenty-sdk/define';
import { type RoutePayload } from 'twenty-sdk/logic-function';

import { GET_OPPORTUNITY_CONTEXT_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { ApplicationError } from 'src/domain/commercial-proposal';
import {
  failure,
  json,
  toApplicationError,
} from 'src/logic-functions/http-response';
import { TwentyRecordRepository } from 'src/services/twenty-record-repository';

type OpportunityContextRequest = {
  opportunityId?: string;
};

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
    const applicationError = toApplicationError(error);

    console.error('get-opportunity-context failed', {
      code: applicationError.code,
      cause:
        applicationError.cause instanceof Error
          ? applicationError.cause.message
          : undefined,
    });

    return failure(applicationError);
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
