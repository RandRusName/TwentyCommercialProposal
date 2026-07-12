import {
  buildCommercialProposalNumber,
  createCommercialProposalDraft,
  type CommercialProposalDraft,
  type CommercialProposalRepository,
} from 'src/domain/commercial-proposal';
import { describe, expect, it, vi } from 'vitest';

const fixedDate = new Date('2026-07-12T10:11:12.000Z');

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
});

describe('commercial proposal domain', () => {
  it('builds a deterministic proposal number from UTC time', () => {
    expect(buildCommercialProposalNumber(fixedDate)).toBe(
      'CP-20260712-101112',
    );
  });

  it('creates a draft from opportunity context', async () => {
    const repository = makeRepository();

    const result = await createCommercialProposalDraft({
      input: {
        opportunityId: 'opportunity-id',
        idempotencyKey: 'request-key',
      },
      repository,
      now: fixedDate,
    });

    expect(result.created).toBe(true);
    expect(result.draft).toMatchObject({
      id: 'draft-id',
      title: 'CP-20260712-101112 - Test opportunity',
      number: 'CP-20260712-101112',
      status: 'DRAFT',
      opportunityId: 'opportunity-id',
      companyId: 'company-id',
      amount: 123.45,
      currency: 'RUB',
      generatedAt: fixedDate.toISOString(),
      idempotencyKey: 'request-key',
    });
  });

  it('returns an existing draft for the same idempotency key', async () => {
    const existingDraft: CommercialProposalDraft = {
      id: 'existing-draft-id',
      title: 'Existing',
      number: 'CP-EXISTING',
      status: 'DRAFT',
      opportunityId: 'opportunity-id',
      companyId: null,
      amount: null,
      currency: null,
      generatedAt: fixedDate.toISOString(),
      idempotencyKey: 'request-key',
    };
    const repository = makeRepository(existingDraft);

    const result = await createCommercialProposalDraft({
      input: {
        opportunityId: 'opportunity-id',
        idempotencyKey: 'request-key',
      },
      repository,
      now: fixedDate,
    });

    expect(result).toEqual({
      draft: existingDraft,
      created: false,
    });
    expect(repository.createDraft).not.toHaveBeenCalled();
  });

  it('rejects missing required input', async () => {
    const repository = makeRepository();

    await expect(
      createCommercialProposalDraft({
        input: {
          opportunityId: '',
          idempotencyKey: 'request-key',
        },
        repository,
      }),
    ).rejects.toThrow('opportunityId is required');
  });
});
