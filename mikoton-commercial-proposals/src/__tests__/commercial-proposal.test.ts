import {
  ApplicationError,
  buildCommercialProposalNumber,
  createCommercialProposalDraft,
  normalizeCreateDraftRequest,
  SUPPORTED_LANGUAGE,
  SUPPORTED_TEMPLATE_CODE,
  type CommercialProposalDraft,
  type CommercialProposalRepository,
} from 'src/domain/commercial-proposal';
import {
  buildCreateDraftRequest,
  CREATE_IDEMPOTENCY_KEY_ERROR,
  createIdempotencyKey,
  formatAmount,
  getSafeErrorMessage,
  isCreateDraftDisabled,
} from 'src/front-components/create-commercial-proposal.helpers';
import { buildAppRouteUrl } from 'src/front-components/utils/call-app-route';
import {
  normalizeOpportunityAmount,
  normalizeOpportunityCurrency,
} from 'src/services/twenty-record-repository';
import { afterEach, describe, expect, it, vi } from 'vitest';

const fixedDate = new Date('2026-07-12T10:11:12.000Z');
const idempotencyKey = '123e4567-e89b-12d3-a456-426614174000';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const makeDraft = (
  overrides: Partial<CommercialProposalDraft> = {},
): CommercialProposalDraft => ({
  id: 'draft-id',
  title: 'CP-20260712-101112-A7K2 - Test opportunity',
  number: 'CP-20260712-101112-A7K2',
  status: 'DRAFT',
  sourceType: 'OPPORTUNITY',
  templateCode: SUPPORTED_TEMPLATE_CODE,
  templateVersion: null,
  language: SUPPORTED_LANGUAGE,
  payloadSnapshot: null,
  resultMetadata: null,
  opportunityId: 'opportunity-id',
  companyId: 'company-id',
  amount: 123.45,
  currencyCode: 'RUB',
  generatedAt: null,
  idempotencyKey,
  lastError: null,
  ...overrides,
});

const makeRepository = (
  existingDraft: CommercialProposalDraft | null = null,
): CommercialProposalRepository => ({
  getOpportunityContext: vi.fn(async () => ({
    id: 'opportunity-id',
    name: 'Test opportunity',
    company: {
      id: 'company-id',
      name: 'Test company',
    },
    amount: 123.45,
    currencyCode: 'RUB',
  })),
  findDraftByIdempotencyKey: vi.fn(async () => existingDraft),
  createDraft: vi.fn(async (draft) => ({
    id: 'draft-id',
    ...draft,
  })),
  isDuplicateConflict: vi.fn(() => false),
});

const makeInput = () =>
  normalizeCreateDraftRequest({
    source: {
      object: 'opportunity',
      recordId: 'opportunity-id',
    },
    templateCode: SUPPORTED_TEMPLATE_CODE,
    language: SUPPORTED_LANGUAGE,
    idempotencyKey,
  });

describe('commercial proposal domain', () => {
  it('builds a proposal number with UTC time and a four-character suffix', () => {
    expect(buildCommercialProposalNumber(fixedDate, 'A7K2')).toBe(
      'CP-20260712-101112-A7K2',
    );
  });

  it('normalizes the new HTTP contract', () => {
    expect(makeInput()).toEqual({
      source: {
        object: 'opportunity',
        recordId: 'opportunity-id',
      },
      templateCode: SUPPORTED_TEMPLATE_CODE,
      language: SUPPORTED_LANGUAGE,
      idempotencyKey,
    });
  });

  it('rejects unsupported source objects with structured errors', () => {
    expect(() =>
      normalizeCreateDraftRequest({
        source: {
          object: 'company',
          recordId: 'company-id',
        },
        templateCode: SUPPORTED_TEMPLATE_CODE,
        language: SUPPORTED_LANGUAGE,
        idempotencyKey,
      }),
    ).toThrow(ApplicationError);
  });

  it('rejects invalid idempotency keys with structured errors', () => {
    expect(() =>
      normalizeCreateDraftRequest({
        source: {
          object: 'opportunity',
          recordId: 'opportunity-id',
        },
        templateCode: SUPPORTED_TEMPLATE_CODE,
        language: SUPPORTED_LANGUAGE,
        idempotencyKey: 'not-a-uuid',
      }),
    ).toThrow(ApplicationError);
  });

  it('creates a draft from opportunity context with generatedAt set to null', async () => {
    const repository = makeRepository();

    const result = await createCommercialProposalDraft({
      input: makeInput(),
      repository,
      now: fixedDate,
    });

    expect(result.created).toBe(true);
    expect(result.draft).toMatchObject({
      id: 'draft-id',
      status: 'DRAFT',
      sourceType: 'OPPORTUNITY',
      templateCode: SUPPORTED_TEMPLATE_CODE,
      templateVersion: null,
      language: SUPPORTED_LANGUAGE,
      opportunityId: 'opportunity-id',
      companyId: 'company-id',
      amount: 123.45,
      currencyCode: 'RUB',
      generatedAt: null,
      idempotencyKey,
      lastError: null,
    });
    expect(result.draft.number).toMatch(
      /^CP-20260712-101112-[0-9A-HJ-NP-Z]{4}$/,
    );
    expect(result.draft.payloadSnapshot).toEqual(makeInput());
  });

  it('does not invent a currency when the opportunity has none', async () => {
    const repository = makeRepository();
    vi.mocked(repository.getOpportunityContext).mockResolvedValueOnce({
      id: 'opportunity-id',
      name: 'Test opportunity',
      company: null,
      amount: 0,
      currencyCode: null,
    });

    const result = await createCommercialProposalDraft({
      input: makeInput(),
      repository,
      now: fixedDate,
    });

    expect(result.draft).toMatchObject({
      companyId: null,
      amount: 0,
      currencyCode: null,
    });
  });

  it('wraps create failures without leaking raw internal errors', async () => {
    const repository = makeRepository();
    vi.mocked(repository.createDraft).mockRejectedValueOnce(
      new Error('GraphQL secret token failure'),
    );

    await expect(
      createCommercialProposalDraft({
        input: makeInput(),
        repository,
        now: fixedDate,
      }),
    ).rejects.toMatchObject({
      code: 'COMMERCIAL_PROPOSAL_CREATE_FAILED',
      message: 'Не удалось создать черновик коммерческого предложения',
    });
  });

  it('returns an existing draft for the same idempotency key', async () => {
    const existingDraft = makeDraft({ id: 'existing-draft-id' });
    const repository = makeRepository(existingDraft);

    const result = await createCommercialProposalDraft({
      input: makeInput(),
      repository,
      now: fixedDate,
    });

    expect(result).toEqual({
      draft: existingDraft,
      created: false,
    });
    expect(repository.createDraft).not.toHaveBeenCalled();
  });

  it('reads and returns an existing draft after a duplicate conflict', async () => {
    const existingDraft = makeDraft({ id: 'existing-after-conflict' });
    const duplicateError = new Error('duplicate key violates unique constraint');
    const repository = makeRepository(null);

    vi.mocked(repository.createDraft).mockRejectedValueOnce(duplicateError);
    vi.mocked(repository.findDraftByIdempotencyKey)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existingDraft);
    vi.mocked(repository.isDuplicateConflict ?? vi.fn()).mockReturnValue(true);

    const result = await createCommercialProposalDraft({
      input: makeInput(),
      repository,
      now: fixedDate,
    });

    expect(result).toEqual({
      draft: existingDraft,
      created: false,
    });
  });

  it('handles two parallel requests after a duplicate conflict is visible', async () => {
    const createdDraft = makeDraft({ id: 'created-by-first-request' });
    const duplicateError = new Error('duplicate idempotency key');
    const repository = makeRepository(null);
    let createCalls = 0;

    vi.mocked(repository.findDraftByIdempotencyKey)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(createdDraft);
    vi.mocked(repository.createDraft).mockImplementation(async (draft) => {
      createCalls += 1;

      if (createCalls === 1) {
        return {
          ...createdDraft,
          ...draft,
          id: createdDraft.id,
        };
      }

      throw duplicateError;
    });
    vi.mocked(repository.isDuplicateConflict ?? vi.fn()).mockReturnValue(true);

    const [first, second] = await Promise.all([
      createCommercialProposalDraft({
        input: makeInput(),
        repository,
        now: fixedDate,
      }),
      createCommercialProposalDraft({
        input: makeInput(),
        repository,
        now: fixedDate,
      }),
    ]);

    expect(first.created).toBe(true);
    expect(second).toEqual({
      draft: createdDraft,
      created: false,
    });
  });

  it('retries number generation when a unique conflict has no existing key', async () => {
    const duplicateError = new Error('unique constraint on number');
    const repository = makeRepository(null);

    vi.mocked(repository.createDraft)
      .mockRejectedValueOnce(duplicateError)
      .mockImplementationOnce(async (draft) => ({
        id: 'draft-after-retry',
        ...draft,
      }));
    vi.mocked(repository.findDraftByIdempotencyKey).mockResolvedValue(null);
    vi.mocked(repository.isDuplicateConflict ?? vi.fn()).mockReturnValue(true);

    const result = await createCommercialProposalDraft({
      input: makeInput(),
      repository,
      now: fixedDate,
    });

    expect(result.created).toBe(true);
    expect(result.draft.id).toBe('draft-after-retry');
    expect(repository.createDraft).toHaveBeenCalledTimes(2);
  });
});

describe('opportunity amount normalization', () => {
  it('normalizes decimal values', () => {
    expect(normalizeOpportunityAmount(123.45)).toBe(123.45);
    expect(normalizeOpportunityAmount('123.45')).toBe(123.45);
  });

  it('normalizes Twenty currency micros without scale drift', () => {
    const amount = {
      amountMicros: 123_450_000,
      currencyCode: 'RUB',
    };

    expect(normalizeOpportunityAmount(amount)).toBe(123.45);
    expect(normalizeOpportunityCurrency(amount)).toBe('RUB');
  });

  it('normalizes string micros and preserves missing currency as null', () => {
    expect(
      normalizeOpportunityAmount({
        amountMicros: '125000000000',
        currencyCode: null,
      }),
    ).toBe(125000);
    expect(
      normalizeOpportunityCurrency({
        amountMicros: '125000000000',
        currencyCode: null,
      }),
    ).toBeNull();
  });

  it('keeps zero amounts and invalid micros explicit', () => {
    expect(normalizeOpportunityAmount({ amountMicros: 0 })).toBe(0);
    expect(normalizeOpportunityAmount({ amountMicros: 'not-a-number' })).toBeNull();
  });
});

describe('commercial proposal front component helpers', () => {
  it('creates a backend-compatible UUID idempotency key', () => {
    const key = createIdempotencyKey();

    expect(key).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(() =>
      normalizeCreateDraftRequest({
        source: {
          object: 'opportunity',
          recordId: 'opportunity-id',
        },
        templateCode: SUPPORTED_TEMPLATE_CODE,
        language: SUPPORTED_LANGUAGE,
        idempotencyKey: key,
      }),
    ).not.toThrow();
  });

  it('returns a readable error when secure UUID generation is unavailable', () => {
    vi.stubGlobal('crypto', {});

    expect(() => createIdempotencyKey()).toThrow(CREATE_IDEMPOTENCY_KEY_ERROR);
  });

  it('reuses one stable idempotency key for one operation and retry', () => {
    const stableKey = '123e4567-e89b-12d3-a456-426614174000';
    const firstRequest = buildCreateDraftRequest({
      opportunityId: 'opportunity-id',
      idempotencyKey: stableKey,
    });
    const retryRequest = buildCreateDraftRequest({
      opportunityId: 'opportunity-id',
      idempotencyKey: stableKey,
    });

    expect(firstRequest.idempotencyKey).toBe(stableKey);
    expect(retryRequest.idempotencyKey).toBe(stableKey);
    expect(retryRequest).toEqual(firstRequest);
  });

  it('formats amounts for null, zero, decimals and currencies', () => {
    expect(formatAmount(null, 'RUB')).toBe('Сумма не указана');
    expect(formatAmount(0, 'RUB')).toBe('0 RUB');
    expect(formatAmount(123.45, 'RUB')).toBe('123,45 RUB');
    expect(formatAmount(123.45, 'USD')).toBe('123,45 USD');
    expect(formatAmount(123.45, null)).toBe('123,45');
  });

  it('disables create while loading, submitting, after success or without key', () => {
    const base = {
      isCreating: false,
      isLoadingContext: false,
      hasOpportunity: true,
      hasDraft: false,
      hasIdempotencyKey: true,
    };

    expect(isCreateDraftDisabled(base)).toBe(false);
    expect(isCreateDraftDisabled({ ...base, isLoadingContext: true })).toBe(true);
    expect(isCreateDraftDisabled({ ...base, isCreating: true })).toBe(true);
    expect(isCreateDraftDisabled({ ...base, hasDraft: true })).toBe(true);
    expect(isCreateDraftDisabled({ ...base, hasIdempotencyKey: false })).toBe(
      true,
    );
  });

  it('does not surface unsafe internal error details', () => {
    expect(
      getSafeErrorMessage(
        new Error('GraphQL token failure\n    at sdk.call'),
        'Безопасная ошибка',
      ),
    ).toBe('Безопасная ошибка');
    expect(getSafeErrorMessage(new Error('Сделка не найдена'), 'fallback')).toBe(
      'Сделка не найдена',
    );
  });

  it('builds absolute app route URLs for worker execution', () => {
    vi.stubGlobal('location', {
      origin: 'http://twenty.example.test',
    });

    expect(buildAppRouteUrl('/commercial-proposals/drafts')).toBe(
      'http://twenty.example.test/s/commercial-proposals/drafts',
    );
  });
});
