type SafeLogFields = Record<
  string,
  string | number | boolean | null | undefined
>;

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
    console[level]('commercial-proposal app route', {
      requestId,
      route,
      result,
      durationMs: Date.now() - startedAt,
      ...initialFields,
      ...fields,
    });
  };

  return {
    requestId,
    success: (fields: SafeLogFields = {}) => write('info', 'success', fields),
    failure: (errorCode: string, fields: SafeLogFields = {}) =>
      write('error', 'failed', { errorCode, ...fields }),
  };
};
