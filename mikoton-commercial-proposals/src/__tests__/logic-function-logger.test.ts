import { describe, expect, it } from 'vitest';

import { summarizeInternalError } from 'src/logic-functions/logic-function-logger';

describe('logic function diagnostics', () => {
  it('redacts credentials from technical error messages', () => {
    const summary = summarizeInternalError(
      new Error(
        'request failed: Bearer token-value API_KEY=key-value secret:secret-value',
      ),
    );

    expect(summary).toEqual({
      internalErrorType: 'Error',
      internalErrorMessage:
        'request failed: Bearer [REDACTED] API_KEY=[REDACTED] secret:[REDACTED]',
    });
    expect(JSON.stringify(summary)).not.toContain('token-value');
    expect(JSON.stringify(summary)).not.toContain('key-value');
    expect(JSON.stringify(summary)).not.toContain('secret-value');
  });
});
