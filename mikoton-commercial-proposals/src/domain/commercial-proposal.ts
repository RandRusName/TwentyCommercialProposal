export type CommercialProposalStatus = 'DRAFT' | 'GENERATED' | 'FAILED';

export type OpportunityContext = {
  id: string;
  name: string;
  companyId: string | null;
  companyName: string | null;
  amount: number | null;
  currency: string | null;
};

export type CommercialProposalDraft = {
  id: string;
  title: string;
  number: string;
  status: CommercialProposalStatus;
  opportunityId: string;
  companyId: string | null;
  amount: number | null;
  currency: string | null;
  generatedAt: string;
  idempotencyKey: string;
};

export type CreateDraftInput = {
  opportunityId: string;
  idempotencyKey: string;
};

export type CommercialProposalRepository = {
  getOpportunityContext: (opportunityId: string) => Promise<OpportunityContext>;
  findDraftByIdempotencyKey: (
    idempotencyKey: string,
  ) => Promise<CommercialProposalDraft | null>;
  createDraft: (
    draft: Omit<CommercialProposalDraft, 'id'>,
  ) => Promise<CommercialProposalDraft>;
};

export const validateCreateDraftInput = (input: Partial<CreateDraftInput>) => {
  if (!input.opportunityId || input.opportunityId.trim() === '') {
    throw new Error('opportunityId is required');
  }

  if (!input.idempotencyKey || input.idempotencyKey.trim() === '') {
    throw new Error('idempotencyKey is required');
  }
};

export const buildCommercialProposalNumber = (date = new Date()) => {
  const yyyy = date.getUTCFullYear();
  const mm = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const dd = `${date.getUTCDate()}`.padStart(2, '0');
  const hh = `${date.getUTCHours()}`.padStart(2, '0');
  const mi = `${date.getUTCMinutes()}`.padStart(2, '0');
  const ss = `${date.getUTCSeconds()}`.padStart(2, '0');

  return `CP-${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
};

export const createCommercialProposalDraft = async ({
  input,
  repository,
  now = new Date(),
}: {
  input: CreateDraftInput;
  repository: CommercialProposalRepository;
  now?: Date;
}) => {
  validateCreateDraftInput(input);

  const existingDraft = await repository.findDraftByIdempotencyKey(
    input.idempotencyKey,
  );

  if (existingDraft !== null) {
    return {
      draft: existingDraft,
      created: false,
    };
  }

  const opportunity = await repository.getOpportunityContext(
    input.opportunityId,
  );
  const number = buildCommercialProposalNumber(now);
  const title = `${number} - ${opportunity.name}`;

  const draft = await repository.createDraft({
    title,
    number,
    status: 'DRAFT',
    opportunityId: opportunity.id,
    companyId: opportunity.companyId,
    amount: opportunity.amount,
    currency: opportunity.currency ?? 'RUB',
    generatedAt: now.toISOString(),
    idempotencyKey: input.idempotencyKey,
  });

  return {
    draft,
    created: true,
  };
};
