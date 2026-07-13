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
  normalizeOpportunityAmount,
  normalizeOpportunityCurrency,
} from 'src/services/twenty-record-repository';
import { describe, expect, it, vi } from 'vitest';

const fixedDate = new Date('2026-07-12T10:11:12.000Z');
const idempotencyKey = '123e4567-e89b-12d3-a456-426614174000';

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
  currency: 'RUB',
  generatedAt: null,
  idempotencyKey,
  ...overrides,
});

const makeRepository = (
  existingDraft: CommercialProposalDraft | null = null,
): CommercialProposalRepository => ({
  getOpportunityContext: vi.fn(async () => ({
    id: 'opportunity-id',
    name: 'Test opportunity',
    companyId: 'company-id',
    companyName: 'Test company',
    amount: 123.45,
    currency: 'RUB',
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
      currency: 'RUB',
      generatedAt: null,
      idempotencyKey,
    });
    expect(result.draft.number).toMatch(
      /^CP-20260712-101112-[0-9A-HJ-NP-Z]{4}$/,
    );
    expect(result.draft.payloadSnapshot).toEqual(makeInput());
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
});
