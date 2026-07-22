import {
  calculateProposalLineAmount,
  sumLineAmounts,
} from 'src/domain/commercial-proposal-money';
import type { SaveEditorRequest } from 'src/domain/commercial-proposal-aggregate';
import type {
  CommercialProposalDraft,
  CommercialProposalGenerationFile,
} from 'src/domain/commercial-proposal';
import { createIdempotencyKey } from 'src/front-components/create-commercial-proposal.helpers';
import type {
  EditorContextResponse,
  CatalogItemOption,
  EditorItem,
  EditorStage,
  EditorState,
  EditorValidation,
  PendingGenerationAttempt,
} from 'src/front-components/commercial-proposal-editor/editor-types';

export const normalizeDecimalInput = (value: string) =>
  value.trim().replace(',', '.');

export const getGeneratedDocumentFiles = (
  metadata: CommercialProposalDraft['resultMetadata'],
): CommercialProposalGenerationFile[] => {
  if (
    metadata === null ||
    typeof metadata !== 'object' ||
    !('files' in metadata) ||
    !Array.isArray(metadata.files)
  ) {
    return [];
  }

  return metadata.files.filter(
    (file): file is CommercialProposalGenerationFile =>
      typeof file === 'object' &&
      file !== null &&
      'format' in file &&
      (file.format === 'xlsx' || file.format === 'pdf') &&
      'fileName' in file &&
      typeof file.fileName === 'string' &&
      (('twentyFileUrl' in file && typeof file.twentyFileUrl === 'string') ||
        ('downloadUrl' in file && typeof file.downloadUrl === 'string')),
  );
};

export const getGeneratedDocumentFileUrl = (
  file: CommercialProposalGenerationFile,
  now = new Date(),
) => {
  if (typeof file.twentyFileUrl === 'string' && file.twentyFileUrl !== '') {
    return file.twentyFileUrl;
  }
  if (typeof file.downloadUrl !== 'string' || file.downloadUrl === '') return null;
  if (
    typeof file.downloadUrlExpiresAt === 'string' &&
    Date.parse(file.downloadUrlExpiresAt) <= now.getTime()
  ) {
    return null;
  }
  return file.downloadUrl;
};

export const createEmptyItem = (): EditorItem => ({
  catalogItemId: null,
  clientKey: createIdempotencyKey(),
  block: '',
  name: '',
  description: '',
  quantity: '1',
  unit: '',
  unitPrice: '0',
  discountPercent: '0',
});

export const duplicateItem = (item: EditorItem): EditorItem => ({
  ...item,
  id: undefined,
  clientKey: createIdempotencyKey(),
});

export const createEmptyStage = (): EditorStage => ({
  clientKey: createIdempotencyKey(),
  title: '',
  result: '',
  duration: '',
  description: '',
});

export const duplicateStage = (stage: EditorStage): EditorStage => ({
  ...stage,
  id: undefined,
  clientKey: createIdempotencyKey(),
});

export const moveEntry = <T>(entries: T[], index: number, offset: -1 | 1) => {
  const target = index + offset;

  if (target < 0 || target >= entries.length) {
    return entries;
  }

  const next = [...entries];
  [next[index], next[target]] = [next[target] as T, next[index] as T];
  return next;
};

export const removeEntry = <T>(entries: T[], index: number) =>
  entries.filter((_, entryIndex) => entryIndex !== index);

export const applyCanonicalResponse = (
  context: EditorContextResponse,
): EditorState => ({
  proposalId: context.proposal.id,
  editorRevision: context.proposal.editorRevision,
  contentModelVersion: context.proposal.contentModelVersion,
  status: context.proposal.status,
  number: context.proposal.number,
  amount: context.proposal.amount,
  header: {
    title: context.proposal.title,
    companyId: context.proposal.companyId,
    contactName: context.proposal.contactName,
    contextAndGoal: context.proposal.contextAndGoal,
    currencyCode: context.proposal.currencyCode,
    validityDays: context.proposal.validityDays,
    paymentTerms: context.proposal.paymentTerms,
    assumptions: context.proposal.assumptions,
    nextStep: context.proposal.nextStep,
  },
  items: context.items.map((item) => ({
    id: item.id,
    catalogItemId: item.catalogItemId,
    clientKey: item.clientKey,
    block: item.block,
    name: item.name,
    description: item.description ?? '',
    quantity: String(item.quantity),
    unit: item.unit,
    unitPrice: String(item.unitPrice),
    discountPercent: String(item.discountPercent),
  })),
  stages: context.stages.map((stage) => ({
    id: stage.id,
    clientKey: stage.clientKey,
    title: stage.title,
    result: stage.result ?? '',
    duration: stage.duration ?? '',
    description: stage.description ?? '',
  })),
});

const validateMoney = (item: EditorItem, index: number, errors: Record<string, string>) => {
  const checks = [
    ['quantity', item.quantity, 'Количество должно быть больше 0 и содержать не более 4 знаков после запятой'],
    ['unitPrice', item.unitPrice, 'Ставка должна быть неотрицательной и содержать не более 2 знаков после запятой'],
    ['discountPercent', item.discountPercent, 'Скидка должна быть от 0 до 100 и содержать не более 2 знаков после запятой'],
  ] as const;

  for (const [field, value, message] of checks) {
    try {
      calculateProposalLineAmount({
        quantity: field === 'quantity' ? normalizeDecimalInput(value) : '1',
        unitPrice: field === 'unitPrice' ? normalizeDecimalInput(value) : '0',
        discountPercent:
          field === 'discountPercent' ? normalizeDecimalInput(value) : '0',
      });
    } catch {
      errors[`items.${index}.${field}`] = message;
    }
  }
};

export const validateEditorState = (state: EditorState): EditorValidation => {
  const errors: Record<string, string> = {};

  if (state.header.title.trim() === '') errors.title = 'Укажите заголовок';
  if (!Number.isInteger(state.header.validityDays) || state.header.validityDays <= 0) {
    errors.validityDays = 'Срок действия должен быть положительным целым числом';
  }
  if (state.items.length > 0 && (state.header.currencyCode?.trim() ?? '') === '') {
    errors.currencyCode = 'Укажите валюту';
  }
  state.items.forEach((item, index) => {
    if (item.block.trim() === '') errors[`items.${index}.block`] = 'Укажите блок';
    if (item.name.trim() === '') errors[`items.${index}.name`] = 'Укажите наименование';
    if (item.unit.trim() === '') errors[`items.${index}.unit`] = 'Укажите единицу';
    validateMoney(item, index, errors);
  });
  state.stages.forEach((stage, index) => {
    if (stage.title.trim() === '') errors[`stages.${index}.title`] = 'Укажите название';
  });

  return { valid: Object.keys(errors).length === 0, errors };
};

export const buildSaveRequest = (
  state: EditorState,
  operationId = createIdempotencyKey(),
): SaveEditorRequest => ({
  operationId,
  editorRevision: state.editorRevision,
  header: {
    ...state.header,
    title: state.header.title.trim(),
    currencyCode: state.header.currencyCode?.trim().toUpperCase() || null,
  },
  items: state.items.map((item) => ({
    id: item.id,
    catalogItemId: item.catalogItemId,
    clientKey: item.clientKey,
    block: item.block.trim(),
    name: item.name.trim(),
    description: item.description.trim() || null,
    quantity: normalizeDecimalInput(item.quantity),
    unit: item.unit.trim(),
    unitPrice: normalizeDecimalInput(item.unitPrice),
    discountPercent: normalizeDecimalInput(item.discountPercent),
  })),
  stages: state.stages.map((stage) => ({
    id: stage.id,
    clientKey: stage.clientKey,
    title: stage.title.trim(),
    result: stage.result.trim() || null,
    duration: stage.duration.trim() || null,
    description: stage.description.trim() || null,
  })),
});

export const isEditorDirty = (current: EditorState, canonical: EditorState) =>
  JSON.stringify(current) !== JSON.stringify(canonical);

export const isEditorLoadCurrent = ({
  requestSequence,
  latestSequence,
  requestProposalId,
  currentProposalId,
}: {
  requestSequence: number;
  latestSequence: number;
  requestProposalId: string;
  currentProposalId: string | null;
}) =>
  requestSequence === latestSequence && requestProposalId === currentProposalId;

export const getEditorGenerationFingerprint = (state: EditorState) =>
  JSON.stringify({
    proposalId: state.proposalId,
    editorRevision: state.editorRevision,
    header: state.header,
    items: state.items.map(({ id: _id, ...item }) => item),
    stages: state.stages.map(({ id: _id, ...stage }) => stage),
  });

export const resolvePendingGenerationAttempt = (
  current: PendingGenerationAttempt | null,
  state: EditorState,
): PendingGenerationAttempt => {
  const snapshotFingerprint = getEditorGenerationFingerprint(state);
  if (
    current?.proposalId === state.proposalId &&
    current.editorRevision === state.editorRevision &&
    current.snapshotFingerprint === snapshotFingerprint
  ) {
    return current;
  }
  return {
    operationId: createIdempotencyKey(),
    proposalId: state.proposalId,
    editorRevision: state.editorRevision,
    snapshotFingerprint,
  };
};

export const getLocalizedProposalStatus = (
  status: EditorState['status'],
  locale: 'ru-RU' | 'en' = 'ru-RU',
) => {
  const labels = {
    'ru-RU': {
      DRAFT: 'Черновик', GENERATING: 'Формируется', GENERATED: 'Сформировано',
      SENT: 'Отправлено', ACCEPTED: 'Принято', REJECTED: 'Отклонено',
      FAILED: 'Ошибка', CANCELLED: 'Отменено',
    },
    en: {
      DRAFT: 'Draft', GENERATING: 'Generating', GENERATED: 'Generated',
      SENT: 'Sent', ACCEPTED: 'Accepted', REJECTED: 'Rejected',
      FAILED: 'Failed', CANCELLED: 'Cancelled',
    },
  } as const;
  return labels[locale][status];
};

export const calculatePreview = (state: EditorState) => {
  try {
    return sumLineAmounts(
      state.items.map(
        (item) =>
          calculateProposalLineAmount({
          quantity: normalizeDecimalInput(item.quantity),
          unitPrice: normalizeDecimalInput(item.unitPrice),
          discountPercent: normalizeDecimalInput(item.discountPercent),
          }).lineAmount,
      ),
    );
  } catch {
    return null;
  }
};

export const isAggregateReadyForGeneration = (
  state: EditorState,
  validation = validateEditorState(state),
  preview = calculatePreview(state),
) =>
  state.header.contactName?.trim() !== '' &&
  state.header.contactName !== null &&
  state.items.length > 0 &&
  state.stages.length > 0 &&
  state.stages.every(
    (stage) =>
      stage.title.trim() !== '' &&
      stage.result.trim() !== '' &&
      stage.duration.trim() !== '',
  ) &&
  validation.valid &&
  (preview ?? 0) > 0;

export const normalizeCurrencyCode = (value: string | null | undefined) =>
  value?.trim().toUpperCase() || null;

export const resolveCurrencyWhenAddingCatalogItems = ({
  currentCurrency,
  catalogCurrencies,
}: {
  currentCurrency: string | null | undefined;
  catalogCurrencies: Array<string | null | undefined>;
}):
  | { ok: true; currencyCode: string }
  | { ok: false; reason: 'mixed' | 'mismatch' | 'missing' } => {
  const normalizedCatalog = catalogCurrencies.map(normalizeCurrencyCode);
  const currencyCode = normalizedCatalog[0] ?? null;
  if (currencyCode === null || normalizedCatalog.some((entry) => entry !== currencyCode)) {
    return { ok: false, reason: currencyCode === null ? 'missing' : 'mixed' };
  }
  const headerCurrency = normalizeCurrencyCode(currentCurrency);
  if (headerCurrency !== null && headerCurrency !== currencyCode) {
    return { ok: false, reason: 'mismatch' };
  }
  return { ok: true, currencyCode };
};

export const formatMoney = (amount: number | null, currencyCode: string | null) => {
  if (amount === null) return 'Не указано';
  const currency = currencyCode?.trim().toUpperCase();

  if (currency !== undefined && /^[A-Z]{3}$/.test(currency)) {
    try {
      return new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency,
      }).format(amount);
    } catch {
      // Use numeric fallback below.
    }
  }

  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(amount)}${currency === undefined ? '' : ` ${currency}`}`;
};

export const getProposalDisplayNumber = (number: string) =>
  number === 'Черновик' || number.startsWith('DRAFT-') ? 'Черновик' : number;

export const createStarterItem = (
  suggestion: EditorContextResponse['legacySuggestion'],
): EditorItem => ({
  ...createEmptyItem(),
  block: 'Работы',
  name: suggestion.suggestedTitle ?? 'Работы по проекту',
  unit: 'проект',
  unitPrice: String(suggestion.amount ?? 0),
});

export const createEditorItemFromCatalogItem = (
  catalogItem: CatalogItemOption,
): EditorItem => ({
  catalogItemId: catalogItem.id,
  clientKey: createIdempotencyKey(),
  block: catalogItem.defaultBlock,
  name: catalogItem.name,
  description: catalogItem.description ?? '',
  quantity: '1',
  unit: catalogItem.defaultUnit,
  unitPrice: String(catalogItem.defaultPrice),
  discountPercent: '0',
});
