import {
  SUPPORTED_LANGUAGE,
  SUPPORTED_TEMPLATE_CODE,
} from 'src/domain/commercial-proposal';

export const CREATE_IDEMPOTENCY_KEY_ERROR =
  'Ваш браузер не поддерживает безопасную генерацию идентификатора операции';

export const IDEMPOTENCY_SETUP_ERROR =
  'Не удалось подготовить безопасный идентификатор операции.\nОбновите браузер или обратитесь к администратору.';

export const createIdempotencyKey = (): string => {
  if (globalThis.crypto?.randomUUID === undefined) {
    throw new Error(CREATE_IDEMPOTENCY_KEY_ERROR);
  }

  return globalThis.crypto.randomUUID();
};

export const formatAmount = (amount: number | null, currencyCode: string | null) => {
  if (amount === null) {
    return 'Сумма не указана';
  }

  return `${amount.toLocaleString('ru-RU')} ${currencyCode ?? ''}`.trim();
};

export const isCreateDraftDisabled = ({
  isCreating,
  isLoadingContext,
  hasOpportunity,
  hasDraft,
  hasIdempotencyKey,
}: {
  isCreating: boolean;
  isLoadingContext: boolean;
  hasOpportunity: boolean;
  hasDraft: boolean;
  hasIdempotencyKey: boolean;
}) =>
  isCreating ||
  isLoadingContext ||
  !hasOpportunity ||
  hasDraft ||
  !hasIdempotencyKey;

export const getSafeErrorMessage = (
  caughtError: unknown,
  fallbackMessage: string,
) => {
  if (!(caughtError instanceof Error)) {
    return fallbackMessage;
  }

  if (/\n\s*at\s|graphql|bearer|token|secret|stack trace/i.test(caughtError.message)) {
    return fallbackMessage;
  }

  return caughtError.message;
};

export const buildCreateDraftRequest = ({
  opportunityId,
  idempotencyKey,
}: {
  opportunityId: string;
  idempotencyKey: string;
}) => ({
  source: {
    object: 'opportunity',
    recordId: opportunityId,
  },
  templateCode: SUPPORTED_TEMPLATE_CODE,
  language: SUPPORTED_LANGUAGE,
  idempotencyKey,
});
