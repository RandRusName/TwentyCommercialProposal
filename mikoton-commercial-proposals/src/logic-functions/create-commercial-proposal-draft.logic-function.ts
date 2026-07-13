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

const handler = async (
  event: RoutePayload<Partial<CreateDraftRequest>>,
) => {
  try {
    const repository = new TwentyRecordRepository();
    const result = await createCommercialProposalDraft({
      input: normalizeCreateDraftRequest(event.body ?? undefined),
      repository,
    });

    return json({ status: 'success', ...result });
  } catch (error) {
    const applicationError = toApplicationError(error);

    console.error('create-commercial-proposal-draft failed', {
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
