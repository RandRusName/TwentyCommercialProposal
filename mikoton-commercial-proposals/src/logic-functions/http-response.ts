import { Response } from 'twenty-sdk/logic-function';

import type { ApplicationErrorCode } from 'src/domain/commercial-proposal';
import { ApplicationError } from 'src/domain/commercial-proposal';

const HTTP_STATUS_BY_ERROR_CODE: Record<ApplicationErrorCode, number> = {
  INVALID_INPUT: 400,
  UNSUPPORTED_SOURCE: 400,
  OPPORTUNITY_NOT_FOUND: 404,
  OPPORTUNITY_FORBIDDEN: 403,
  DUPLICATE_REQUEST: 409,
  COMMERCIAL_PROPOSAL_CREATE_FAILED: 500,
  COMMERCIAL_PROPOSAL_NOT_FOUND: 404,
  COMMERCIAL_PROPOSAL_FORBIDDEN: 403,
  COMMERCIAL_PROPOSAL_INVALID_STATUS: 409,
  COMMERCIAL_PROPOSAL_NUMBER_LIMIT_REACHED: 409,
  COMMERCIAL_PROPOSAL_CHILD_FORBIDDEN: 403,
  COMMERCIAL_PROPOSAL_CHILD_NOT_FOUND: 404,
  COMMERCIAL_PROPOSAL_EDITOR_CONFLICT: 409,
  COMMERCIAL_PROPOSAL_VALIDATION_FAILED: 400,
  COMMERCIAL_PROPOSAL_SAVE_FAILED: 500,
  COMMERCIAL_PROPOSAL_GENERATION_MODEL_NOT_SUPPORTED: 422,
  DOCUMENT_SERVICE_UNAVAILABLE: 503,
  DOCUMENT_SERVICE_TIMEOUT: 504,
  DOCUMENT_SERVICE_FORBIDDEN: 502,
  DOCUMENT_SERVICE_INVALID_RESPONSE: 502,
  DOCUMENT_GENERATION_FAILED: 500,
  DOCUMENT_STORAGE_FAILED: 502,
  PDF_EXPORT_FAILED: 502,
  INTERNAL_ERROR: 500,
};

export const json = (body: unknown, status = 200) =>
  new Response(body, {
    status,
    headers: {
      'content-type': 'application/json',
    },
  });

export const toApplicationError = (
  error: unknown,
  fallbackMessage = 'Внутренняя ошибка приложения',
) =>
  error instanceof ApplicationError
    ? error
    : new ApplicationError('INTERNAL_ERROR', fallbackMessage, error);

export const failure = (error: ApplicationError) =>
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
