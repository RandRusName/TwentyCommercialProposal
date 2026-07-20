import { defineLogicFunction, HTTPMethod } from 'twenty-sdk/define';
import { type RoutePayload } from 'twenty-sdk/logic-function';

import { RECALCULATE_COMMERCIAL_PROPOSAL_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { ApplicationError } from 'src/domain/commercial-proposal';
import {
  normalizeRecalculateRequest,
  recalculateCommercialProposal,
  type RecalculateRequest,
} from 'src/domain/commercial-proposal-aggregate';
import {
  failure,
  json,
  toApplicationError,
} from 'src/logic-functions/http-response';

const handler = async (
  event: RoutePayload<Partial<RecalculateRequest>>,
) => {
  try {
    if (event.pathParameters.id === undefined || event.pathParameters.id === '') {
      throw new ApplicationError(
        'COMMERCIAL_PROPOSAL_VALIDATION_FAILED',
        'commercialProposal id path parameter is required',
      );
    }

    return json({
      status: 'success',
      ...recalculateCommercialProposal(
        normalizeRecalculateRequest(event.body ?? undefined),
      ),
    });
  } catch (error) {
    const applicationError = toApplicationError(error);

    console.error('recalculate-commercial-proposal failed', {
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
