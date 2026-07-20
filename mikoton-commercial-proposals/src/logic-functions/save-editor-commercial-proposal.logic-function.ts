import { defineLogicFunction, HTTPMethod } from 'twenty-sdk/define';
import { type RoutePayload } from 'twenty-sdk/logic-function';

import { SAVE_EDITOR_COMMERCIAL_PROPOSAL_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { ApplicationError } from 'src/domain/commercial-proposal';
import {
  normalizeSaveEditorRequest,
  saveCommercialProposalEditor,
  type SaveEditorRequest,
} from 'src/domain/commercial-proposal-aggregate';
import {
  failure,
  json,
  toApplicationError,
} from 'src/logic-functions/http-response';
import { TwentyRecordRepository } from 'src/services/twenty-record-repository';

const handler = async (
  event: RoutePayload<Partial<SaveEditorRequest>>,
) => {
  try {
    const commercialProposalId = event.pathParameters.id;

    if (commercialProposalId === undefined || commercialProposalId === '') {
      throw new ApplicationError(
        'COMMERCIAL_PROPOSAL_VALIDATION_FAILED',
        'commercialProposal id path parameter is required',
      );
    }

    const repository = new TwentyRecordRepository();
    const result = await saveCommercialProposalEditor({
      proposalId: commercialProposalId,
      request: normalizeSaveEditorRequest(event.body ?? undefined),
      repository,
    });

    return json({ status: 'success', ...result });
  } catch (error) {
    const applicationError = toApplicationError(error);

    console.error('save-editor-commercial-proposal failed', {
      proposalId: event.pathParameters.id,
      operationId: event.body?.operationId,
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
    SAVE_EDITOR_COMMERCIAL_PROPOSAL_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'Save Commercial Proposal Editor',
  description: 'Replay-safe aggregate save for CommercialProposal editor',
  timeoutSeconds: 20,
  httpRouteTriggerSettings: {
    path: '/commercial-proposals/:id/save-editor',
    httpMethod: HTTPMethod.POST,
    isAuthRequired: true,
  },
  handler,
});
