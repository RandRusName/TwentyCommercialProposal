import type { CommercialProposalRepository } from 'src/domain/commercial-proposal';

export type ProposalDraftRepository = Pick<
  CommercialProposalRepository,
  | 'getOpportunityContext'
  | 'findDraftByIdempotencyKey'
  | 'createDraft'
  | 'isDuplicateConflict'
>;

export type ProposalGenerationRepository = CommercialProposalRepository;
