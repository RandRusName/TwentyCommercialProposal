import { defineLogicFunction, HTTPMethod } from 'twenty-sdk/define';
import { type RoutePayload } from 'twenty-sdk/logic-function';

import { CREATE_COMMERCIAL_PROPOSAL_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import {
  createCommercialProposalDraft,
  normalizeCreateDraftRequest,
  type CreateDraftRequest,
} from 'src/domain/commercial-proposal';
import {
  failure,
  json,
  toApplicationError,
} from 'src/logic-functions/http-response';
import { TwentyRecordRepository } from 'src/services/twenty-record-repository';
import { createLogicFunctionLogger } from 'src/logic-functions/logic-function-logger';

const handler = async (
  event: RoutePayload<Partial<CreateDraftRequest>>,
) => {
  const logger = createLogicFunctionLogger('create-commercial-proposal-draft', {
    operationId: event.body?.idempotencyKey,
  });
  try {
    const repository = new TwentyRecordRepository();
    const result = await createCommercialProposalDraft({
      input: normalizeCreateDraftRequest(event.body ?? undefined),
      repository,
    });

    logger.success({ proposalId: result.draft.id, statusAfter: result.draft.status });
    return json({ status: 'success', ...result, requestId: logger.requestId });
  } catch (error) {
    const applicationError = toApplicationError(error);

    logger.failure(applicationError.code);

    return failure(applicationError);
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
