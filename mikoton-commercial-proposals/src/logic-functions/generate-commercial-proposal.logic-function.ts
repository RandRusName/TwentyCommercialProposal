import { defineLogicFunction, HTTPMethod } from 'twenty-sdk/define';
import { type RoutePayload } from 'twenty-sdk/logic-function';

import { GENERATE_COMMERCIAL_PROPOSAL_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import {
  generateCommercialProposalDocuments,
  normalizeGenerateCommercialProposalRequest,
  type GenerateCommercialProposalRequest,
} from 'src/domain/commercial-proposal';
import {
  failure,
  json,
  toApplicationError,
} from 'src/logic-functions/http-response';
import { HttpDocumentServiceClient } from 'src/services/document-service-client';
import { TwentyRecordRepository } from 'src/services/twenty-record-repository';

const handler = async (
  event: RoutePayload<GenerateCommercialProposalRequest>,
) => {
  try {
    const result = await generateCommercialProposalDocuments({
      input: normalizeGenerateCommercialProposalRequest(
        event.body ?? undefined,
      ),
      repository: new TwentyRecordRepository(),
      documentClient: new HttpDocumentServiceClient(),
    });

    return json({ status: 'success', ...result });
  } catch (error) {
    const applicationError = toApplicationError(error);

    console.error('generate-commercial-proposal failed', {
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
    GENERATE_COMMERCIAL_PROPOSAL_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'Generate Commercial Proposal Documents',
  description:
    'Calls the external document service and stores generated XLSX/PDF metadata',
  timeoutSeconds: 60,
  httpRouteTriggerSettings: {
    path: '/commercial-proposals/generate',
    httpMethod: HTTPMethod.POST,
    isAuthRequired: true,
  },
  handler,
});
