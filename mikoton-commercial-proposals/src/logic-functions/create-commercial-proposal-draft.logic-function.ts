import { defineLogicFunction, HTTPMethod } from 'twenty-sdk/define';
import { Response, type RoutePayload } from 'twenty-sdk/logic-function';

import { CREATE_COMMERCIAL_PROPOSAL_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import {
  ApplicationError,
  createCommercialProposalDraft,
  normalizeCreateDraftRequest,
  type CreateDraftRequest,
  type DeprecatedCreateDraftRequest,
} from 'src/domain/commercial-proposal';
import { TwentyRecordRepository } from 'src/services/twenty-record-repository';

const HTTP_STATUS_BY_ERROR_CODE = {
  INVALID_INPUT: 400,
  UNSUPPORTED_SOURCE: 400,
  OPPORTUNITY_NOT_FOUND: 404,
  OPPORTUNITY_FORBIDDEN: 403,
  DUPLICATE_REQUEST: 409,
  COMMERCIAL_PROPOSAL_CREATE_FAILED: 500,
  INTERNAL_ERROR: 500,
} as const;

const json = (body: unknown, status = 200) =>
  new Response(body, {
    status,
    headers: {
      'content-type': 'application/json',
    },
  });

const failure = (error: ApplicationError) =>
  json(
    {
      status: 'failed',
      error: {
        code: error.code,
        message: error.message,
      },
    },
    HTTP_STATUS_BY_ERROR_CODE[error.code],
  );

const handler = async (
  event: RoutePayload<Partial<CreateDraftRequest & DeprecatedCreateDraftRequest>>,
) => {
  try {
    const repository = new TwentyRecordRepository();
    const result = await createCommercialProposalDraft({
      input: normalizeCreateDraftRequest(event.body ?? undefined),
      repository,
    });

    return json({ status: 'success', ...result });
  } catch (error) {
    const applicationError =
      error instanceof ApplicationError
        ? error
        : new ApplicationError(
            'INTERNAL_ERROR',
            'Внутренняя ошибка приложения',
            error,
          );

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
