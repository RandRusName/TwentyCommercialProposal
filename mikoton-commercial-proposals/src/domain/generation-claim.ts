import {
  ApplicationError,
  canonicalJson,
  sha256Hex,
  type CommercialProposalDraft,
} from 'src/domain/commercial-proposal';
import type { CommercialProposalAggregate } from 'src/domain/commercial-proposal-aggregate';

export const GENERATION_CLAIM_LEASE_MS = 5 * 60 * 1000;

export type GenerationClaimRecord = {
  id: string;
  proposalKey: string;
  operationId: string;
  editorRevision: number;
  fingerprint: string;
  leaseExpiresAt: string;
  createdAt?: string | null;
};

export type GenerationClaimRepository = {
  createGenerationClaim: (
    claim: Omit<GenerationClaimRecord, 'id' | 'createdAt'>,
  ) => Promise<GenerationClaimRecord>;
  findGenerationClaimByProposalKey: (
    proposalKey: string,
  ) => Promise<GenerationClaimRecord | null>;
  deleteGenerationClaim: (id: string) => Promise<void>;
  isDuplicateConflict?: (error: unknown) => boolean;
};

const isDuplicateConflict = (
  repository: GenerationClaimRepository,
  error: unknown,
) => {
  if (repository.isDuplicateConflict?.(error)) {
    return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  return /duplicate|unique|already exists|constraint/i.test(message);
};

export const calculateGenerationContentFingerprint = ({
  draft,
  aggregate,
}: {
  draft: CommercialProposalDraft;
  aggregate?: CommercialProposalAggregate;
}) =>
  sha256Hex(
    canonicalJson({
      contentModelVersion: draft.contentModelVersion,
      editorRevision: draft.editorRevision,
      opportunityId: draft.opportunityId,
      companyId: draft.companyId,
      amount: draft.amount,
      currencyCode: draft.currencyCode,
      contactName: draft.contactName,
      contextAndGoal: draft.contextAndGoal,
      validityDays: draft.validityDays,
      paymentTerms: draft.paymentTerms,
      assumptions: draft.assumptions,
      nextStep: draft.nextStep,
      items: (aggregate?.items ?? []).map((item) => ({
        id: item.id,
        clientKey: item.clientKey,
        position: item.position,
        block: item.block,
        name: item.name,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        discountPercent: item.discountPercent,
        lineAmount: item.lineAmount,
        currencyCode: item.currencyCode,
        catalogItemId: item.catalogItemId,
      })),
      stages: (aggregate?.stages ?? []).map((stage) => ({
        id: stage.id,
        clientKey: stage.clientKey,
        position: stage.position,
        title: stage.title,
        result: stage.result,
        duration: stage.duration,
        description: stage.description,
      })),
    }),
  );

const isLeaseExpired = (claim: GenerationClaimRecord, now: Date) =>
  Date.parse(claim.leaseExpiresAt) <= now.getTime();

const matchesOperation = (
  claim: GenerationClaimRecord,
  input: {
    operationId: string;
    editorRevision: number;
    fingerprint: string;
  },
) =>
  claim.operationId === input.operationId &&
  claim.editorRevision === input.editorRevision &&
  claim.fingerprint === input.fingerprint;

export const acquireGenerationClaim = async ({
  repository,
  proposalKey,
  operationId,
  editorRevision,
  fingerprint,
  now = new Date(),
}: {
  repository: GenerationClaimRepository;
  proposalKey: string;
  operationId: string;
  editorRevision: number;
  fingerprint: string;
  now?: Date;
}): Promise<GenerationClaimRecord> => {
  const leaseExpiresAt = new Date(
    now.getTime() + GENERATION_CLAIM_LEASE_MS,
  ).toISOString();
  const desired = {
    proposalKey,
    operationId,
    editorRevision,
    fingerprint,
    leaseExpiresAt,
  };

  try {
    return await repository.createGenerationClaim(desired);
  } catch (error) {
    if (!isDuplicateConflict(repository, error)) {
      throw error;
    }
  }

  const existing = await repository.findGenerationClaimByProposalKey(proposalKey);
  if (existing === null) {
    try {
      return await repository.createGenerationClaim(desired);
    } catch (error) {
      if (isDuplicateConflict(repository, error)) {
        throw new ApplicationError(
          'COMMERCIAL_PROPOSAL_GENERATION_IN_PROGRESS',
          'Формирование документов для этого коммерческого предложения уже выполняется',
        );
      }
      throw error;
    }
  }

  if (matchesOperation(existing, desired)) {
    return existing;
  }

  if (!isLeaseExpired(existing, now)) {
    throw new ApplicationError(
      'COMMERCIAL_PROPOSAL_GENERATION_IN_PROGRESS',
      'Формирование документов для этого коммерческого предложения уже выполняется',
    );
  }

  try {
    await repository.deleteGenerationClaim(existing.id);
  } catch {
    // Another worker may have already deleted/replaced the stale claim.
  }

  try {
    return await repository.createGenerationClaim(desired);
  } catch (error) {
    if (!isDuplicateConflict(repository, error)) {
      throw error;
    }
  }

  const afterRace = await repository.findGenerationClaimByProposalKey(proposalKey);
  if (afterRace !== null && matchesOperation(afterRace, desired)) {
    return afterRace;
  }

  throw new ApplicationError(
    'COMMERCIAL_PROPOSAL_GENERATION_IN_PROGRESS',
    'Формирование документов для этого коммерческого предложения уже выполняется',
  );
};

export const releaseGenerationClaim = async ({
  repository,
  claim,
}: {
  repository: GenerationClaimRepository;
  claim: GenerationClaimRecord | null;
}) => {
  if (claim === null) {
    return;
  }
  try {
    await repository.deleteGenerationClaim(claim.id);
  } catch {
    // Terminal paths must not fail closed on a missing claim row.
  }
};
