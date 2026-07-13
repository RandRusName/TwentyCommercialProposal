import type {
  DocumentGenerationClient,
  DocumentGenerationPayload,
  DocumentGenerationResult,
} from 'src/domain/commercial-proposal';
import { ApplicationError } from 'src/domain/commercial-proposal';

type DocumentServiceSuccessResponse = DocumentGenerationResult;

type DocumentServiceFailureResponse = {
  status: 'failed';
  error?: {
    code?: string;
    message?: string;
  };
};

const DOCUMENT_SERVICE_TIMEOUT_MS = 30_000;

const getRequiredEnvironmentValue = (name: string) => {
  const value = process.env[name];

  if (value === undefined || value.trim() === '') {
    throw new ApplicationError(
      'DOCUMENT_SERVICE_UNAVAILABLE',
      `${name} is not configured`,
    );
  }

  return value;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isSuccessResponse = (
  value: unknown,
): value is DocumentServiceSuccessResponse =>
  isObject(value) &&
  value.status === 'success' &&
  typeof value.generationId === 'string' &&
  Array.isArray(value.files);

export class HttpDocumentServiceClient implements DocumentGenerationClient {
  constructor(
    private readonly baseUrl = getRequiredEnvironmentValue(
      'DOCUMENT_SERVICE_URL',
    ),
    private readonly secret = getRequiredEnvironmentValue(
      'DOCUMENT_SERVICE_SECRET',
    ),
  ) {}

  async generate(request: {
    requestId: string;
    idempotencyKey: string;
    payload: DocumentGenerationPayload;
    requestedFormats: Array<'xlsm' | 'pdf'>;
  }) {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      DOCUMENT_SERVICE_TIMEOUT_MS,
    );

    try {
      const response = await fetch(
        `${this.baseUrl.replace(/\/$/, '')}/v1/commercial-proposals/generate`,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${this.secret}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify(request),
          signal: controller.signal,
        },
      );
      const responseText = await response.text();
      const responseBody =
        responseText.trim() === '' ? null : (JSON.parse(responseText) as unknown);

      if (!response.ok) {
        const failure = isObject(responseBody)
          ? (responseBody as DocumentServiceFailureResponse)
          : null;
        throw new ApplicationError(
          'DOCUMENT_GENERATION_FAILED',
          failure?.error?.message ??
            `Document service failed with HTTP ${response.status}`,
        );
      }

      if (!isSuccessResponse(responseBody)) {
        throw new ApplicationError(
          'DOCUMENT_GENERATION_FAILED',
          'Document service returned an invalid response',
        );
      }

      return responseBody;
    } catch (error) {
      if (error instanceof ApplicationError) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new ApplicationError(
          'DOCUMENT_SERVICE_TIMEOUT',
          'Document service request timed out',
          error,
        );
      }

      throw new ApplicationError(
        'DOCUMENT_SERVICE_UNAVAILABLE',
        'Document service is unavailable',
        error,
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
