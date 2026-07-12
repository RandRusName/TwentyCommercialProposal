import { defineLogicFunction, HTTPMethod } from 'twenty-sdk/define';
import { Response, type RoutePayload } from 'twenty-sdk/logic-function';

import { CREATE_COMMERCIAL_PROPOSAL_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import {
  createCommercialProposalDraft,
  type CreateDraftInput,
} from 'src/domain/commercial-proposal';
import { TwentyRecordRepository } from 'src/services/twenty-record-repository';

const json = (body: unknown, status = 200) =>
  new Response(body, {
    status,
    headers: {
      'content-type': 'application/json',
    },
  });

const handler = async (event: RoutePayload<Partial<CreateDraftInput>>) => {
  try {
    const repository = new TwentyRecordRepository();
    const result = await createCommercialProposalDraft({
      input: {
        opportunityId: event.body?.opportunityId ?? '',
        idempotencyKey: event.body?.idempotencyKey ?? '',
      },
      repository,
    });

    return json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.endsWith('is required') ? 400 : 500;

    return json({ error: message }, status);
  }
};

export default defineLogicFunction({
  universalIdentifier:
    CREATE_COMMERCIAL_PROPOSAL_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'Create Commercial Proposal Draft',
  description:
    'Creates an authenticated CommercialProposal draft linked to Opportunity and Company',
  timeoutSeconds: 10,
  httpRouteTriggerSettings: {
    path: '/commercial-proposals/drafts',
    httpMethod: HTTPMethod.POST,
    isAuthRequired: true,
  },
  handler,
});
