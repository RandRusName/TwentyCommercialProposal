import { defineLogicFunction, HTTPMethod } from 'twenty-sdk/define';
import { Response, type RoutePayload } from 'twenty-sdk/logic-function';

import { GET_OPPORTUNITY_CONTEXT_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
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
      return json({ error: 'opportunityId is required' }, 400);
    }

    const repository = new TwentyRecordRepository();
    const opportunity = await repository.getOpportunityContext(opportunityId);

    return json({ opportunity });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      500,
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
