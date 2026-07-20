import { defineLogicFunction, HTTPMethod } from 'twenty-sdk/define';
import { type RoutePayload } from 'twenty-sdk/logic-function';

import { EDITOR_CONTEXT_COMMERCIAL_PROPOSAL_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { ApplicationError } from 'src/domain/commercial-proposal';
import { buildEditorContext } from 'src/domain/commercial-proposal-aggregate';
import {
  failure,
  json,
  toApplicationError,
} from 'src/logic-functions/http-response';
import { TwentyRecordRepository } from 'src/services/twenty-record-repository';

const handler = async (event: RoutePayload) => {
  try {
    const commercialProposalId = event.pathParameters.id;

    if (commercialProposalId === undefined || commercialProposalId === '') {
      throw new ApplicationError(
        'COMMERCIAL_PROPOSAL_VALIDATION_FAILED',
        'commercialProposal id path parameter is required',
      );
    }

    const repository = new TwentyRecordRepository();
    const aggregate =
      await repository.getCommercialProposalAggregate(commercialProposalId);

    return json({ status: 'success', ...buildEditorContext(aggregate) });
  } catch (error) {
    const applicationError = toApplicationError(error);

    console.error('editor-context-commercial-proposal failed', {
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
    EDITOR_CONTEXT_COMMERCIAL_PROPOSAL_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'Commercial Proposal Editor Context',
  description: 'Returns canonical CommercialProposal aggregate editor context',
  timeoutSeconds: 10,
  httpRouteTriggerSettings: {
    path: '/commercial-proposals/:id/editor-context',
    httpMethod: HTTPMethod.POST,
    isAuthRequired: true,
  },
  handler,
});
