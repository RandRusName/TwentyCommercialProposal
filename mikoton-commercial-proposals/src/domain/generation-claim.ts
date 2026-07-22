import {
  ApplicationError,
  canonicalJson,
  sha256Hex,
  type CommercialProposalDraft,
} from 'src/domain/commercial-proposal';
import type { CommercialProposalAggregate } from 'src/domain/commercial-proposal-aggregate';

/** Base lease; owners renew at irreversible checkpoints. */
export const GENERATION_CLAIM_LEASE_MS = 10 * 60 * 1000;

export type GenerationClaimRecord = {
  id: string;
  proposalKey: string;
  operationId: string;
  ownerToken: string;
  editorRevision: number;
  fingerprint: string;
  leaseExpiresAt: string;
  createdAt?: string | null;
};

export type AcquireGenerationClaimResult =
  | {
      state: 'ACQUIRED';
      claim: GenerationClaimRecord;
    }
  | {
      state: 'IN_PROGRESS';
      claim: GenerationClaimRecord;
    };

export type GenerationClaimRepository = {
  createGenerationClaim: (
    claim: Omit<GenerationClaimRecord, 'id' | 'createdAt'>,
  ) => Promise<GenerationClaimRecord>;
  findGenerationClaimByProposalKey: (
    proposalKey: string,
  ) => Promise<GenerationClaimRecord | null>;
  deleteGenerationClaim: (id: string) => Promise<void>;
  renewGenerationClaimLease?: (input: {
    claimId: string;
    proposalKey: string;
    operationId: string;
    ownerToken: string;
    leaseExpiresAt: string;
  }) => Promise<GenerationClaimRecord>;
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

const createOwnerToken = () => {
  if (typeof globalThis.crypto?.randomUUID !== 'function') {
    throw new ApplicationError(
      'INTERNAL_ERROR',
      'Secure UUID generation is unavailable for generation claim ownership',
    );
  }
  return globalThis.crypto.randomUUID();
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

export const isLeaseExpired = (claim: GenerationClaimRecord, now: Date) =>
  Date.parse(claim.leaseExpiresAt) <= now.getTime();

const matchesLogicalOperation = (
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

export const assertGenerationClaimOwnership = async ({
  repository,
  claim,
}: {
  repository: GenerationClaimRepository;
  claim: GenerationClaimRecord;
}): Promise<GenerationClaimRecord> => {
  const current = await repository.findGenerationClaimByProposalKey(
    claim.proposalKey,
  );
  if (
    current === null ||
    current.id !== claim.id ||
    current.proposalKey !== claim.proposalKey ||
    current.operationId !== claim.operationId ||
    current.ownerToken !== claim.ownerToken
  ) {
    throw new ApplicationError(
      'COMMERCIAL_PROPOSAL_GENERATION_OWNERSHIP_LOST',
      'Владение операцией формирования документов потеряно',
    );
  }
  return current;
};

export const renewGenerationClaimLease = async ({
  repository,
  claim,
  now = new Date(),
}: {
  repository: GenerationClaimRepository;
  claim: GenerationClaimRecord;
  now?: Date;
}): Promise<GenerationClaimRecord> => {
  await assertGenerationClaimOwnership({ repository, claim });
  const leaseExpiresAt = new Date(
    now.getTime() + GENERATION_CLAIM_LEASE_MS,
  ).toISOString();

  if (repository.renewGenerationClaimLease !== undefined) {
    const renewed = await repository.renewGenerationClaimLease({
      claimId: claim.id,
      proposalKey: claim.proposalKey,
      operationId: claim.operationId,
      ownerToken: claim.ownerToken,
      leaseExpiresAt,
    });
    return assertGenerationClaimOwnership({ repository, claim: renewed });
  }

  // Fallback repositories without renew still re-assert ownership.
  return {
    ...claim,
    leaseExpiresAt,
  };
};

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
}): Promise<AcquireGenerationClaimResult> => {
  const leaseExpiresAt = new Date(
    now.getTime() + GENERATION_CLAIM_LEASE_MS,
  ).toISOString();
  const desiredBase = {
    proposalKey,
    operationId,
    editorRevision,
    fingerprint,
    leaseExpiresAt,
  };

  const tryCreate = async (): Promise<AcquireGenerationClaimResult> => {
    const claim = await repository.createGenerationClaim({
      ...desiredBase,
      ownerToken: createOwnerToken(),
      leaseExpiresAt: new Date(
        now.getTime() + GENERATION_CLAIM_LEASE_MS,
      ).toISOString(),
    });
    return { state: 'ACQUIRED', claim };
  };

  try {
    return await tryCreate();
  } catch (error) {
    if (!isDuplicateConflict(repository, error)) {
      throw error;
    }
  }

  const existing = await repository.findGenerationClaimByProposalKey(proposalKey);
  if (existing === null) {
    try {
      return await tryCreate();
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

  // Expired claims are never treated as live same-operation ownership.
  if (isLeaseExpired(existing, now)) {
    try {
      await repository.deleteGenerationClaim(existing.id);
    } catch {
      // Another worker may already have replaced the stale claim.
    }
    try {
      return await tryCreate();
    } catch (error) {
      if (!isDuplicateConflict(repository, error)) {
        throw error;
      }
    }
    const afterRace = await repository.findGenerationClaimByProposalKey(proposalKey);
    if (afterRace !== null && !isLeaseExpired(afterRace, now)) {
      return { state: 'IN_PROGRESS', claim: afterRace };
    }
    throw new ApplicationError(
      'COMMERCIAL_PROPOSAL_GENERATION_IN_PROGRESS',
      'Формирование документов для этого коммерческого предложения уже выполняется',
    );
  }

  // Live claim: same logical operation still means another physical owner holds it.
  if (matchesLogicalOperation(existing, desiredBase)) {
    return { state: 'IN_PROGRESS', claim: existing };
  }

  return { state: 'IN_PROGRESS', claim: existing };
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
    const current = await repository.findGenerationClaimByProposalKey(
      claim.proposalKey,
    );
    if (
      current === null ||
      current.id !== claim.id ||
      current.operationId !== claim.operationId ||
      current.ownerToken !== claim.ownerToken
    ) {
      return;
    }
    await repository.deleteGenerationClaim(current.id);
  } catch {
    // Terminal paths must not fail closed on a missing/raced claim row.
  }
};

export const isOwnershipLostError = (error: unknown) =>
  error instanceof ApplicationError &&
  error.code === 'COMMERCIAL_PROPOSAL_GENERATION_OWNERSHIP_LOST';
