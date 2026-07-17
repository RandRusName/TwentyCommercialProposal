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

const DEFAULT_DOCUMENT_SERVICE_TIMEOUT_MS = 60_000;
const RETRYABLE_STATUSES = new Set([500, 502, 503, 504]);

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

const getTimeoutMs = () => {
  const rawValue = process.env.DOCUMENT_SERVICE_TIMEOUT_MS;

  if (rawValue === undefined || rawValue.trim() === '') {
    return DEFAULT_DOCUMENT_SERVICE_TIMEOUT_MS;
  }

  const value = Number(rawValue);

  return Number.isFinite(value) && value > 0
    ? value
    : DEFAULT_DOCUMENT_SERVICE_TIMEOUT_MS;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isGenerationFile = (value: unknown) =>
  isObject(value) &&
  (value.format === 'xlsx' || value.format === 'pdf') &&
  typeof value.fileName === 'string' &&
  typeof value.contentType === 'string' &&
  typeof value.size === 'number' &&
  typeof value.sha256 === 'string' &&
  typeof value.downloadUrl === 'string';

const isSuccessResponse = (
  value: unknown,
): value is DocumentServiceSuccessResponse =>
  isObject(value) &&
  value.status === 'success' &&
  typeof value.generationId === 'string' &&
  value.templateCode === 'mikoton-commercial-proposal' &&
  value.templateVersion === '1' &&
  typeof value.generatedAt === 'string' &&
  Array.isArray(value.files) &&
  value.files.every(isGenerationFile);

const mapServiceErrorCode = (
  responseStatus: number,
  serviceCode: string | undefined,
) => {
  if (responseStatus === 401 || responseStatus === 403) {
    return 'DOCUMENT_SERVICE_FORBIDDEN' as const;
  }

  if (serviceCode === 'DOCUMENT_STORAGE_FAILED') {
    return 'DOCUMENT_STORAGE_FAILED' as const;
  }

  if (serviceCode === 'PDF_EXPORT_FAILED') {
    return 'PDF_EXPORT_FAILED' as const;
  }

  if (serviceCode === 'PAYLOAD_INVALID' || serviceCode === 'TEMPLATE_INVALID') {
    return 'DOCUMENT_GENERATION_FAILED' as const;
  }

  return 'DOCUMENT_GENERATION_FAILED' as const;
};

const parseJsonResponse = (responseText: string) => {
  if (responseText.trim() === '') {
    return null;
  }

  try {
    return JSON.parse(responseText) as unknown;
  } catch (error) {
    throw new ApplicationError(
      'DOCUMENT_SERVICE_INVALID_RESPONSE',
      'Document service returned a non-JSON response',
      error,
    );
  }
};

export class HttpDocumentServiceClient implements DocumentGenerationClient {
  constructor(
    private readonly baseUrl = getRequiredEnvironmentValue(
      'DOCUMENT_SERVICE_URL',
    ),
    private readonly secret = getRequiredEnvironmentValue(
      'DOCUMENT_SERVICE_SECRET',
    ),
    private readonly timeoutMs = getTimeoutMs(),
  ) {}

  async generate(request: {
    requestId: string;
    idempotencyKey: string;
    payload: DocumentGenerationPayload;
    requestedFormats: Array<'xlsx' | 'pdf'>;
  }) {
    let lastError: unknown;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await this.tryGenerate(request);
      } catch (error) {
        lastError = error;

        if (
          error instanceof ApplicationError &&
          (error.code === 'DOCUMENT_SERVICE_UNAVAILABLE' ||
            error.code === 'DOCUMENT_SERVICE_TIMEOUT')
        ) {
          continue;
        }

        throw error;
      }
    }

    throw lastError;
  }

  private async tryGenerate(request: {
    requestId: string;
    idempotencyKey: string;
    payload: DocumentGenerationPayload;
    requestedFormats: Array<'xlsx' | 'pdf'>;
  }) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(
        `${this.baseUrl.replace(/\/$/, '')}/v1/commercial-proposals/generate`,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${this.secret}`,
            'content-type': 'application/json',
            accept: 'application/json',
          },
          body: JSON.stringify(request),
          signal: controller.signal,
        },
      );
      const responseText = await response.text();
      const contentType = response.headers.get('content-type') ?? '';

      if (!contentType.includes('application/json')) {
        throw new ApplicationError(
          'DOCUMENT_SERVICE_INVALID_RESPONSE',
          'Document service returned an unexpected content type',
        );
      }

      const responseBody = parseJsonResponse(responseText);

      if (!response.ok) {
        const failure = isObject(responseBody)
          ? (responseBody as DocumentServiceFailureResponse)
          : null;
        const errorCode = mapServiceErrorCode(
          response.status,
          failure?.error?.code,
        );

        if (RETRYABLE_STATUSES.has(response.status)) {
          throw new ApplicationError(
            'DOCUMENT_SERVICE_UNAVAILABLE',
            failure?.error?.message ??
              `Document service failed with HTTP ${response.status}`,
          );
        }

        throw new ApplicationError(
          errorCode,
          failure?.error?.message ??
            `Document service failed with HTTP ${response.status}`,
        );
      }

      if (!isSuccessResponse(responseBody)) {
        throw new ApplicationError(
          'DOCUMENT_SERVICE_INVALID_RESPONSE',
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
