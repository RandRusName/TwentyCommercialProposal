type SafeLogFields = Record<
  string,
  string | number | boolean | null | undefined
>;

const redactTechnicalMessage = (message: string) =>
  message
    .replace(/(bearer\s+)[^\s,;]+/gi, '$1[REDACTED]')
    .replace(
      /((?:api[-_]?key|access[-_]?token|refresh[-_]?token|secret)\s*[=:]\s*)[^\s,;]+/gi,
      '$1[REDACTED]',
    )
    .slice(0, 500);

export const summarizeInternalError = (error: unknown): SafeLogFields => {
  if (!(error instanceof Error)) {
    return { internalErrorType: typeof error };
  }

  return {
    internalErrorType: error.name || 'Error',
    internalErrorMessage: redactTechnicalMessage(error.message),
  };
};

export const createLogicFunctionLogger = (
  route: string,
  initialFields: SafeLogFields = {},
) => {
  const requestId = globalThis.crypto.randomUUID();
  const startedAt = Date.now();
  const write = (
    level: 'info' | 'error',
    result: 'success' | 'failed',
    fields: SafeLogFields,
  ) => {
    console[level](JSON.stringify({
      event: 'commercial-proposal-app-route',
      requestId,
      route,
      result,
      durationMs: Date.now() - startedAt,
      ...initialFields,
      ...fields,
    }));
  };

  return {
    requestId,
    success: (fields: SafeLogFields = {}) => write('info', 'success', fields),
    failure: (errorCode: string, fields: SafeLogFields = {}) =>
      write('error', 'failed', { errorCode, ...fields }),
  };
};
