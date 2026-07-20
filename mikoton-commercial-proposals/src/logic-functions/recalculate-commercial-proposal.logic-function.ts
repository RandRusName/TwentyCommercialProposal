import { defineLogicFunction, HTTPMethod } from 'twenty-sdk/define';
import { type RoutePayload } from 'twenty-sdk/logic-function';

import { RECALCULATE_COMMERCIAL_PROPOSAL_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import {
  ensureCommercialProposalEditable,
  normalizeRecalculateRequest,
  recalculateCommercialProposal,
  type RecalculateRequest,
  validateCommercialProposalId,
} from 'src/domain/commercial-proposal-aggregate';
import {
  failure,
  json,
  toApplicationError,
} from 'src/logic-functions/http-response';
import { TwentyRecordRepository } from 'src/services/twenty-record-repository';

const handler = async (
  event: RoutePayload<Partial<RecalculateRequest>>,
) => {
  try {
    const commercialProposalId = validateCommercialProposalId(
      event.pathParameters.id,
    );
    const repository = new TwentyRecordRepository();
    const aggregate =
      await repository.getCommercialProposalAggregate(commercialProposalId);
    ensureCommercialProposalEditable(aggregate);

    return json({
      status: 'success',
      ...recalculateCommercialProposal(
        normalizeRecalculateRequest(event.body ?? undefined),
      ),
    });
  } catch (error) {
    const applicationError = toApplicationError(error);

    console.error('recalculate-commercial-proposal failed', {
      proposalId: event.pathParameters.id,
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
    RECALCULATE_COMMERCIAL_PROPOSAL_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'Recalculate Commercial Proposal Editor',
  description: 'Pure recalculation for unsaved CommercialProposal editor lines',
  timeoutSeconds: 10,
  httpRouteTriggerSettings: {
    path: '/commercial-proposals/:id/recalculate',
    httpMethod: HTTPMethod.POST,
    isAuthRequired: true,
  },
  handler,
});
