import { CoreApiClient } from 'twenty-client-sdk/core';
import { createHash } from 'node:crypto';

import type {
  ApplicationErrorCode,
  CommercialProposalGenerationFile,
  CommercialProposalDraft,
  CommercialProposalRepository,
  OpportunityContext,
} from 'src/domain/commercial-proposal';
import { ApplicationError } from 'src/domain/commercial-proposal';
import type {
  CommercialProposalAggregate,
  CommercialProposalAggregateRepository,
  CommercialProposalContentModelVersion,
  CommercialProposalHeader,
  CommercialProposalItem,
  CommercialProposalStage,
  NormalizedEditorItem,
  NormalizedEditorStage,
} from 'src/domain/commercial-proposal-aggregate';
import { ATTACHMENT_FIELD_FILE_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

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

type CompanyRecord = {
  id: string;
  name?: string | null;
};

type CommercialProposalRecord = {
  id: string;
  title?: string | null;
  number?: string | null;
  status?: CommercialProposalDraft['status'] | null;
  version?: number | null;
  contentModelVersion?: CommercialProposalContentModelVersion | null;
  editorRevision?: number | null;
  lastEditorOperationId?: string | null;
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
  opportunityId?: string | null;
  companyId?: string | null;
  contactName?: string | null;
  contextAndGoal?: string | null;
  validityDays?: number | null;
  paymentTerms?: string | null;
  assumptions?: string | null;
  nextStep?: string | null;
  opportunity?: { id?: string | null } | null;
  company?: { id?: string | null } | null;
};

type CommercialProposalItemRecord = {
  id: string;
  commercialProposalId?: string | null;
  commercialProposal?: { id?: string | null } | null;
  clientKey?: string | null;
  sortOrder?: number | null;
  block?: string | null;
  name?: string | null;
  description?: string | null;
  quantity?: number | null;
  unit?: string | null;
  unitPrice?: number | null;
  discountPercent?: number | null;
  lineAmount?: number | null;
  currencyCode?: string | null;
};

type CommercialProposalStageRecord = {
  id: string;
  commercialProposalId?: string | null;
  commercialProposal?: { id?: string | null } | null;
  clientKey?: string | null;
  sortOrder?: number | null;
  title?: string | null;
  result?: string | null;
  duration?: string | null;
  description?: string | null;
};

type UploadedTwentyFile = {
  id: string;
  path: string;
  size: number;
  createdAt: string;
  url: string;
};

const COMMERCIAL_PROPOSAL_SELECTION = {
  id: true,
  title: true,
  number: true,
  status: true,
  version: true,
  contentModelVersion: true,
  editorRevision: true,
  lastEditorOperationId: true,
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
  opportunityId: true,
  companyId: true,
  contactName: true,
  contextAndGoal: true,
  validityDays: true,
  paymentTerms: true,
  assumptions: true,
  nextStep: true,
  opportunity: { id: true },
  company: { id: true },
} as const;

const COMMERCIAL_PROPOSAL_ITEM_SELECTION = {
  id: true,
  clientKey: true,
  sortOrder: true,
  block: true,
  name: true,
  description: true,
  quantity: true,
  unit: true,
  unitPrice: true,
  discountPercent: true,
  lineAmount: true,
  currencyCode: true,
  commercialProposalId: true,
  commercialProposal: { id: true },
} as const;

const COMMERCIAL_PROPOSAL_STAGE_SELECTION = {
  id: true,
  clientKey: true,
  sortOrder: true,
  title: true,
  result: true,
  duration: true,
  description: true,
  commercialProposalId: true,
  commercialProposal: { id: true },
} as const;

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

const sha256 = (buffer: Buffer) =>
  createHash('sha256').update(buffer).digest('hex');

const assertGeneratedFileBuffer = (
  file: CommercialProposalGenerationFile,
  buffer: Buffer,
) => {
  if (buffer.length !== file.size) {
    throw new ApplicationError(
      'DOCUMENT_STORAGE_FAILED',
      `Generated ${file.format.toUpperCase()} size does not match metadata`,
    );
  }

  if (sha256(buffer) !== file.sha256) {
    throw new ApplicationError(
      'DOCUMENT_STORAGE_FAILED',
      `Generated ${file.format.toUpperCase()} checksum does not match metadata`,
    );
  }
};

const getAttachmentFileCategory = (
  file: CommercialProposalGenerationFile,
) => (file.format === 'xlsx' ? 'SPREADSHEET' : 'TEXT_DOCUMENT');

const getTwentyMetadataUrl = () => {
  const apiUrl = process.env.TWENTY_API_URL;

  if (apiUrl === undefined || apiUrl.trim() === '') {
    throw new ApplicationError(
      'DOCUMENT_STORAGE_FAILED',
      'Twenty API URL is not configured for generated file upload',
    );
  }

  return `${apiUrl.replace(/\/$/, '')}/metadata`;
};

const getTwentyFileUploadAccessTokenCandidates = () => {
  const candidates = [
    process.env.TWENTY_FILE_UPLOAD_API_KEY,
    process.env.TWENTY_API_KEY,
    process.env.TWENTY_APP_ACCESS_TOKEN,
  ]
    .filter((token): token is string => token !== undefined && token.trim() !== '')
    .map((token) => token.trim());

  const uniqueCandidates = Array.from(new Set(candidates));

  if (uniqueCandidates.length === 0) {
    throw new ApplicationError(
      'DOCUMENT_STORAGE_FAILED',
      'Twenty access token is not available for generated file upload',
    );
  }

  return uniqueCandidates;
};

const parseUploadResponse = (responseText: string) => {
  if (responseText.trim() === '') {
    return null;
  }

  try {
    return JSON.parse(responseText) as {
      data?: {
        uploadFilesFieldFileByUniversalIdentifier?: UploadedTwentyFile;
      };
      errors?: Array<{ message?: string }>;
    };
  } catch (error) {
    throw new ApplicationError(
      'DOCUMENT_STORAGE_FAILED',
      'Twenty file upload returned a non-JSON response',
      error,
    );
  }
};

const createUploadForm = (
  fileBuffer: Buffer,
  fileName: string,
  contentType: string,
) => {
  const form = new FormData();

  form.append(
    'operations',
    JSON.stringify({
      query: `
        mutation UploadFilesFieldFileByUniversalIdentifier(
          $file: Upload!
          $fieldMetadataUniversalIdentifier: String!
        ) {
          uploadFilesFieldFileByUniversalIdentifier(
            file: $file
            fieldMetadataUniversalIdentifier: $fieldMetadataUniversalIdentifier
          ) {
            id
            path
            size
            createdAt
            url
          }
        }
      `,
      variables: {
        file: null,
        fieldMetadataUniversalIdentifier: ATTACHMENT_FIELD_FILE_UNIVERSAL_IDENTIFIER,
      },
    }),
  );
  form.append('map', JSON.stringify({ '0': ['variables.file'] }));
  form.append(
    '0',
    new Blob([fileBuffer as unknown as BlobPart], { type: contentType }),
    fileName,
  );

  return form;
};

const uploadGeneratedFileToTwenty = async (
  fileBuffer: Buffer,
  fileName: string,
  contentType: string,
): Promise<UploadedTwentyFile> => {
  const metadataUrl = getTwentyMetadataUrl();
  let lastFailure: string | undefined;

  for (const token of getTwentyFileUploadAccessTokenCandidates()) {
    const response = await fetch(metadataUrl, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
      },
      body: createUploadForm(fileBuffer, fileName, contentType),
    });
    const responseText = await response.text();
    const payload = parseUploadResponse(responseText);
    const uploadedFile = payload?.data?.uploadFilesFieldFileByUniversalIdentifier;

    if (response.ok && payload?.errors === undefined && uploadedFile !== undefined) {
      return uploadedFile;
    }

    lastFailure =
      payload?.errors?.map((error) => error.message).join('; ') ??
      `${response.status} ${response.statusText}`;

    if (response.status !== 401 && response.status !== 403) {
      break;
    }
  }

  throw new ApplicationError(
    'DOCUMENT_STORAGE_FAILED',
    'Generated file upload to Twenty failed',
    lastFailure,
  );
};

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
  version: record.version ?? 1,
  contentModelVersion: record.contentModelVersion ?? 'LEGACY_V1',
  editorRevision: record.editorRevision ?? 1,
  lastEditorOperationId: record.lastEditorOperationId ?? null,
  sourceType: record.sourceType ?? 'OPPORTUNITY',
  templateCode: record.templateCode ?? '',
  templateVersion: record.templateVersion ?? null,
  language: record.language ?? '',
  payloadSnapshot: record.payloadSnapshot ?? null,
  resultMetadata: record.resultMetadata ?? null,
  opportunityId: record.opportunity?.id ?? record.opportunityId ?? '',
  companyId: record.company?.id ?? record.companyId ?? null,
  contactName: record.contactName ?? null,
  contextAndGoal: record.contextAndGoal ?? null,
  validityDays: record.validityDays ?? 14,
  paymentTerms: record.paymentTerms ?? null,
  assumptions: record.assumptions ?? null,
  nextStep: record.nextStep ?? null,
  amount: record.amount ?? null,
  currencyCode: record.currencyCode ?? null,
  generatedAt: record.generatedAt ?? null,
  idempotencyKey: record.idempotencyKey ?? '',
  lastError: record.lastError ?? null,
});

const mapItem = (record: CommercialProposalItemRecord): CommercialProposalItem => ({
  id: record.id,
  commercialProposalId:
    record.commercialProposal?.id ?? record.commercialProposalId ?? '',
  clientKey: record.clientKey ?? '',
  position: record.sortOrder ?? 0,
  block: record.block ?? '',
  name: record.name ?? '',
  description: record.description ?? null,
  quantity: record.quantity ?? 0,
  unit: record.unit ?? '',
  unitPrice: record.unitPrice ?? 0,
  discountPercent: record.discountPercent ?? 0,
  lineAmount: record.lineAmount ?? 0,
  currencyCode: record.currencyCode ?? '',
});

const mapStage = (
  record: CommercialProposalStageRecord,
): CommercialProposalStage => ({
  id: record.id,
  commercialProposalId:
    record.commercialProposal?.id ?? record.commercialProposalId ?? '',
  clientKey: record.clientKey ?? '',
  position: record.sortOrder ?? 0,
  title: record.title ?? '',
  result: record.result ?? null,
  duration: record.duration ?? null,
  description: record.description ?? null,
});

const sortByPosition = <T extends { position: number }>(records: T[]) =>
  [...records].sort((a, b) => a.position - b.position);

export class TwentyRecordRepository
  implements CommercialProposalRepository, CommercialProposalAggregateRepository
{
  constructor(private readonly client: CoreClient = new CoreApiClient()) {}

  async getOpportunityContext(opportunityId: string): Promise<OpportunityContext> {
    let response: Awaited<ReturnType<CoreClient['query']>>;

    try {
      response = await this.client.query({
        opportunity: {
          __args: {
            filter: {
              id: {
                eq: opportunityId,
              },
            },
          },
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

    const opportunity = response.opportunity as
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

  async getCompanyContext(
    companyId: string,
  ): Promise<{ id: string; name: string } | null> {
    const response = await this.client.query({
      company: {
        __args: { filter: { id: { eq: companyId } } },
        id: true,
        name: true,
      },
    });
    const company = response.company as CompanyRecord | null | undefined;

    return company === null || company === undefined
      ? null
      : { id: company.id, name: company.name ?? company.id };
  }

  async findDraftByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<CommercialProposalDraft | null> {
    const response = await this.client.query({
      commercialProposals: {
        __args: {
          first: 1,
          filter: {
            idempotencyKey: {
              eq: idempotencyKey,
            },
          },
        },
        edges: {
          node: COMMERCIAL_PROPOSAL_SELECTION,
        },
      },
    });

    const firstNode = response.commercialProposals?.edges?.[0]?.node as
      | CommercialProposalRecord
      | undefined;

    return firstNode === undefined ? null : mapDraft(firstNode);
  }

  async listCommercialProposalNumbers(): Promise<string[]> {
    const response = await this.client.query({
      commercialProposals: {
        __args: {
          first: 1000,
        },
        edges: {
          node: {
            number: true,
          },
        },
      },
    });

    const edges = response.commercialProposals?.edges as
      | Array<{ node?: { number?: string | null } | null }>
      | undefined;

    return (
      edges
        ?.map((edge) => edge.node?.number)
        .filter((number): number is string => typeof number === 'string') ?? []
    );
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
            version: draft.version,
            contentModelVersion: draft.contentModelVersion,
            editorRevision: draft.editorRevision,
            lastEditorOperationId: draft.lastEditorOperationId,
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
            opportunityId: draft.opportunityId,
            ...(draft.companyId === null ? {} : { companyId: draft.companyId }),
            contactName: draft.contactName,
            contextAndGoal: draft.contextAndGoal,
            validityDays: draft.validityDays,
            paymentTerms: draft.paymentTerms,
            assumptions: draft.assumptions,
            nextStep: draft.nextStep,
          },
        },
        ...COMMERCIAL_PROPOSAL_SELECTION,
      },
    });

    return mapDraft(response.createCommercialProposal as CommercialProposalRecord);
  }

  async getCommercialProposal(
    commercialProposalId: string,
  ): Promise<CommercialProposalDraft> {
    let response: Awaited<ReturnType<CoreClient['query']>>;

    try {
      response = await this.client.query({
        commercialProposal: {
          __args: {
            filter: {
              id: {
                eq: commercialProposalId,
              },
            },
          },
          ...COMMERCIAL_PROPOSAL_SELECTION,
        },
      });
    } catch (error) {
      throw new ApplicationError(
        /forbidden|permission|not authorized|unauthorized/i.test(
          getErrorMessage(error),
        )
          ? 'COMMERCIAL_PROPOSAL_FORBIDDEN'
          : 'COMMERCIAL_PROPOSAL_NOT_FOUND',
        'Коммерческое предложение не найдено или недоступно',
        error,
      );
    }

    const record = response.commercialProposal as
      | CommercialProposalRecord
      | null
      | undefined;

    if (record === null || record === undefined) {
      throw new ApplicationError(
        'COMMERCIAL_PROPOSAL_NOT_FOUND',
        'Коммерческое предложение не найдено или недоступно',
      );
    }

    return mapDraft(record);
  }

  async updateCommercialProposal(
    commercialProposalId: string,
    patch: Partial<Omit<CommercialProposalDraft, 'id'>>,
  ): Promise<CommercialProposalDraft> {
    const response = await this.client.mutation({
      updateCommercialProposal: {
        __args: {
          id: commercialProposalId,
          data: patch,
        },
        ...COMMERCIAL_PROPOSAL_SELECTION,
      },
    });

    return mapDraft(response.updateCommercialProposal as CommercialProposalRecord);
  }

  async listProposalItems(
    proposalId: string,
  ): Promise<CommercialProposalItem[]> {
    const response = await this.client.query({
      commercialProposalItems: {
        __args: {
          first: 1000,
          filter: {
            commercialProposal: {
              id: {
                eq: proposalId,
              },
            },
          },
        },
        edges: {
          node: COMMERCIAL_PROPOSAL_ITEM_SELECTION,
        },
      },
    });

    const edges = response.commercialProposalItems?.edges as
      | Array<{ node?: CommercialProposalItemRecord | null }>
      | undefined;

    return sortByPosition(
      edges
        ?.map((edge) => edge.node)
        .filter((node): node is CommercialProposalItemRecord => node != null)
        .map(mapItem) ?? [],
    );
  }

  async listProposalStages(
    proposalId: string,
  ): Promise<CommercialProposalStage[]> {
    const response = await this.client.query({
      commercialProposalStages: {
        __args: {
          first: 1000,
          filter: {
            commercialProposal: {
              id: {
                eq: proposalId,
              },
            },
          },
        },
        edges: {
          node: COMMERCIAL_PROPOSAL_STAGE_SELECTION,
        },
      },
    });

    const edges = response.commercialProposalStages?.edges as
      | Array<{ node?: CommercialProposalStageRecord | null }>
      | undefined;

    return sortByPosition(
      edges
        ?.map((edge) => edge.node)
        .filter((node): node is CommercialProposalStageRecord => node != null)
        .map(mapStage) ?? [],
    );
  }

  async getCommercialProposalAggregate(
    id: string,
  ): Promise<CommercialProposalAggregate> {
    const proposal = await this.getCommercialProposal(id);
    const [items, stages] = await Promise.all([
      this.listProposalItems(id),
      this.listProposalStages(id),
    ]);

    return { proposal, items, stages };
  }

  async findItemByParentAndClientKey(
    proposalId: string,
    clientKey: string,
  ): Promise<CommercialProposalItem | null> {
    const response = await this.client.query({
      commercialProposalItems: {
        __args: {
          first: 1,
          filter: {
            commercialProposal: {
              id: { eq: proposalId },
            },
            clientKey: { eq: clientKey },
          },
        },
        edges: {
          node: COMMERCIAL_PROPOSAL_ITEM_SELECTION,
        },
      },
    });
    const node = response.commercialProposalItems?.edges?.[0]?.node as
      | CommercialProposalItemRecord
      | undefined;

    return node === undefined ? null : mapItem(node);
  }

  async findStageByParentAndClientKey(
    proposalId: string,
    clientKey: string,
  ): Promise<CommercialProposalStage | null> {
    const response = await this.client.query({
      commercialProposalStages: {
        __args: {
          first: 1,
          filter: {
            commercialProposal: {
              id: { eq: proposalId },
            },
            clientKey: { eq: clientKey },
          },
        },
        edges: {
          node: COMMERCIAL_PROPOSAL_STAGE_SELECTION,
        },
      },
    });
    const node = response.commercialProposalStages?.edges?.[0]?.node as
      | CommercialProposalStageRecord
      | undefined;

    return node === undefined ? null : mapStage(node);
  }

  async upsertItem(
    proposalId: string,
    item: NormalizedEditorItem,
  ): Promise<CommercialProposalItem> {
    const data = {
      commercialProposalId: proposalId,
      clientKey: item.clientKey,
      sortOrder: item.position,
      block: item.block,
      name: item.name,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice,
      discountPercent: item.discountPercent,
      lineAmount: item.lineAmount,
      currencyCode: item.currencyCode,
    };

    if (item.id !== undefined) {
      const response = await this.client.mutation({
        updateCommercialProposalItem: {
          __args: {
            id: item.id,
            data,
          },
          ...COMMERCIAL_PROPOSAL_ITEM_SELECTION,
        },
      });

      return mapItem(
        response.updateCommercialProposalItem as CommercialProposalItemRecord,
      );
    }

    const response = await this.client.mutation({
      createCommercialProposalItem: {
        __args: {
          data,
        },
        ...COMMERCIAL_PROPOSAL_ITEM_SELECTION,
      },
    });

    return mapItem(
      response.createCommercialProposalItem as CommercialProposalItemRecord,
    );
  }

  async upsertStage(
    proposalId: string,
    stage: NormalizedEditorStage,
  ): Promise<CommercialProposalStage> {
    const data = {
      commercialProposalId: proposalId,
      clientKey: stage.clientKey,
      sortOrder: stage.position,
      title: stage.title,
      result: stage.result,
      duration: stage.duration,
      description: stage.description,
    };

    if (stage.id !== undefined) {
      const response = await this.client.mutation({
        updateCommercialProposalStage: {
          __args: {
            id: stage.id,
            data,
          },
          ...COMMERCIAL_PROPOSAL_STAGE_SELECTION,
        },
      });

      return mapStage(
        response.updateCommercialProposalStage as CommercialProposalStageRecord,
      );
    }

    const response = await this.client.mutation({
      createCommercialProposalStage: {
        __args: {
          data,
        },
        ...COMMERCIAL_PROPOSAL_STAGE_SELECTION,
      },
    });

    return mapStage(
      response.createCommercialProposalStage as CommercialProposalStageRecord,
    );
  }

  async deleteItem(id: string): Promise<void> {
    await this.client.mutation({
      deleteCommercialProposalItem: {
        __args: { id },
        id: true,
      },
    });
  }

  async deleteStage(id: string): Promise<void> {
    await this.client.mutation({
      deleteCommercialProposalStage: {
        __args: { id },
        id: true,
      },
    });
  }

  async updateCommercialProposalForEditor(
    id: string,
    patch: {
      header: CommercialProposalHeader;
      amount: number;
      contentModelVersion: CommercialProposalContentModelVersion;
      editorRevision: number;
      lastEditorOperationId: string;
    },
  ): Promise<void> {
    await this.updateCommercialProposal(id, {
      title: patch.header.title,
      companyId: patch.header.companyId,
      contactName: patch.header.contactName,
      contextAndGoal: patch.header.contextAndGoal,
      currencyCode: patch.header.currencyCode,
      validityDays: patch.header.validityDays,
      paymentTerms: patch.header.paymentTerms,
      assumptions: patch.header.assumptions,
      nextStep: patch.header.nextStep,
      amount: patch.amount,
      contentModelVersion: patch.contentModelVersion,
      editorRevision: patch.editorRevision,
      lastEditorOperationId: patch.lastEditorOperationId,
    });
  }

  async attachGeneratedFiles(
    commercialProposalId: string,
    files: CommercialProposalGenerationFile[],
  ): Promise<CommercialProposalGenerationFile[]> {
    return Promise.all(
      files.map(async (file) => {
        const response = await fetch(file.downloadUrl);

        if (!response.ok) {
          throw new ApplicationError(
            'DOCUMENT_STORAGE_FAILED',
            `Generated ${file.format.toUpperCase()} file could not be downloaded`,
          );
        }

        const contentType = response.headers.get('content-type') ?? '';

        if (
          contentType !== '' &&
          contentType !== 'application/octet-stream' &&
          !contentType.toLowerCase().includes(file.contentType.toLowerCase())
        ) {
          throw new ApplicationError(
            'DOCUMENT_STORAGE_FAILED',
            `Generated ${file.format.toUpperCase()} content type does not match metadata`,
          );
        }

        const buffer = Buffer.from(await response.arrayBuffer());
        assertGeneratedFileBuffer(file, buffer);

        const uploadedFile = await uploadGeneratedFileToTwenty(
          buffer,
          file.fileName,
          file.contentType,
        );

        try {
          await this.client.mutation({
            createAttachment: {
              __args: {
                data: {
                  name: file.fileName,
                  targetCommercialProposalId: commercialProposalId,
                  file: [
                    {
                      fileId: uploadedFile.id,
                      label: file.fileName,
                    },
                  ],
                  fullPath: uploadedFile.path,
                  fileCategory: getAttachmentFileCategory(file),
                },
              },
              id: true,
            },
          });
        } catch (error) {
          throw new ApplicationError(
            'DOCUMENT_STORAGE_FAILED',
            'Generated file attachment to Twenty failed',
            error,
          );
        }

        return {
          ...file,
          twentyFileId: uploadedFile.id,
          twentyFileUrl: uploadedFile.url,
          downloadUrl: uploadedFile.url,
        };
      }),
    );
  }

  isDuplicateConflict(error: unknown) {
    const message = getErrorMessage(error);
    return /duplicate|unique|already exists|constraint/i.test(message);
  }
}
