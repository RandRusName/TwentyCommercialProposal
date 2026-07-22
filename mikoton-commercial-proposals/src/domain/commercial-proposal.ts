import type { CommercialProposalAggregate } from 'src/domain/commercial-proposal-aggregate';
import {
  calculateProposalLineAmount,
  sumLineAmounts,
} from 'src/domain/commercial-proposal-money';

export const SUPPORTED_TEMPLATE_CODE = 'standard-commercial-proposal';
export const SUPPORTED_LANGUAGE = 'ru-RU';

export type CommercialProposalStatus =
  | 'DRAFT'
  | 'GENERATING'
  | 'GENERATED'
  | 'SENT'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'FAILED'
  | 'CANCELLED';

export type CommercialProposalSourceType = 'OPPORTUNITY';
export type CommercialProposalContentModelVersion =
  | 'LEGACY_V1'
  | 'AGGREGATE_V2';

export type ApplicationErrorCode =
  | 'INVALID_INPUT'
  | 'UNSUPPORTED_SOURCE'
  | 'OPPORTUNITY_NOT_FOUND'
  | 'OPPORTUNITY_FORBIDDEN'
  | 'DUPLICATE_REQUEST'
  | 'COMMERCIAL_PROPOSAL_CREATE_FAILED'
  | 'COMMERCIAL_PROPOSAL_NOT_FOUND'
  | 'COMMERCIAL_PROPOSAL_FORBIDDEN'
  | 'COMMERCIAL_PROPOSAL_INVALID_STATUS'
  | 'COMMERCIAL_PROPOSAL_NUMBER_LIMIT_REACHED'
  | 'COMMERCIAL_PROPOSAL_CHILD_FORBIDDEN'
  | 'COMMERCIAL_PROPOSAL_CHILD_NOT_FOUND'
  | 'COMMERCIAL_PROPOSAL_CHILD_IDENTITY_CONFLICT'
  | 'COMMERCIAL_PROPOSAL_DATA_INTEGRITY_ERROR'
  | 'COMMERCIAL_PROPOSAL_EDITOR_CONFLICT'
  | 'COMMERCIAL_PROPOSAL_VALIDATION_FAILED'
  | 'COMMERCIAL_PROPOSAL_SAVE_FAILED'
  | 'CATALOG_ITEM_NOT_FOUND'
  | 'CATALOG_ITEM_NOT_SELECTABLE'
  | 'CATALOG_SEARCH_FAILED'
  | 'COMMERCIAL_PROPOSAL_GENERATION_MODEL_NOT_SUPPORTED'
  | 'COMMERCIAL_PROPOSAL_GENERATION_VALIDATION_FAILED'
  | 'COMMERCIAL_PROPOSAL_GENERATION_IN_PROGRESS'
  | 'COMMERCIAL_PROPOSAL_GENERATION_OWNERSHIP_LOST'
  | 'DOCUMENT_SCHEMA_TEMPLATE_MISMATCH'
  | 'SNAPSHOT_HASH_MISMATCH'
  | 'GENERATION_IDEMPOTENCY_CONFLICT'
  | 'DOCUMENT_SERVICE_UNAVAILABLE'
  | 'DOCUMENT_SERVICE_TIMEOUT'
  | 'DOCUMENT_SERVICE_FORBIDDEN'
  | 'DOCUMENT_SERVICE_INVALID_RESPONSE'
  | 'DOCUMENT_GENERATION_FAILED'
  | 'DOCUMENT_STORAGE_FAILED'
  | 'PDF_EXPORT_FAILED'
  | 'INTERNAL_ERROR';

export class ApplicationError extends Error {
  constructor(
    readonly code: ApplicationErrorCode,
    message: string,
    readonly cause?: unknown,
    readonly details?: { path: string; message: string },
  ) {
    super(message);
    this.name = 'ApplicationError';
  }
}

export type OpportunityContext = {
  id: string;
  name: string;
  company: {
    id: string;
    name: string;
  } | null;
  amount: number | null;
  currencyCode: string | null;
};

export type DraftPayloadSnapshot = {
  source: {
    object: 'opportunity';
    recordId: string;
  };
  templateCode: string;
  language: string;
  idempotencyKey: string;
};

export type CommercialProposalGenerationFile = {
  id?: string;
  format: 'xlsx' | 'pdf';
  fileName: string;
  contentType: string;
  size: number;
  sha256: string;
  storageKey?: string;
  downloadUrl?: string;
  downloadUrlExpiresAt?: string;
  twentyFileId?: string;
  twentyFileUrl?: string;
};

export type CommercialProposalResultMetadataV1 = {
  schemaVersion?: '1.0';
  generationId: string;
  generationIdempotencyKey: string;
  templateCode: 'mikoton-commercial-proposal';
  templateVersion: '1';
  files: CommercialProposalGenerationFile[];
};

export type CommercialProposalResultMetadataV2 = {
  schemaVersion: '2.0';
  snapshotHash: string;
  generationId: string;
  generationIdempotencyKey: string;
  templateCode: 'mikoton-commercial-proposal';
  templateVersion: '2';
  files: CommercialProposalGenerationFile[];
};

export type CommercialProposalResultMetadata =
  | CommercialProposalResultMetadataV1
  | CommercialProposalResultMetadataV2;

export type CommercialProposalDraft = {
  id: string;
  title: string;
  number: string;
  finalNumberKey: string | null;
  status: CommercialProposalStatus;
  version: number;
  contentModelVersion: CommercialProposalContentModelVersion;
  editorRevision: number;
  lastEditorOperationId: string | null;
  sourceType: CommercialProposalSourceType;
  templateCode: string;
  templateVersion: string | null;
  language: string;
  payloadSnapshot:
    | DraftPayloadSnapshot
    | DocumentGenerationPayloadV1
    | DocumentGenerationPayloadV2
    | null;
  resultMetadata: CommercialProposalResultMetadata | Record<string, unknown> | null;
  opportunityId: string;
  companyId: string | null;
  contactName: string | null;
  contextAndGoal: string | null;
  validityDays: number;
  paymentTerms: string | null;
  assumptions: string | null;
  nextStep: string | null;
  amount: number | null;
  currencyCode: string | null;
  generatedAt: string | null;
  idempotencyKey: string;
  lastError: string | null;
};

export type CreateDraftRequest = {
  source: {
    object: string;
    recordId: string;
  };
  templateCode: string;
  language: string;
  idempotencyKey: string;
};

export type CreateDraftInput = {
  source: {
    object: 'opportunity';
    recordId: string;
  };
  templateCode: typeof SUPPORTED_TEMPLATE_CODE;
  language: typeof SUPPORTED_LANGUAGE;
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
  getCommercialProposal: (
    commercialProposalId: string,
  ) => Promise<CommercialProposalDraft>;
  updateCommercialProposal: (
    commercialProposalId: string,
    patch: Partial<Omit<CommercialProposalDraft, 'id'>>,
  ) => Promise<CommercialProposalDraft>;
  listCommercialProposalFinalNumberKeys?: (year: number) => Promise<string[]>;
  attachGeneratedFiles?: (
    commercialProposalId: string,
    files: CommercialProposalGenerationFile[],
  ) => Promise<CommercialProposalGenerationFile[]>;
  attachGeneratedFile?: (
    commercialProposalId: string,
    file: CommercialProposalGenerationFile,
  ) => Promise<CommercialProposalGenerationFile>;
  getCommercialProposalAggregate?: (
    commercialProposalId: string,
  ) => Promise<CommercialProposalAggregate>;
  getCompanyContext?: (
    companyId: string,
  ) => Promise<{ id: string; name: string } | null>;
  createGenerationClaim?: (
    claim: {
      proposalKey: string;
      operationId: string;
      ownerToken: string;
      editorRevision: number;
      fingerprint: string;
      leaseExpiresAt: string;
    },
  ) => Promise<{
    id: string;
    proposalKey: string;
    operationId: string;
    ownerToken: string;
    editorRevision: number;
    fingerprint: string;
    leaseExpiresAt: string;
    createdAt?: string | null;
  }>;
  findGenerationClaimByProposalKey?: (
    proposalKey: string,
  ) => Promise<{
    id: string;
    proposalKey: string;
    operationId: string;
    ownerToken: string;
    editorRevision: number;
    fingerprint: string;
    leaseExpiresAt: string;
    createdAt?: string | null;
  } | null>;
  deleteGenerationClaim?: (id: string) => Promise<void>;
  renewGenerationClaimLease?: (input: {
    claimId: string;
    proposalKey: string;
    operationId: string;
    ownerToken: string;
    leaseExpiresAt: string;
  }) => Promise<{
    id: string;
    proposalKey: string;
    operationId: string;
    ownerToken: string;
    editorRevision: number;
    fingerprint: string;
    leaseExpiresAt: string;
    createdAt?: string | null;
  }>;
  isDuplicateConflict?: (error: unknown) => boolean;
};

export type GenerateCommercialProposalRequest = {
  commercialProposalId?: string;
  idempotencyKey?: string;
};

export type GenerateCommercialProposalInput = {
  commercialProposalId: string;
  idempotencyKey: string;
};

export type DocumentGenerationPayloadV1 = {
  schemaVersion: '1.0';
  templateCode: 'mikoton-commercial-proposal';
  templateVersion: '1';
  proposal: {
    id: string;
    number: string;
    title: string;
    date: string;
    language: 'ru-RU';
    currencyCode: string;
    validityDays: number;
  };
  customer: {
    companyId: string | null;
    companyName: string;
    contactName: string;
  };
  contractor: {
    name: string;
    email: string;
  };
  content: {
    contextAndGoal: string;
    workItems: Array<{
      position: number;
      block: string;
      description: string;
      quantity: number;
      unit: string;
      rate: number;
      discount: number;
    }>;
    plan: Array<{
      position: number;
      title: string;
      result: string;
      duration: string;
    }>;
    paymentTerms: string;
    assumptions: string;
    nextStep: string;
  };
};

export type DocumentGenerationPayloadV2 = {
  schemaVersion: '2.0';
  templateCode: 'mikoton-commercial-proposal';
  templateVersion: '2';
  proposal: {
    id: string;
    number: string;
    title: string;
    date: string;
    language: 'ru-RU';
    currencyCode: string;
    validityDays: number;
    amount: number;
  };
  customer: {
    companyId: string | null;
    companyName: string;
    contactName: string;
  };
  contractor: { name: string; email: string };
  content: {
    contextAndGoal: string;
    workItems: Array<{
      position: number;
      block: string;
      name: string;
      description: string;
      quantity: number;
      unit: string;
      unitPrice: number;
      discountPercent: number;
      lineAmount: number;
      currencyCode: string;
    }>;
    plan: Array<{
      position: number;
      title: string;
      result: string;
      duration: string;
      description: string;
    }>;
    paymentTerms: string;
    assumptions: string;
    nextStep: string;
  };
};

export type DocumentGenerationPayload =
  | DocumentGenerationPayloadV1
  | DocumentGenerationPayloadV2;

export type DocumentGenerationResult = {
  status: 'success';
  generationId: string;
  templateCode: 'mikoton-commercial-proposal';
  templateVersion: '1' | '2';
  schemaVersion?: '1.0' | '2.0';
  snapshotHash?: string;
  generatedAt: string;
  files: CommercialProposalGenerationFile[];
};

export type DocumentGenerationClient = {
  generate: (request: {
    requestId: string;
    idempotencyKey: string;
    snapshotHash?: string;
    payload: DocumentGenerationPayload;
    requestedFormats: Array<'xlsx' | 'pdf'>;
  }) => Promise<DocumentGenerationResult>;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const NUMBER_RETRY_LIMIT = 20;
const DRAFT_RETRY_LIMIT = 3;
const MAX_YEARLY_PROPOSAL_SEQUENCE = 999;
const FINAL_PROPOSAL_NUMBER_REGEX =
  /^КП-(?<sequence>\d{3}) от (?<day>\d{2})\.(?<month>\d{2})\.(?<year>\d{4})$/;

const getRequiredString = (value: unknown, fieldName: string) => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ApplicationError('INVALID_INPUT', `${fieldName} is required`);
  }

  return value;
};

export const normalizeCreateDraftRequest = (
  body: Partial<CreateDraftRequest> | undefined,
): CreateDraftInput => {
  if (body === undefined || body === null) {
    throw new ApplicationError('INVALID_INPUT', 'Request body is required');
  }

  const source = body.source;

  if (source === undefined || source === null) {
    throw new ApplicationError('INVALID_INPUT', 'source is required');
  }

  if (source.object !== 'opportunity') {
    throw new ApplicationError(
      'UNSUPPORTED_SOURCE',
      'Only opportunity source is supported',
    );
  }

  const sourceRecordId = getRequiredString(source.recordId, 'source.recordId');
  const requestIdempotencyKey = getRequiredString(
    body.idempotencyKey,
    'idempotencyKey',
  );

  if (!UUID_REGEX.test(requestIdempotencyKey)) {
    throw new ApplicationError('INVALID_INPUT', 'idempotencyKey must be a UUID');
  }

  const templateCode = body.templateCode ?? SUPPORTED_TEMPLATE_CODE;
  const language = body.language ?? SUPPORTED_LANGUAGE;

  if (templateCode !== SUPPORTED_TEMPLATE_CODE) {
    throw new ApplicationError('INVALID_INPUT', 'Unsupported templateCode');
  }

  if (language !== SUPPORTED_LANGUAGE) {
    throw new ApplicationError('INVALID_INPUT', 'Unsupported language');
  }

  return {
    source: {
      object: 'opportunity',
      recordId: sourceRecordId,
    },
    templateCode,
    language,
    idempotencyKey: requestIdempotencyKey,
  };
};

export const normalizeGenerateCommercialProposalRequest = (
  body: GenerateCommercialProposalRequest | undefined,
): GenerateCommercialProposalInput => {
  if (body === undefined || body === null) {
    throw new ApplicationError('INVALID_INPUT', 'Request body is required');
  }

  const commercialProposalId = getRequiredString(
    body.commercialProposalId,
    'commercialProposalId',
  );
  const idempotencyKey = getRequiredString(
    body.idempotencyKey,
    'idempotencyKey',
  );

  if (!UUID_REGEX.test(commercialProposalId)) {
    throw new ApplicationError(
      'INVALID_INPUT',
      'commercialProposalId must be a UUID',
    );
  }

  if (!UUID_REGEX.test(idempotencyKey)) {
    throw new ApplicationError('INVALID_INPUT', 'idempotencyKey must be a UUID');
  }

  return { commercialProposalId, idempotencyKey };
};

export const getCommercialProposalBusinessDate = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';

  const day = get('day');
  const month = get('month');
  const yearText = get('year');
  return {
    year: Number(yearText),
    month,
    day,
    isoDate: `${yearText}-${month}-${day}`,
    displayDate: `${day}.${month}.${yearText}`,
  };
};

export const buildDraftTechnicalNumber = (idempotencyKey: string) =>
  `DRAFT-${idempotencyKey}`;

export const buildCommercialProposalNumber = (
  date = new Date(),
  sequence = 1,
) => {
  if (
    !Number.isInteger(sequence) ||
    sequence < 1 ||
    sequence > MAX_YEARLY_PROPOSAL_SEQUENCE
  ) {
    throw new ApplicationError(
      'COMMERCIAL_PROPOSAL_NUMBER_LIMIT_REACHED',
      'Номер коммерческого предложения должен быть в диапазоне 001..999',
    );
  }

  const businessDate = getCommercialProposalBusinessDate(date);
  return `КП-${String(sequence).padStart(3, '0')} от ${businessDate.displayDate}`;
};

export const buildCommercialProposalFinalNumberKey = (
  date: Date,
  sequence: number,
) => `${getCommercialProposalBusinessDate(date).year}:${String(sequence).padStart(3, '0')}`;

export const parseCommercialProposalFinalNumberKey = (value: string) => {
  const match = /^(?<year>\d{4}):(?<sequence>\d{3})$/.exec(value);
  if (match?.groups === undefined) return null;
  const sequence = Number(match.groups.sequence);
  if (sequence < 1 || sequence > MAX_YEARLY_PROPOSAL_SEQUENCE) return null;
  return { year: Number(match.groups.year), sequence };
};

export const parseCommercialProposalNumber = (number: string) => {
  const match = FINAL_PROPOSAL_NUMBER_REGEX.exec(number);

  if (match?.groups === undefined) {
    return null;
  }

  return {
    sequence: Number(match.groups.sequence),
    year: Number(match.groups.year),
  };
};

export const isFinalCommercialProposalNumber = (number: string) =>
  parseCommercialProposalNumber(number) !== null;

export const getNextCommercialProposalSequence = (
  numbers: string[],
  date = new Date(),
) => {
  const targetYear = getCommercialProposalBusinessDate(date).year;
  const maxSequence = numbers.reduce((max, number) => {
    const parsed = parseCommercialProposalNumber(number);

    if (parsed === null || parsed.year !== targetYear) {
      return max;
    }

    return Math.max(max, parsed.sequence);
  }, 0);

  const nextSequence = maxSequence + 1;

  if (nextSequence > MAX_YEARLY_PROPOSAL_SEQUENCE) {
    throw new ApplicationError(
      'COMMERCIAL_PROPOSAL_NUMBER_LIMIT_REACHED',
      'Исчерпан годовой диапазон номеров коммерческих предложений 001..999',
    );
  }

  return nextSequence;
};

export const getNextCommercialProposalSequenceFromKeys = (
  keys: string[],
  date = new Date(),
) => {
  const targetYear = getCommercialProposalBusinessDate(date).year;
  const maxSequence = keys.reduce((max, key) => {
    const parsed = parseCommercialProposalFinalNumberKey(key);
    return parsed?.year === targetYear ? Math.max(max, parsed.sequence) : max;
  }, 0);
  if (maxSequence >= MAX_YEARLY_PROPOSAL_SEQUENCE) {
    throw new ApplicationError(
      'COMMERCIAL_PROPOSAL_NUMBER_LIMIT_REACHED',
      'Исчерпан годовой диапазон номеров коммерческих предложений 001..999',
    );
  }
  return maxSequence + 1;
};

const isDuplicateConflict = (
  repository: CommercialProposalRepository,
  error: unknown,
) => {
  if (repository.isDuplicateConflict?.(error)) {
    return true;
  }

  const message = error instanceof Error ? error.message : String(error);
  return /duplicate|unique|already exists|constraint/i.test(message);
};

export const createCommercialProposalDraft = async ({
  input,
  repository,
}: {
  input: CreateDraftInput;
  repository: CommercialProposalRepository;
  now?: Date;
}) => {
  const existingDraft = await repository.findDraftByIdempotencyKey(
    input.idempotencyKey,
  );

  if (existingDraft !== null) {
    return {
      draft: existingDraft,
      created: false,
    };
  }

  let opportunity: OpportunityContext;

  try {
    opportunity = await repository.getOpportunityContext(input.source.recordId);
  } catch (error) {
    if (error instanceof ApplicationError) {
      throw error;
    }

    throw new ApplicationError(
      'OPPORTUNITY_NOT_FOUND',
      'Сделка не найдена или недоступна',
      error,
    );
  }

  const payloadSnapshot: DraftPayloadSnapshot = {
    source: input.source,
    templateCode: input.templateCode,
    language: input.language,
    idempotencyKey: input.idempotencyKey,
  };

  for (let attempt = 0; attempt < DRAFT_RETRY_LIMIT; attempt += 1) {
    const number = 'Черновик';
    const title = `Черновик КП - ${opportunity.name}`;

    try {
      const draft = await repository.createDraft({
        title,
        number,
        finalNumberKey: null,
        status: 'DRAFT',
        version: 1,
        contentModelVersion: 'AGGREGATE_V2',
        editorRevision: 1,
        lastEditorOperationId: null,
        sourceType: 'OPPORTUNITY',
        templateCode: input.templateCode,
        templateVersion: null,
        language: input.language,
        payloadSnapshot,
        resultMetadata: null,
        opportunityId: opportunity.id,
        companyId: opportunity.company?.id ?? null,
        contactName: null,
        contextAndGoal: null,
        validityDays: 14,
        paymentTerms: null,
        assumptions: null,
        nextStep: null,
        amount: 0,
        currencyCode: opportunity.currencyCode,
        generatedAt: null,
        idempotencyKey: input.idempotencyKey,
        lastError: null,
      });

      return {
        draft,
        created: true,
      };
    } catch (error) {
      if (!isDuplicateConflict(repository, error)) {
        throw new ApplicationError(
          'COMMERCIAL_PROPOSAL_CREATE_FAILED',
          'Не удалось создать черновик коммерческого предложения',
          error,
        );
      }

      const existingAfterConflict =
        await repository.findDraftByIdempotencyKey(input.idempotencyKey);

      if (existingAfterConflict !== null) {
        return {
          draft: existingAfterConflict,
          created: false,
        };
      }
    }
  }

  throw new ApplicationError(
    'COMMERCIAL_PROPOSAL_CREATE_FAILED',
    'Не удалось создать уникальный номер коммерческого предложения',
  );
};

export const buildDocumentGenerationPayload = ({
  draft,
  opportunity,
  now = new Date(),
}: {
  draft: CommercialProposalDraft;
  opportunity: OpportunityContext;
  now?: Date;
}): DocumentGenerationPayload => {
  const amount = draft.amount ?? opportunity.amount ?? 0;
  const currencyCode = draft.currencyCode ?? opportunity.currencyCode ?? 'RUB';
  const proposalDate = getCommercialProposalBusinessDate(now).isoDate;
  const companyName = opportunity.company?.name ?? 'Компания не указана';

  return {
    schemaVersion: '1.0',
    templateCode: 'mikoton-commercial-proposal',
    templateVersion: '1',
    proposal: {
      id: draft.id,
      number: draft.number,
      title: draft.title,
      date: proposalDate,
      language: 'ru-RU',
      currencyCode,
      validityDays: 14,
    },
    customer: {
      companyId: opportunity.company?.id ?? null,
      companyName,
      contactName: 'Не указан',
    },
    contractor: {
      name: 'Шибеев Роман',
      email: 'consulting@mikoton.ru',
    },
    content: {
      contextAndGoal: `Коммерческое предложение подготовлено по сделке «${opportunity.name}».`,
      workItems: [
        {
          position: 1,
          block: 'Работы',
          description: draft.title,
          quantity: 1,
          unit: 'проект',
          rate: amount,
          discount: 0,
        },
      ],
      plan: [
        {
          position: 1,
          title: 'Согласование и старт',
          result: 'Согласованный состав работ и дата запуска',
          duration: '1 день',
        },
      ],
      paymentTerms: 'Оплата: по согласованию сторон.',
      assumptions: 'Состав работ и сроки могут быть уточнены после согласования деталей.',
      nextStep: 'Согласовать состав работ, стоимость и дату старта.',
    },
  };
};

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }

  return value;
};

export const canonicalJson = (value: unknown) =>
  JSON.stringify(canonicalize(value));

const rotateRight = (value: number, bits: number) =>
  (value >>> bits) | (value << (32 - bits));

const SHA256_CONSTANTS = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

export const sha256Hex = (value: string) => {
  const bytes = Array.from(new TextEncoder().encode(value));
  const bitLength = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  for (let shift = 56; shift >= 0; shift -= 8) {
    bytes.push(shift >= 32 ? 0 : (bitLength >>> shift) & 0xff);
  }

  const hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];
  for (let offset = 0; offset < bytes.length; offset += 64) {
    const words = new Array<number>(64).fill(0);
    for (let index = 0; index < 16; index += 1) {
      const base = offset + index * 4;
      words[index] =
        ((bytes[base] ?? 0) << 24) |
        ((bytes[base + 1] ?? 0) << 16) |
        ((bytes[base + 2] ?? 0) << 8) |
        (bytes[base + 3] ?? 0);
    }
    for (let index = 16; index < 64; index += 1) {
      const x = words[index - 15] ?? 0;
      const y = words[index - 2] ?? 0;
      const s0 = rotateRight(x, 7) ^ rotateRight(x, 18) ^ (x >>> 3);
      const s1 = rotateRight(y, 17) ^ rotateRight(y, 19) ^ (y >>> 10);
      words[index] = ((words[index - 16] ?? 0) + s0 + (words[index - 7] ?? 0) + s1) | 0;
    }
    let [a, b, c, d, e, f, g, h] = hash;
    for (let index = 0; index < 64; index += 1) {
      const s1 = rotateRight(e!, 6) ^ rotateRight(e!, 11) ^ rotateRight(e!, 25);
      const choice = (e! & f!) ^ (~e! & g!);
      const temp1 = (h! + s1 + choice + SHA256_CONSTANTS[index]! + words[index]!) | 0;
      const s0 = rotateRight(a!, 2) ^ rotateRight(a!, 13) ^ rotateRight(a!, 22);
      const majority = (a! & b!) ^ (a! & c!) ^ (b! & c!);
      const temp2 = (s0 + majority) | 0;
      [h, g, f, e, d, c, b, a] = [g!, f!, e!, (d! + temp1) | 0, c!, b!, a!, (temp1 + temp2) | 0];
    }
    [a, b, c, d, e, f, g, h].forEach((entry, index) => {
      hash[index] = ((hash[index] ?? 0) + entry!) | 0;
    });
  }
  return hash.map((entry) => (entry >>> 0).toString(16).padStart(8, '0')).join('');
};

export const calculateSnapshotHash = (payload: DocumentGenerationPayload) =>
  sha256Hex(canonicalJson(payload));

const generationValidationError = (message: string) =>
  new ApplicationError(
    'COMMERCIAL_PROPOSAL_GENERATION_VALIDATION_FAILED',
    message,
  );

export const validateAggregateForGeneration = (
  aggregate: CommercialProposalAggregate,
) => {
  const { proposal, items, stages } = aggregate;

  if (proposal.contentModelVersion !== 'AGGREGATE_V2') {
    throw generationValidationError('Commercial proposal must use AGGREGATE_V2');
  }
  if (proposal.status !== 'DRAFT' && proposal.status !== 'FAILED') {
    throw new ApplicationError(
      'COMMERCIAL_PROPOSAL_INVALID_STATUS',
      'Документ можно сформировать только из статуса DRAFT или FAILED',
    );
  }
  if (items.length === 0) throw generationValidationError('Добавьте хотя бы одну строку работ');
  if (stages.length === 0) throw generationValidationError('Добавьте хотя бы один этап работ');
  if (proposal.currencyCode === null || proposal.currencyCode.trim() === '') {
    throw generationValidationError('Укажите валюту коммерческого предложения');
  }
  if (proposal.contactName === null || proposal.contactName.trim() === '') {
    throw new ApplicationError(
      'COMMERCIAL_PROPOSAL_GENERATION_VALIDATION_FAILED',
      'Укажите контакт заказчика',
      undefined,
      { path: 'proposal.contactName', message: 'Укажите контакт заказчика' },
    );
  }

  const unique = (values: string[], label: string) => {
    if (new Set(values).size !== values.length) {
      throw generationValidationError(`${label} must be unique`);
    }
  };
  const positions = (values: number[], label: string) => {
    if (values.some((value, index) => value !== index + 1)) {
      throw generationValidationError(`${label} positions must be normalized`);
    }
  };

  unique(items.map((item) => item.id), 'item ids');
  unique(items.map((item) => item.clientKey), 'item clientKeys');
  unique(stages.map((stage) => stage.id), 'stage ids');
  unique(stages.map((stage) => stage.clientKey), 'stage clientKeys');
  positions(items.map((item) => item.position), 'item');
  positions(stages.map((stage) => stage.position), 'stage');

  for (const item of items) {
    if (item.currencyCode !== proposal.currencyCode) {
      throw generationValidationError('Валюты строк должны совпадать с валютой КП');
    }
    const authoritative = calculateProposalLineAmount({
      quantity: String(item.quantity),
      unitPrice: String(item.unitPrice),
      discountPercent: String(item.discountPercent),
    }).lineAmount;
    if (authoritative !== item.lineAmount) {
      throw generationValidationError(`Некорректный итог строки ${item.position}`);
    }
  }

  for (const stage of stages) {
    if (
      stage.title.trim() === '' ||
      stage.result?.trim() === '' ||
      stage.result === null ||
      stage.duration?.trim() === '' ||
      stage.duration === null
    ) {
      throw generationValidationError(`Заполните название, результат и срок этапа ${stage.position}`);
    }
  }

  const total = sumLineAmounts(items.map((item) => item.lineAmount));
  if (total <= 0) throw generationValidationError('Итог КП должен быть больше нуля');
  if (proposal.amount !== total) {
    throw generationValidationError('Итог КП не совпадает с суммой строк');
  }
};

export const buildDocumentGenerationPayloadV2 = ({
  aggregate,
  company,
  now = new Date(),
}: {
  aggregate: CommercialProposalAggregate;
  company: { id: string; name: string } | null;
  now?: Date;
}): DocumentGenerationPayloadV2 => {
  validateAggregateForGeneration(aggregate);
  const proposal = aggregate.proposal;

  return {
    schemaVersion: '2.0',
    templateCode: 'mikoton-commercial-proposal',
    templateVersion: '2',
    proposal: {
      id: proposal.id,
      number: proposal.number,
      title: proposal.title,
      date: getCommercialProposalBusinessDate(now).isoDate,
      language: 'ru-RU',
      currencyCode: proposal.currencyCode as string,
      validityDays: proposal.validityDays,
      amount: proposal.amount as number,
    },
    customer: {
      companyId: proposal.companyId,
      companyName: company?.name ?? 'Компания не указана',
      contactName: proposal.contactName as string,
    },
    contractor: { name: 'Шибеев Роман', email: 'consulting@mikoton.ru' },
    content: {
      contextAndGoal: proposal.contextAndGoal ?? '',
      workItems: aggregate.items.map((item) => ({
        position: item.position,
        block: item.block,
        name: item.name,
        description: item.description ?? '',
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        discountPercent: item.discountPercent,
        lineAmount: item.lineAmount,
        currencyCode: item.currencyCode,
      })),
      plan: aggregate.stages.map((stage) => ({
        position: stage.position,
        title: stage.title,
        result: stage.result as string,
        duration: stage.duration as string,
        description: stage.description ?? '',
      })),
      paymentTerms: proposal.paymentTerms ?? '',
      assumptions: proposal.assumptions ?? '',
      nextStep: proposal.nextStep ?? '',
    },
  };
};

const hasGenerationResult = (
  metadata: CommercialProposalDraft['resultMetadata'],
  idempotencyKey: string,
): metadata is CommercialProposalResultMetadata =>
  metadata !== null &&
  typeof metadata === 'object' &&
  'generationIdempotencyKey' in metadata &&
  metadata.generationIdempotencyKey === idempotencyKey &&
  'files' in metadata &&
  Array.isArray(metadata.files);

const getFinalProposalNumber = async ({
  draft,
  repository,
  now,
}: {
  draft: CommercialProposalDraft;
  repository: CommercialProposalRepository;
  now: Date;
}) => {
  const parsedNumber = parseCommercialProposalNumber(draft.number);
  if (parsedNumber !== null) {
    return {
      number: draft.number,
      finalNumberKey:
        draft.finalNumberKey ??
        `${parsedNumber.year}:${String(parsedNumber.sequence).padStart(3, '0')}`,
    };
  }

  const businessDate = getCommercialProposalBusinessDate(now);
  const keys = await repository.listCommercialProposalFinalNumberKeys?.(
    businessDate.year,
  );
  const nextSequence = getNextCommercialProposalSequenceFromKeys(keys ?? [], now);

  return {
    number: buildCommercialProposalNumber(now, nextSequence),
    finalNumberKey: buildCommercialProposalFinalNumberKey(now, nextSequence),
  };
};

export const generateCommercialProposalDocuments = async ({
  input,
  repository,
  documentClient,
  now = new Date(),
}: {
  input: GenerateCommercialProposalInput;
  repository: CommercialProposalRepository;
  documentClient: DocumentGenerationClient;
  now?: Date;
}) => {
  const {
    acquireGenerationClaim,
    assertGenerationClaimOwnership,
    calculateGenerationContentFingerprint,
    isOwnershipLostError,
    releaseGenerationClaim,
    renewGenerationClaimLease,
  } = await import('src/domain/generation-claim');

  let draft = await repository.getCommercialProposal(input.commercialProposalId);

  if (
    draft.status === 'GENERATED' &&
    hasGenerationResult(draft.resultMetadata, input.idempotencyKey)
  ) {
    return {
      commercialProposal: draft,
      generated: false,
      result: draft.resultMetadata,
    };
  }

  if (
    draft.status !== 'DRAFT' &&
    draft.status !== 'FAILED' &&
    draft.status !== 'GENERATING'
  ) {
    throw new ApplicationError(
      'COMMERCIAL_PROPOSAL_INVALID_STATUS',
      'Документ можно сформировать только из статуса DRAFT или FAILED',
    );
  }

  if (
    repository.createGenerationClaim === undefined ||
    repository.findGenerationClaimByProposalKey === undefined ||
    repository.deleteGenerationClaim === undefined
  ) {
    throw new ApplicationError(
      'INTERNAL_ERROR',
      'Generation claim repository is not configured',
    );
  }

  const claimRepository = {
    createGenerationClaim: repository.createGenerationClaim,
    findGenerationClaimByProposalKey: repository.findGenerationClaimByProposalKey,
    deleteGenerationClaim: repository.deleteGenerationClaim,
    renewGenerationClaimLease: repository.renewGenerationClaimLease,
    isDuplicateConflict: repository.isDuplicateConflict,
  };

  let aggregate =
    draft.contentModelVersion === 'AGGREGATE_V2'
      ? await repository.getCommercialProposalAggregate?.(draft.id)
      : undefined;

  if (draft.contentModelVersion === 'AGGREGATE_V2' && aggregate === undefined) {
    throw new ApplicationError(
      'COMMERCIAL_PROPOSAL_GENERATION_VALIDATION_FAILED',
      'Не удалось загрузить сохранённый состав коммерческого предложения',
    );
  }

  if (aggregate !== undefined) validateAggregateForGeneration(aggregate);

  const fingerprint = calculateGenerationContentFingerprint({ draft, aggregate });
  const acquired = await acquireGenerationClaim({
    repository: claimRepository,
    proposalKey: draft.id,
    operationId: input.idempotencyKey,
    editorRevision: draft.editorRevision,
    fingerprint,
    now,
  });

  if (acquired.state === 'IN_PROGRESS') {
    const latest = await repository.getCommercialProposal(input.commercialProposalId);
    if (
      latest.status === 'GENERATED' &&
      hasGenerationResult(latest.resultMetadata, input.idempotencyKey)
    ) {
      return {
        commercialProposal: latest,
        generated: false,
        result: latest.resultMetadata,
      };
    }
    throw new ApplicationError(
      'COMMERCIAL_PROPOSAL_GENERATION_IN_PROGRESS',
      'Формирование документов для этого коммерческого предложения уже выполняется',
    );
  }

  let claim = acquired.claim;

  const requireOwnership = async () => {
    claim = await assertGenerationClaimOwnership({
      repository: claimRepository,
      claim,
    });
    return claim;
  };

  try {
    await requireOwnership();
    draft = await repository.getCommercialProposal(input.commercialProposalId);
    if (
      draft.status === 'GENERATED' &&
      hasGenerationResult(draft.resultMetadata, input.idempotencyKey)
    ) {
      await releaseGenerationClaim({ repository: claimRepository, claim });
      claim = null as never;
      return {
        commercialProposal: draft,
        generated: false,
        result: draft.resultMetadata,
      };
    }

    if (draft.status !== 'DRAFT' && draft.status !== 'FAILED' && draft.status !== 'GENERATING') {
      throw new ApplicationError(
        'COMMERCIAL_PROPOSAL_INVALID_STATUS',
        'Документ можно сформировать только из статуса DRAFT или FAILED',
      );
    }

    aggregate =
      draft.contentModelVersion === 'AGGREGATE_V2'
        ? await repository.getCommercialProposalAggregate?.(draft.id)
        : undefined;
    if (draft.contentModelVersion === 'AGGREGATE_V2' && aggregate === undefined) {
      throw new ApplicationError(
        'COMMERCIAL_PROPOSAL_GENERATION_VALIDATION_FAILED',
        'Не удалось загрузить сохранённый состав коммерческого предложения',
      );
    }
    if (aggregate !== undefined) validateAggregateForGeneration(aggregate);

    const latestFingerprint = calculateGenerationContentFingerprint({
      draft,
      aggregate,
    });
    if (
      draft.editorRevision !== claim.editorRevision ||
      latestFingerprint !== claim.fingerprint
    ) {
      throw new ApplicationError(
        'COMMERCIAL_PROPOSAL_EDITOR_CONFLICT',
        'Коммерческое предложение изменилось перед началом генерации',
      );
    }

    const opportunity = await repository
      .getOpportunityContext(draft.opportunityId)
      .catch((error) => {
        if (aggregate === undefined) throw error;
        return null;
      });
    let company: { id: string; name: string } | null = null;
    if (draft.companyId !== null) {
      try {
        company = (await repository.getCompanyContext?.(draft.companyId)) ?? null;
      } catch (error) {
        throw new ApplicationError(
          'COMMERCIAL_PROPOSAL_GENERATION_VALIDATION_FAILED',
          'Компания коммерческого предложения не найдена или недоступна',
          error,
        );
      }
      if (
        aggregate !== undefined &&
        (company === null || company.id !== draft.companyId)
      ) {
        throw new ApplicationError(
          'COMMERCIAL_PROPOSAL_GENERATION_VALIDATION_FAILED',
          'Компания коммерческого предложения не найдена или недоступна',
        );
      }
    }

    let generationDraft = draft;
    let payload: DocumentGenerationPayload | null = null;

    for (let attempt = 0; attempt < NUMBER_RETRY_LIMIT; attempt += 1) {
      await requireOwnership();
      const finalNumber = await getFinalProposalNumber({
        draft: generationDraft,
        repository,
        now,
      });
      const finalDraft: CommercialProposalDraft = {
        ...generationDraft,
        number: finalNumber.number,
        finalNumberKey: finalNumber.finalNumberKey,
        title:
          aggregate === undefined
            ? `${finalNumber.number} - ${opportunity?.name ?? draft.title}`
            : draft.title,
        templateCode: 'mikoton-commercial-proposal',
        templateVersion: aggregate === undefined ? '1' : '2',
      };
      payload =
        aggregate === undefined
          ? buildDocumentGenerationPayload({
              draft: finalDraft,
              opportunity: opportunity as OpportunityContext,
              now,
            })
          : buildDocumentGenerationPayloadV2({
              aggregate: {
                ...aggregate,
                proposal: finalDraft,
              },
              company,
              now,
            });

      if (aggregate !== undefined) {
        const latest = await repository.getCommercialProposalAggregate?.(draft.id);
        if (latest?.proposal.editorRevision !== aggregate.proposal.editorRevision) {
          throw new ApplicationError(
            'COMMERCIAL_PROPOSAL_EDITOR_CONFLICT',
            'Коммерческое предложение изменилось перед началом генерации',
          );
        }
      }

      try {
        await requireOwnership();
        generationDraft = await repository.updateCommercialProposal(draft.id, {
          title: finalDraft.title,
          number: finalDraft.number,
          finalNumberKey: finalDraft.finalNumberKey,
          status: 'GENERATING',
          templateCode: 'mikoton-commercial-proposal',
          templateVersion: payload.templateVersion,
          payloadSnapshot: payload,
          lastError: null,
          generatedAt: null,
        });
        break;
      } catch (error) {
        if (isOwnershipLostError(error)) throw error;
        if (!isDuplicateConflict(repository, error)) {
          throw error;
        }

        if (attempt === NUMBER_RETRY_LIMIT - 1) {
          throw new ApplicationError(
            'COMMERCIAL_PROPOSAL_CREATE_FAILED',
            'Не удалось выделить уникальный номер коммерческого предложения',
            error,
          );
        }

        generationDraft = {
          ...generationDraft,
          number: draft.number,
          finalNumberKey: draft.finalNumberKey,
        };
      }
    }

    if (payload === null) {
      throw new ApplicationError(
        'COMMERCIAL_PROPOSAL_CREATE_FAILED',
        'Не удалось подготовить данные коммерческого предложения',
      );
    }

    claim = await renewGenerationClaimLease({
      repository: claimRepository,
      claim,
      now,
    });

    const preCallDraft = await repository.getCommercialProposal(draft.id);
    const preCallAggregate =
      preCallDraft.contentModelVersion === 'AGGREGATE_V2'
        ? await repository.getCommercialProposalAggregate?.(draft.id)
        : undefined;
    const preCallFingerprint = calculateGenerationContentFingerprint({
      draft: preCallDraft,
      aggregate: preCallAggregate,
    });
    if (
      preCallDraft.editorRevision !== claim.editorRevision ||
      preCallFingerprint !== claim.fingerprint
    ) {
      throw new ApplicationError(
        'COMMERCIAL_PROPOSAL_EDITOR_CONFLICT',
        'Коммерческое предложение изменилось перед вызовом document-service',
      );
    }

    const snapshotHash = calculateSnapshotHash(payload);

    try {
      await requireOwnership();
      const result = await documentClient.generate({
        requestId: input.idempotencyKey,
        idempotencyKey: input.idempotencyKey,
        snapshotHash,
        payload,
        requestedFormats: ['xlsx', 'pdf'],
      });
      await requireOwnership();
      claim = await renewGenerationClaimLease({
        repository: claimRepository,
        claim,
        now: new Date(),
      });

      if (
        result.templateVersion !== payload.templateVersion ||
        (result.schemaVersion !== undefined &&
          result.schemaVersion !== payload.schemaVersion)
      ) {
        throw new ApplicationError(
          'DOCUMENT_SCHEMA_TEMPLATE_MISMATCH',
          'Document service returned a mismatched schema/template version',
        );
      }
      if (result.snapshotHash !== undefined && result.snapshotHash !== snapshotHash) {
        throw new ApplicationError(
          'SNAPSHOT_HASH_MISMATCH',
          'Document service returned a different snapshot hash',
        );
      }

      let attachedFiles =
        draft.resultMetadata !== null &&
        typeof draft.resultMetadata === 'object' &&
        'generationId' in draft.resultMetadata &&
        draft.resultMetadata.generationId === result.generationId &&
        'files' in draft.resultMetadata &&
        Array.isArray(draft.resultMetadata.files)
          ? (draft.resultMetadata.files as CommercialProposalGenerationFile[])
          : [];

      let resultMetadata: CommercialProposalResultMetadata = {
        schemaVersion: payload.schemaVersion,
        ...(payload.schemaVersion === '2.0' ? { snapshotHash } : {}),
        generationId: result.generationId,
        generationIdempotencyKey: input.idempotencyKey,
        templateCode: result.templateCode,
        templateVersion: result.templateVersion,
        files: attachedFiles,
      } as CommercialProposalResultMetadata;

      for (const file of result.files) {
        await requireOwnership();
        const existing = attachedFiles.find(
          (attached) =>
            attached.format === file.format &&
            attached.sha256 === file.sha256 &&
            attached.twentyFileId !== undefined,
        );
        if (existing !== undefined) continue;

        const attached = repository.attachGeneratedFile
          ? await repository.attachGeneratedFile(draft.id, file)
          : ((await repository.attachGeneratedFiles?.(draft.id, [file])) ?? [file])[0];
        if (attached === undefined) {
          throw new ApplicationError(
            'DOCUMENT_STORAGE_FAILED',
            `Generated ${file.format.toUpperCase()} file was not attached`,
          );
        }
        attachedFiles = [
          ...attachedFiles.filter((entry) => entry.format !== attached.format),
          attached,
        ];
        resultMetadata = { ...resultMetadata, files: attachedFiles };
        await requireOwnership();
        generationDraft = await repository.updateCommercialProposal(draft.id, {
          resultMetadata,
        });
      }

      await requireOwnership();
      const updated = await repository.updateCommercialProposal(draft.id, {
        status: 'GENERATED',
        templateCode: 'mikoton-commercial-proposal',
        templateVersion: payload.templateVersion,
        resultMetadata,
        generatedAt: result.generatedAt,
        lastError: null,
      });

      await releaseGenerationClaim({ repository: claimRepository, claim });
      claim = null as never;

      return {
        commercialProposal: updated,
        generated: true,
        result: resultMetadata,
      };
    } catch (error) {
      if (isOwnershipLostError(error)) {
        throw error;
      }
      try {
        await requireOwnership();
        await repository.updateCommercialProposal(draft.id, {
          status: 'FAILED',
          generatedAt: null,
          lastError:
            error instanceof ApplicationError
              ? error.message
              : 'Не удалось сформировать документы коммерческого предложения',
        });
        await releaseGenerationClaim({ repository: claimRepository, claim });
        claim = null as never;
      } catch (ownershipError) {
        if (isOwnershipLostError(ownershipError)) {
          throw ownershipError;
        }
        throw error;
      }

      if (error instanceof ApplicationError) {
        throw error;
      }

      throw new ApplicationError(
        'DOCUMENT_GENERATION_FAILED',
        'Не удалось сформировать документы коммерческого предложения',
        error,
      );
    }
  } catch (error) {
    if (!isOwnershipLostError(error)) {
      await releaseGenerationClaim({ repository: claimRepository, claim });
    }
    throw error;
  }
};
