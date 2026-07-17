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
  format: 'xlsm' | 'pdf';
  fileName: string;
  contentType: string;
  size: number;
  sha256: string;
  storageKey?: string;
  downloadUrl: string;
  downloadUrlExpiresAt?: string;
  twentyFileId?: string;
  twentyFileUrl?: string;
};

export type CommercialProposalResultMetadata = {
  generationId: string;
  generationIdempotencyKey: string;
  templateCode: 'mikoton-commercial-proposal';
  templateVersion: '1';
  files: CommercialProposalGenerationFile[];
};

export type CommercialProposalDraft = {
  id: string;
  title: string;
  number: string;
  status: CommercialProposalStatus;
  sourceType: CommercialProposalSourceType;
  templateCode: string;
  templateVersion: string | null;
  language: string;
  payloadSnapshot: DraftPayloadSnapshot | null;
  resultMetadata: CommercialProposalResultMetadata | Record<string, unknown> | null;
  opportunityId: string;
  companyId: string | null;
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
  listCommercialProposalNumbers?: () => Promise<string[]>;
  attachGeneratedFiles?: (
    commercialProposalId: string,
    files: CommercialProposalGenerationFile[],
  ) => Promise<CommercialProposalGenerationFile[]>;
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

export type DocumentGenerationPayload = {
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

export type DocumentGenerationResult = {
  status: 'success';
  generationId: string;
  templateCode: 'mikoton-commercial-proposal';
  templateVersion: '1';
  generatedAt: string;
  files: CommercialProposalGenerationFile[];
};

export type DocumentGenerationClient = {
  generate: (request: {
    requestId: string;
    idempotencyKey: string;
    payload: DocumentGenerationPayload;
    requestedFormats: Array<'xlsm' | 'pdf'>;
  }) => Promise<DocumentGenerationResult>;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const NUMBER_RETRY_LIMIT = 3;
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

const getMoscowDateParts = (date: Date) => {
  const parts = new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';

  return {
    day: get('day'),
    month: get('month'),
    year: get('year'),
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

  const { day, month, year } = getMoscowDateParts(date);
  return `КП-${String(sequence).padStart(3, '0')} от ${day}.${month}.${year}`;
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
  const targetYear = Number(getMoscowDateParts(date).year);
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

  for (let attempt = 0; attempt < NUMBER_RETRY_LIMIT; attempt += 1) {
    const number = buildDraftTechnicalNumber(input.idempotencyKey);
    const title = `Черновик КП - ${opportunity.name}`;

    try {
      const draft = await repository.createDraft({
        title,
        number,
        status: 'DRAFT',
        sourceType: 'OPPORTUNITY',
        templateCode: input.templateCode,
        templateVersion: null,
        language: input.language,
        payloadSnapshot,
        resultMetadata: null,
        opportunityId: opportunity.id,
        companyId: opportunity.company?.id ?? null,
        amount: opportunity.amount,
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
  const proposalDate = now.toISOString().slice(0, 10);
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
  if (isFinalCommercialProposalNumber(draft.number)) {
    return draft.number;
  }

  const numbers = await repository.listCommercialProposalNumbers?.();
  const nextSequence = getNextCommercialProposalSequence(numbers ?? [], now);

  return buildCommercialProposalNumber(now, nextSequence);
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
  const draft = await repository.getCommercialProposal(input.commercialProposalId);

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

  if (draft.status !== 'DRAFT' && draft.status !== 'FAILED') {
    throw new ApplicationError(
      'COMMERCIAL_PROPOSAL_INVALID_STATUS',
      'Документ можно сформировать только из статуса DRAFT или FAILED',
    );
  }

  const opportunity = await repository.getOpportunityContext(draft.opportunityId);
  let generationDraft = draft;
  let payload: DocumentGenerationPayload | null = null;

  for (let attempt = 0; attempt < NUMBER_RETRY_LIMIT; attempt += 1) {
    const finalNumber = await getFinalProposalNumber({
      draft: generationDraft,
      repository,
      now,
    });
    const finalDraft = {
      ...generationDraft,
      number: finalNumber,
      title: `${finalNumber} - ${opportunity.name}`,
      templateCode: 'mikoton-commercial-proposal',
      templateVersion: '1',
    };
    payload = buildDocumentGenerationPayload({
      draft: finalDraft,
      opportunity,
      now,
    });

    try {
      generationDraft = await repository.updateCommercialProposal(draft.id, {
        title: finalDraft.title,
        number: finalDraft.number,
        status: 'GENERATING',
        templateCode: 'mikoton-commercial-proposal',
        templateVersion: '1',
        payloadSnapshot: payload as unknown as DraftPayloadSnapshot,
        lastError: null,
        generatedAt: null,
      });
      break;
    } catch (error) {
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
        number: buildDraftTechnicalNumber(generationDraft.idempotencyKey),
      };
    }
  }

  if (payload === null) {
    throw new ApplicationError(
      'COMMERCIAL_PROPOSAL_CREATE_FAILED',
      'Не удалось подготовить данные коммерческого предложения',
    );
  }

  try {
    const result = await documentClient.generate({
      requestId: input.idempotencyKey,
      idempotencyKey: input.idempotencyKey,
      payload,
      requestedFormats: ['xlsm', 'pdf'],
    });

    const attachedFiles =
      (await repository.attachGeneratedFiles?.(draft.id, result.files)) ??
      result.files;

    const resultMetadata: CommercialProposalResultMetadata = {
      generationId: result.generationId,
      generationIdempotencyKey: input.idempotencyKey,
      templateCode: result.templateCode,
      templateVersion: result.templateVersion,
      files: attachedFiles,
    };

    const updated = await repository.updateCommercialProposal(draft.id, {
      status: 'GENERATED',
      templateCode: 'mikoton-commercial-proposal',
      templateVersion: '1',
      resultMetadata,
      generatedAt: result.generatedAt,
      lastError: null,
    });

    return {
      commercialProposal: updated,
      generated: true,
      result: resultMetadata,
    };
  } catch (error) {
    await repository.updateCommercialProposal(draft.id, {
      status: 'FAILED',
      generatedAt: null,
      lastError:
        error instanceof ApplicationError
          ? error.message
          : 'Не удалось сформировать документы коммерческого предложения',
    });

    if (error instanceof ApplicationError) {
      throw error;
    }

    throw new ApplicationError(
      'DOCUMENT_GENERATION_FAILED',
      'Не удалось сформировать документы коммерческого предложения',
      error,
    );
  }
};
