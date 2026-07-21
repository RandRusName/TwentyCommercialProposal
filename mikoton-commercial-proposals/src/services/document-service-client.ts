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

const SHA256_REGEX = /^[0-9a-f]{64}$/;
const GENERATION_ID_REGEX = /^(?:[0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;
const CONTENT_TYPE_BY_FORMAT = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
} as const;

const isHttpUrl = (value: unknown) => {
  if (typeof value !== 'string' || value.trim() === '') return false;
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};

export const validateDocumentServiceSuccessResponse = ({
  value,
  payload,
  requestedFormats,
}: {
  value: unknown;
  payload: DocumentGenerationPayload;
  requestedFormats: Array<'xlsx' | 'pdf'>;
}): DocumentServiceSuccessResponse => {
  if (
    !isObject(value) ||
    value.status !== 'success' ||
    typeof value.generationId !== 'string' ||
    !GENERATION_ID_REGEX.test(value.generationId) ||
    value.templateCode !== 'mikoton-commercial-proposal' ||
    value.templateVersion !== payload.templateVersion ||
    typeof value.generatedAt !== 'string' ||
    Number.isNaN(Date.parse(value.generatedAt)) ||
    !Array.isArray(value.files)
  ) {
    throw new ApplicationError('DOCUMENT_SERVICE_INVALID_RESPONSE', 'Document service returned an invalid response');
  }

  if (payload.schemaVersion === '2.0') {
    if (
      value.schemaVersion !== '2.0' ||
      typeof value.snapshotHash !== 'string' ||
      !SHA256_REGEX.test(value.snapshotHash)
    ) {
      throw new ApplicationError('DOCUMENT_SERVICE_INVALID_RESPONSE', 'Document service returned invalid v2 schema metadata');
    }
  } else if (
    value.schemaVersion !== undefined &&
    value.schemaVersion !== '1.0'
  ) {
    throw new ApplicationError('DOCUMENT_SERVICE_INVALID_RESPONSE', 'Document service returned invalid v1 schema metadata');
  }

  const formats = value.files.map((file) => isObject(file) ? file.format : undefined);
  if (
    value.files.length !== requestedFormats.length ||
    new Set(formats).size !== formats.length ||
    requestedFormats.some((format) => !formats.includes(format))
  ) {
    throw new ApplicationError('DOCUMENT_SERVICE_INVALID_RESPONSE', 'Document service returned an unexpected file set');
  }

  for (const file of value.files) {
    if (!isObject(file) || (file.format !== 'xlsx' && file.format !== 'pdf')) {
      throw new ApplicationError('DOCUMENT_SERVICE_INVALID_RESPONSE', 'Document service returned invalid file metadata');
    }
    const hashValid = payload.schemaVersion === '1.0'
      ? file.sha256 === undefined || (typeof file.sha256 === 'string' && SHA256_REGEX.test(file.sha256))
      : typeof file.sha256 === 'string' && SHA256_REGEX.test(file.sha256);
    if (
      typeof file.fileName !== 'string' || file.fileName.trim() === '' ||
      file.contentType !== CONTENT_TYPE_BY_FORMAT[file.format] ||
      typeof file.size !== 'number' || !Number.isInteger(file.size) || file.size <= 0 ||
      !hashValid ||
      typeof file.storageKey !== 'string' || file.storageKey.trim() === '' ||
      !isHttpUrl(file.downloadUrl) ||
      (file.downloadUrlExpiresAt !== undefined &&
        (typeof file.downloadUrlExpiresAt !== 'string' || Number.isNaN(Date.parse(file.downloadUrlExpiresAt))))
    ) {
      throw new ApplicationError('DOCUMENT_SERVICE_INVALID_RESPONSE', 'Document service returned invalid file metadata');
    }
  }

  return value as DocumentServiceSuccessResponse;
};

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

  if (serviceCode === 'DOCUMENT_SCHEMA_TEMPLATE_MISMATCH') {
    return 'DOCUMENT_SCHEMA_TEMPLATE_MISMATCH' as const;
  }

  if (serviceCode === 'SNAPSHOT_HASH_MISMATCH') {
    return 'SNAPSHOT_HASH_MISMATCH' as const;
  }

  if (serviceCode === 'GENERATION_IDEMPOTENCY_CONFLICT') {
    return 'GENERATION_IDEMPOTENCY_CONFLICT' as const;
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
    snapshotHash?: string;
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
    snapshotHash?: string;
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

      return validateDocumentServiceSuccessResponse({
        value: responseBody,
        payload: request.payload,
        requestedFormats: request.requestedFormats,
      });
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
