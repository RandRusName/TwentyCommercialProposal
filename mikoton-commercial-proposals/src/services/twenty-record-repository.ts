import { CoreApiClient } from 'twenty-client-sdk/core';

import type {
  ApplicationErrorCode,
  CommercialProposalDraft,
  CommercialProposalRepository,
  OpportunityContext,
} from 'src/domain/commercial-proposal';
import { ApplicationError } from 'src/domain/commercial-proposal';

type CoreClient = InstanceType<typeof CoreApiClient>;

type OpportunityRecord = {
  id: string;
  name?: string | null;
  amount?:
    | string
    | number
    | { amountMicros?: number | string; currencyCode?: string | null };
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
  sourceType?: CommercialProposalDraft['sourceType'] | null;
  templateCode?: string | null;
  templateVersion?: string | null;
  language?: string | null;
  payloadSnapshot?: CommercialProposalDraft['payloadSnapshot'] | null;
  resultMetadata?: Record<string, unknown> | null;
  amount?: number | null;
  currencyCode?: string | null;
  generatedAt?: string | null;
  idempotencyKey?: string | null;
  lastError?: string | null;
  opportunity?: { id?: string | null } | null;
  company?: { id?: string | null } | null;
};

export const normalizeOpportunityAmount = (
  amount: OpportunityRecord['amount'],
) => {
  if (amount === null || amount === undefined) {
    return null;
  }

  if (typeof amount === 'object') {
    if (amount.amountMicros === undefined || amount.amountMicros === null) {
      return null;
    }

    const amountMicros = Number(amount.amountMicros);

    return Number.isNaN(amountMicros) ? null : amountMicros / 1_000_000;
  }

  return Number(amount);
};

export const normalizeOpportunityCurrency = (
  amount: OpportunityRecord['amount'],
) => (typeof amount === 'object' ? amount.currencyCode ?? null : null);

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const classifyReadError = (error: unknown): ApplicationErrorCode => {
  const message = getErrorMessage(error);

  if (/forbidden|permission|not authorized|unauthorized/i.test(message)) {
    return 'OPPORTUNITY_FORBIDDEN';
  }

  return 'OPPORTUNITY_NOT_FOUND';
};

const mapDraft = (record: CommercialProposalRecord): CommercialProposalDraft => ({
  id: record.id,
  title: record.title ?? '',
  number: record.number ?? '',
  status: record.status ?? 'DRAFT',
  sourceType: record.sourceType ?? 'OPPORTUNITY',
  templateCode: record.templateCode ?? '',
  templateVersion: record.templateVersion ?? null,
  language: record.language ?? '',
  payloadSnapshot: record.payloadSnapshot ?? null,
  resultMetadata: record.resultMetadata ?? null,
  opportunityId: record.opportunity?.id ?? '',
  companyId: record.company?.id ?? null,
  amount: record.amount ?? null,
  currencyCode: record.currencyCode ?? null,
  generatedAt: record.generatedAt ?? null,
  idempotencyKey: record.idempotencyKey ?? '',
  lastError: record.lastError ?? null,
});

export class TwentyRecordRepository implements CommercialProposalRepository {
  constructor(private readonly client: CoreClient = new CoreApiClient()) {}

  async getOpportunityContext(opportunityId: string): Promise<OpportunityContext> {
    let response: Awaited<ReturnType<CoreClient['query']>>;

    try {
      response = await this.client.query({
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
    } catch (error) {
      throw new ApplicationError(
        classifyReadError(error),
        'Сделка не найдена или недоступна',
        error,
      );
    }

    const opportunity = response.findUniqueOpportunity as
      | OpportunityRecord
      | null
      | undefined;

    if (opportunity === null || opportunity === undefined) {
      throw new ApplicationError(
        'OPPORTUNITY_NOT_FOUND',
        'Сделка не найдена или недоступна',
      );
    }

    return {
      id: opportunity.id,
      name: opportunity.name ?? opportunity.id,
      company:
        opportunity.company?.id === undefined || opportunity.company.id === null
          ? null
          : {
              id: opportunity.company.id,
              name: opportunity.company.name ?? opportunity.company.id,
            },
      amount: normalizeOpportunityAmount(opportunity.amount),
      currencyCode: normalizeOpportunityCurrency(opportunity.amount),
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
            sourceType: true,
            templateCode: true,
            templateVersion: true,
            language: true,
            payloadSnapshot: true,
            resultMetadata: true,
            amount: true,
            currencyCode: true,
            generatedAt: true,
            idempotencyKey: true,
            lastError: true,
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
            sourceType: draft.sourceType,
            templateCode: draft.templateCode,
            templateVersion: draft.templateVersion,
            language: draft.language,
            payloadSnapshot: draft.payloadSnapshot,
            resultMetadata: draft.resultMetadata,
            amount: draft.amount,
            currencyCode: draft.currencyCode,
            generatedAt: draft.generatedAt,
            idempotencyKey: draft.idempotencyKey,
            lastError: draft.lastError,
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
        sourceType: true,
        templateCode: true,
        templateVersion: true,
        language: true,
        payloadSnapshot: true,
        resultMetadata: true,
        amount: true,
        currencyCode: true,
        generatedAt: true,
        idempotencyKey: true,
        lastError: true,
        opportunity: { id: true },
        company: { id: true },
      },
    });

    return mapDraft(response.createCommercialProposal as CommercialProposalRecord);
  }

  isDuplicateConflict(error: unknown) {
    const message = getErrorMessage(error);
    return /duplicate|unique|already exists|constraint/i.test(message);
  }
}
