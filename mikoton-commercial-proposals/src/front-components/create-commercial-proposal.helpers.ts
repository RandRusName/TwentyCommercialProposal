import {
  SUPPORTED_LANGUAGE,
  SUPPORTED_TEMPLATE_CODE,
} from 'src/domain/commercial-proposal';

export const CREATE_IDEMPOTENCY_KEY_ERROR =
  'Ваш браузер не поддерживает безопасную генерацию идентификатора операции';

export const IDEMPOTENCY_SETUP_ERROR =
  'Не удалось подготовить безопасный идентификатор операции.\nОбновите браузер или обратитесь к администратору.';

export const createIdempotencyKey = (): string => {
  if (globalThis.crypto?.randomUUID !== undefined) {
    return globalThis.crypto.randomUUID();
  }

  if (globalThis.crypto?.getRandomValues === undefined) {
    throw new Error(CREATE_IDEMPOTENCY_KEY_ERROR);
  }

  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
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
