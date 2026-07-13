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
  companyId: string | null;
  companyName: string | null;
  amount: number | null;
  currency: string | null;
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
  resultMetadata: Record<string, unknown> | null;
  opportunityId: string;
  companyId: string | null;
  amount: number | null;
  currency: string | null;
  generatedAt: string | null;
  idempotencyKey: string;
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

export type DeprecatedCreateDraftRequest = {
  opportunityId?: string;
  idempotencyKey?: string;
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
  isDuplicateConflict?: (error: unknown) => boolean;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SUFFIX_ALPHABET = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const NUMBER_RETRY_LIMIT = 3;

const getRequiredString = (value: unknown, fieldName: string) => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ApplicationError('INVALID_INPUT', `${fieldName} is required`);
  }

  return value;
};

export const normalizeCreateDraftRequest = (
  body: Partial<CreateDraftRequest & DeprecatedCreateDraftRequest> | undefined,
): CreateDraftInput => {
  if (body === undefined || body === null) {
    throw new ApplicationError('INVALID_INPUT', 'Request body is required');
  }

  const source =
    body.source ??
    (body.opportunityId === undefined
      ? undefined
      : { object: 'opportunity', recordId: body.opportunityId });

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

export const buildCommercialProposalNumberSuffix = () => {
  const randomValues = new Uint8Array(4);

  if (globalThis.crypto?.getRandomValues !== undefined) {
    globalThis.crypto.getRandomValues(randomValues);
  } else {
    for (let index = 0; index < randomValues.length; index += 1) {
      randomValues[index] = Math.floor(Math.random() * 256);
    }
  }

  return Array.from(randomValues, (value) => {
    const alphabetIndex = value % SUFFIX_ALPHABET.length;
    return SUFFIX_ALPHABET[alphabetIndex];
  }).join('');
};

export const buildCommercialProposalNumber = (
  date = new Date(),
  suffix = buildCommercialProposalNumberSuffix(),
) => {
  const yyyy = date.getUTCFullYear();
  const mm = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const dd = `${date.getUTCDate()}`.padStart(2, '0');
  const hh = `${date.getUTCHours()}`.padStart(2, '0');
  const mi = `${date.getUTCMinutes()}`.padStart(2, '0');
  const ss = `${date.getUTCSeconds()}`.padStart(2, '0');

  return `CP-${yyyy}${mm}${dd}-${hh}${mi}${ss}-${suffix}`;
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
  now = new Date(),
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
    const number = buildCommercialProposalNumber(now);
    const title = `${number} - ${opportunity.name}`;

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
        companyId: opportunity.companyId,
        amount: opportunity.amount,
        currency: opportunity.currency ?? 'RUB',
        generatedAt: null,
        idempotencyKey: input.idempotencyKey,
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
