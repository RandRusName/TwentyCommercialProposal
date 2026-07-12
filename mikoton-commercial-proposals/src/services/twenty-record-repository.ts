import { CoreApiClient } from 'twenty-client-sdk/core';

import type {
  CommercialProposalDraft,
  CommercialProposalRepository,
  OpportunityContext,
} from 'src/domain/commercial-proposal';

type CoreClient = InstanceType<typeof CoreApiClient>;

type OpportunityRecord = {
  id: string;
  name?: string | null;
  amount?: string | number | { amountMicros?: number; currencyCode?: string };
  company?: {
    id?: string | null;
    name?: string | null;
  } | null;
};

type CommercialProposalRecord = {
  id: string;
  title?: string | null;
  number?: string | null;
  status?: CommercialProposalDraft['status'] | null;
  amount?: number | null;
  currency?: string | null;
  generatedAt?: string | null;
  idempotencyKey?: string | null;
  opportunity?: { id?: string | null } | null;
  company?: { id?: string | null } | null;
};

const normalizeAmount = (amount: OpportunityRecord['amount']) => {
  if (amount === null || amount === undefined) {
    return null;
  }

  if (typeof amount === 'object') {
    return amount.amountMicros === undefined
      ? null
      : amount.amountMicros / 1_000_000;
  }

  return Number(amount);
};

const normalizeCurrency = (amount: OpportunityRecord['amount']) =>
  typeof amount === 'object' ? amount.currencyCode ?? null : null;

const mapDraft = (record: CommercialProposalRecord): CommercialProposalDraft => ({
  id: record.id,
  title: record.title ?? '',
  number: record.number ?? '',
  status: record.status ?? 'DRAFT',
  opportunityId: record.opportunity?.id ?? '',
  companyId: record.company?.id ?? null,
  amount: record.amount ?? null,
  currency: record.currency ?? null,
  generatedAt: record.generatedAt ?? '',
  idempotencyKey: record.idempotencyKey ?? '',
});

export class TwentyRecordRepository implements CommercialProposalRepository {
  constructor(private readonly client: CoreClient = new CoreApiClient()) {}

  async getOpportunityContext(opportunityId: string): Promise<OpportunityContext> {
    const response = await this.client.query({
      findUniqueOpportunity: {
        __args: { id: opportunityId },
        id: true,
        name: true,
        amount: {
          amountMicros: true,
          currencyCode: true,
        },
        company: {
          id: true,
          name: true,
        },
      },
    });

    const opportunity = response.findUniqueOpportunity as
      | OpportunityRecord
      | null
      | undefined;

    if (opportunity === null || opportunity === undefined) {
      throw new Error('Opportunity was not found');
    }

    return {
      id: opportunity.id,
      name: opportunity.name ?? opportunity.id,
      companyId: opportunity.company?.id ?? null,
      companyName: opportunity.company?.name ?? null,
      amount: normalizeAmount(opportunity.amount),
      currency: normalizeCurrency(opportunity.amount),
    };
  }

  async findDraftByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<CommercialProposalDraft | null> {
    const response = await this.client.query({
      findManyCommercialProposals: {
        __args: {
          first: 1,
          filter: {
            idempotencyKey: {
              eq: idempotencyKey,
            },
          },
        },
        edges: {
          node: {
            id: true,
            title: true,
            number: true,
            status: true,
            amount: true,
            currency: true,
            generatedAt: true,
            idempotencyKey: true,
            opportunity: { id: true },
            company: { id: true },
          },
        },
      },
    });

    const firstNode = response.findManyCommercialProposals?.edges?.[0]?.node as
      | CommercialProposalRecord
      | undefined;

    return firstNode === undefined ? null : mapDraft(firstNode);
  }

  async createDraft(
    draft: Omit<CommercialProposalDraft, 'id'>,
  ): Promise<CommercialProposalDraft> {
    const response = await this.client.mutation({
      createCommercialProposal: {
        __args: {
          data: {
            title: draft.title,
            number: draft.number,
            status: draft.status,
            amount: draft.amount,
            currency: draft.currency,
            generatedAt: draft.generatedAt,
            idempotencyKey: draft.idempotencyKey,
            opportunity: {
              connect: {
                id: draft.opportunityId,
              },
            },
            ...(draft.companyId === null
              ? {}
              : {
                  company: {
                    connect: {
                      id: draft.companyId,
                    },
                  },
                }),
          },
        },
        id: true,
        title: true,
        number: true,
        status: true,
        amount: true,
        currency: true,
        generatedAt: true,
        idempotencyKey: true,
        opportunity: { id: true },
        company: { id: true },
      },
    });

    return mapDraft(response.createCommercialProposal as CommercialProposalRecord);
  }
}
