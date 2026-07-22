import {
  acquireGenerationClaim,
  assertGenerationClaimOwnership,
  releaseGenerationClaim,
  renewGenerationClaimLease,
  type GenerationClaimRecord,
} from 'src/domain/generation-claim';
import { ApplicationError } from 'src/domain/commercial-proposal';
import { describe, expect, it, vi } from 'vitest';

const proposalKey = '123e4567-e89b-42d3-a456-426614174002';

const makeClaimRepo = () => {
  const claims = new Map<string, GenerationClaimRecord>();
  return {
    claims,
    repository: {
      createGenerationClaim: vi.fn(async (claim: Omit<GenerationClaimRecord, 'id' | 'createdAt'>) => {
        if (claims.has(claim.proposalKey)) {
          throw new Error('duplicate key value violates unique constraint');
        }
        const created = { id: `claim-${claims.size + 1}`, ...claim };
        claims.set(claim.proposalKey, created);
        return created;
      }),
      findGenerationClaimByProposalKey: vi.fn(async (key: string) => claims.get(key) ?? null),
      deleteGenerationClaim: vi.fn(async (id: string) => {
        for (const [key, claim] of claims.entries()) {
          if (claim.id === id) claims.delete(key);
        }
      }),
      renewGenerationClaimLease: vi.fn(async (input: {
        claimId: string;
        proposalKey: string;
        operationId: string;
        ownerToken: string;
        leaseExpiresAt: string;
      }) => {
        const current = claims.get(input.proposalKey);
        if (
          current === undefined ||
          current.id !== input.claimId ||
          current.operationId !== input.operationId ||
          current.ownerToken !== input.ownerToken
        ) {
          throw new ApplicationError(
            'COMMERCIAL_PROPOSAL_GENERATION_OWNERSHIP_LOST',
            'Владение операцией формирования документов потеряно',
          );
        }
        const renewed = { ...current, leaseExpiresAt: input.leaseExpiresAt };
        claims.set(input.proposalKey, renewed);
        return renewed;
      }),
      isDuplicateConflict: (error: unknown) =>
        /duplicate|unique|already exists|constraint/i.test(
          error instanceof Error ? error.message : String(error),
        ),
    },
  };
};

describe('generation claim fencing', () => {
  it('returns IN_PROGRESS for a live same-operation claim instead of a second ACQUIRED owner', async () => {
    const { repository } = makeClaimRepo();
    const first = await acquireGenerationClaim({
      repository,
      proposalKey,
      operationId: '123e4567-e89b-42d3-a456-426614174010',
      editorRevision: 1,
      fingerprint: 'fp',
      now: new Date('2026-07-12T10:00:00.000Z'),
    });
    expect(first.state).toBe('ACQUIRED');

    const second = await acquireGenerationClaim({
      repository,
      proposalKey,
      operationId: '123e4567-e89b-42d3-a456-426614174010',
      editorRevision: 1,
      fingerprint: 'fp',
      now: new Date('2026-07-12T10:00:01.000Z'),
    });
    expect(second.state).toBe('IN_PROGRESS');
    expect(second.claim.ownerToken).toBe(first.claim.ownerToken);
  });

  it('rejects expired same-operation claim as live ownership and allows a new owner', async () => {
    const { repository, claims } = makeClaimRepo();
    claims.set(proposalKey, {
      id: 'old',
      proposalKey,
      operationId: '123e4567-e89b-42d3-a456-426614174010',
      ownerToken: 'old-owner',
      editorRevision: 1,
      fingerprint: 'fp',
      leaseExpiresAt: '2020-01-01T00:00:00.000Z',
    });

    const next = await acquireGenerationClaim({
      repository,
      proposalKey,
      operationId: '123e4567-e89b-42d3-a456-426614174010',
      editorRevision: 1,
      fingerprint: 'fp',
      now: new Date('2026-07-12T10:00:00.000Z'),
    });
    expect(next.state).toBe('ACQUIRED');
    expect(next.claim.ownerToken).not.toBe('old-owner');
  });

  it('fences old owner after takeover', async () => {
    const { repository, claims } = makeClaimRepo();
    const oldClaim: GenerationClaimRecord = {
      id: 'old',
      proposalKey,
      operationId: 'op-a',
      ownerToken: 'token-a',
      editorRevision: 1,
      fingerprint: 'fp',
      leaseExpiresAt: '2020-01-01T00:00:00.000Z',
    };
    claims.set(proposalKey, oldClaim);

    const takeover = await acquireGenerationClaim({
      repository,
      proposalKey,
      operationId: 'op-b',
      editorRevision: 1,
      fingerprint: 'fp',
      now: new Date('2026-07-12T10:00:00.000Z'),
    });
    expect(takeover.state).toBe('ACQUIRED');

    await expect(
      assertGenerationClaimOwnership({ repository, claim: oldClaim }),
    ).rejects.toMatchObject({ code: 'COMMERCIAL_PROPOSAL_GENERATION_OWNERSHIP_LOST' });

    await releaseGenerationClaim({ repository, claim: oldClaim });
    expect(claims.get(proposalKey)?.ownerToken).toBe(takeover.claim.ownerToken);

    await expect(
      renewGenerationClaimLease({ repository, claim: oldClaim }),
    ).rejects.toMatchObject({ code: 'COMMERCIAL_PROPOSAL_GENERATION_OWNERSHIP_LOST' });
  });

  it('allows only the current owner to renew the lease', async () => {
    const { repository } = makeClaimRepo();
    const acquiredAt = new Date('2026-07-12T10:00:00.000Z');
    const acquired = await acquireGenerationClaim({
      repository,
      proposalKey,
      operationId: 'op',
      editorRevision: 1,
      fingerprint: 'fp',
      now: acquiredAt,
    });
    expect(acquired.state).toBe('ACQUIRED');
    const renewed = await renewGenerationClaimLease({
      repository,
      claim: acquired.claim,
      now: new Date('2026-07-12T11:00:00.000Z'),
    });
    expect(Date.parse(renewed.leaseExpiresAt)).toBeGreaterThan(
      Date.parse(acquired.claim.leaseExpiresAt),
    );
  });
});
