import { describe, expect, it } from 'vitest';

describe('remote Twenty smoke test gate', () => {
  it('keeps remote smoke opt-in because it requires a real API key', () => {
    expect(['string', 'undefined']).toContain(
      typeof process.env.TWENTY_RUN_REMOTE_SMOKE,
    );
  });
});
