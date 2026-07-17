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
import { COMMERCIAL_PROPOSAL_FIELD_FILES_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

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
  opportunityId?: string | null;
  companyId?: string | null;
  opportunity?: { id?: string | null } | null;
  company?: { id?: string | null } | null;
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
  opportunity: { id: true },
  company: { id: true },
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
) => (file.format === 'xlsm' ? 'SPREADSHEET' : 'TEXT_DOCUMENT');

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

const getTwentyAccessToken = () => {
  const token = process.env.TWENTY_APP_ACCESS_TOKEN ?? process.env.TWENTY_API_KEY;

  if (token === undefined || token.trim() === '') {
    throw new ApplicationError(
      'DOCUMENT_STORAGE_FAILED',
      'Twenty access token is not available for generated file upload',
    );
  }

  return token;
};

const uploadGeneratedFileToTwenty = async (
  fileBuffer: Buffer,
  fileName: string,
  contentType: string,
): Promise<UploadedTwentyFile> => {
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
        fieldMetadataUniversalIdentifier:
          COMMERCIAL_PROPOSAL_FIELD_FILES_UNIVERSAL_IDENTIFIER,
      },
    }),
  );
  form.append('map', JSON.stringify({ '0': ['variables.file'] }));
  form.append(
    '0',
    new Blob([fileBuffer as unknown as BlobPart], { type: contentType }),
    fileName,
  );

  const response = await fetch(getTwentyMetadataUrl(), {
    method: 'POST',
    headers: {
      authorization: `Bearer ${getTwentyAccessToken()}`,
    },
    body: form,
  });
  const responseText = await response.text();
  const payload = responseText.trim() === '' ? null : JSON.parse(responseText);

  if (
    !response.ok ||
    payload === null ||
    payload.errors !== undefined ||
    payload.data?.uploadFilesFieldFileByUniversalIdentifier === undefined
  ) {
    throw new ApplicationError(
      'DOCUMENT_STORAGE_FAILED',
      'Generated file upload to Twenty failed',
    );
  }

  return payload.data
    .uploadFilesFieldFileByUniversalIdentifier as UploadedTwentyFile;
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
  sourceType: record.sourceType ?? 'OPPORTUNITY',
  templateCode: record.templateCode ?? '',
  templateVersion: record.templateVersion ?? null,
  language: record.language ?? '',
  payloadSnapshot: record.payloadSnapshot ?? null,
  resultMetadata: record.resultMetadata ?? null,
  opportunityId: record.opportunity?.id ?? record.opportunityId ?? '',
  companyId: record.company?.id ?? record.companyId ?? null,
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

        await this.client.mutation({
          createAttachment: {
            __args: {
              data: {
                name: file.fileName,
                targetCommercialProposalId: commercialProposalId,
                file: {
                  fileId: uploadedFile.id,
                  label: file.fileName,
                },
                fullPath: uploadedFile.path,
                fileCategory: getAttachmentFileCategory(file),
              },
            },
            id: true,
          },
        });

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
