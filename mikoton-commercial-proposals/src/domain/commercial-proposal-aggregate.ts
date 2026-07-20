import {
  ApplicationError,
  type CommercialProposalDraft,
  type CommercialProposalStatus,
} from 'src/domain/commercial-proposal';
import {
  calculateProposalLineAmount,
  sumLineAmounts,
} from 'src/domain/commercial-proposal-money';

export type CommercialProposalContentModelVersion =
  | 'LEGACY_V1'
  | 'AGGREGATE_V2';

export type CommercialProposalHeader = {
  title: string;
  companyId: string | null;
  contactName: string | null;
  contextAndGoal: string | null;
  currencyCode: string | null;
  validityDays: number;
  paymentTerms: string | null;
  assumptions: string | null;
  nextStep: string | null;
};

export type CommercialProposalItem = {
  id: string;
  commercialProposalId: string;
  clientKey: string;
  position: number;
  block: string;
  name: string;
  description: string | null;
  quantity: number;
  unit: string;
  unitPrice: number;
  discountPercent: number;
  lineAmount: number;
  currencyCode: string;
};

export type CommercialProposalStage = {
  id: string;
  commercialProposalId: string;
  clientKey: string;
  position: number;
  title: string;
  result: string | null;
  duration: string | null;
  description: string | null;
};

export type CommercialProposalAggregate = {
  proposal: CommercialProposalDraft & {
    version: number;
    contentModelVersion: CommercialProposalContentModelVersion;
    editorRevision: number;
    lastEditorOperationId: string | null;
    contactName: string | null;
    contextAndGoal: string | null;
    validityDays: number;
    paymentTerms: string | null;
    assumptions: string | null;
    nextStep: string | null;
  };
  items: CommercialProposalItem[];
  stages: CommercialProposalStage[];
};

export type SaveEditorItemInput = {
  id?: string;
  clientKey: string;
  block: string;
  name: string;
  description?: string | null;
  quantity: string;
  unit: string;
  unitPrice: string;
  discountPercent: string;
};

export type SaveEditorStageInput = {
  id?: string;
  clientKey: string;
  title: string;
  result?: string | null;
  duration?: string | null;
  description?: string | null;
};

export type SaveEditorRequest = {
  operationId: string;
  editorRevision: number;
  header: CommercialProposalHeader;
  items: SaveEditorItemInput[];
  stages: SaveEditorStageInput[];
};

export type SaveEditorResult = CommercialProposalAggregate & {
  saved: boolean;
  replayed: boolean;
};

export type RecalculateRequest = {
  currencyCode: string | null;
  items: RecalculateItemInput[];
};

export type RecalculateItemInput = {
  clientKey: string;
  quantity: string;
  unitPrice: string;
  discountPercent: string;
};

export type RecalculateResult = {
  currencyCode: string | null;
  amount: number;
  items: Array<{
    clientKey: string;
    position: number;
    quantity: number;
    unitPrice: number;
    discountPercent: number;
    lineAmount: number;
    currencyCode: string | null;
  }>;
};

export type NormalizedEditorItem = Omit<
  CommercialProposalItem,
  'id' | 'commercialProposalId'
> & {
  id?: string;
};

export type NormalizedEditorStage = Omit<
  CommercialProposalStage,
  'id' | 'commercialProposalId'
> & {
  id?: string;
};

export type NormalizedSaveEditorRequest = {
  operationId: string;
  editorRevision: number;
  header: CommercialProposalHeader;
  items: NormalizedEditorItem[];
  stages: NormalizedEditorStage[];
  nextContentModelVersion: CommercialProposalContentModelVersion;
  amount: number;
};

export type CommercialProposalAggregateRepository = {
  getCommercialProposalAggregate: (
    id: string,
  ) => Promise<CommercialProposalAggregate>;
  findItemByParentAndClientKey: (
    proposalId: string,
    clientKey: string,
  ) => Promise<CommercialProposalItem | null>;
  findStageByParentAndClientKey: (
    proposalId: string,
    clientKey: string,
  ) => Promise<CommercialProposalStage | null>;
  upsertItem: (
    proposalId: string,
    item: NormalizedEditorItem,
  ) => Promise<CommercialProposalItem>;
  upsertStage: (
    proposalId: string,
    stage: NormalizedEditorStage,
  ) => Promise<CommercialProposalStage>;
  deleteItem: (id: string) => Promise<void>;
  deleteStage: (id: string) => Promise<void>;
  updateCommercialProposalForEditor: (
    id: string,
    patch: {
      header: CommercialProposalHeader;
      amount: number;
      contentModelVersion: CommercialProposalContentModelVersion;
      editorRevision: number;
      lastEditorOperationId: string;
    },
  ) => Promise<void>;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const EDITABLE_STATUSES = new Set<CommercialProposalStatus>(['DRAFT', 'FAILED']);

const assertUniqueValues = (
  values: Array<string | undefined>,
  fieldName: string,
) => {
  const presentValues = values.filter((value): value is string => value !== undefined);

  if (new Set(presentValues).size !== presentValues.length) {
    throw new ApplicationError(
      'COMMERCIAL_PROPOSAL_VALIDATION_FAILED',
      `${fieldName} values must be unique`,
    );
  }
};

const requireUuid = (value: unknown, fieldName: string) => {
  if (typeof value !== 'string' || !UUID_REGEX.test(value)) {
    throw new ApplicationError(
      'COMMERCIAL_PROPOSAL_VALIDATION_FAILED',
      `${fieldName} must be a UUID`,
    );
  }

  return value;
};

export const validateCommercialProposalId = (value: unknown) =>
  requireUuid(value, 'proposalId');

const optionalUuid = (value: unknown, fieldName: string) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  return requireUuid(value, fieldName);
};

const requireString = (value: unknown, fieldName: string) => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ApplicationError(
      'COMMERCIAL_PROPOSAL_VALIDATION_FAILED',
      `${fieldName} is required`,
    );
  }

  return value.trim();
};

const optionalString = (value: unknown) =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null;

const assertPlainObjectEntries: (
  values: unknown[],
  fieldName: string,
) => asserts values is Record<string, unknown>[] = (
  values: unknown[],
  fieldName: string,
) => {
  values.forEach((value, index) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new ApplicationError(
        'COMMERCIAL_PROPOSAL_VALIDATION_FAILED',
        `${fieldName}[${index}] must be an object`,
      );
    }
  });
};

const normalizeHeader = (value: unknown): CommercialProposalHeader => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ApplicationError(
      'COMMERCIAL_PROPOSAL_VALIDATION_FAILED',
      'header is required',
    );
  }

  const header = value as Record<string, unknown>;
  const validityDays = Number(header.validityDays);

  if (!Number.isInteger(validityDays) || validityDays <= 0) {
    throw new ApplicationError(
      'COMMERCIAL_PROPOSAL_VALIDATION_FAILED',
      'validityDays must be a positive integer',
    );
  }

  return {
    title: requireString(header.title, 'header.title'),
    companyId: optionalUuid(header.companyId, 'header.companyId'),
    contactName: optionalString(header.contactName),
    contextAndGoal: optionalString(header.contextAndGoal),
    currencyCode: optionalString(header.currencyCode),
    validityDays,
    paymentTerms: optionalString(header.paymentTerms),
    assumptions: optionalString(header.assumptions),
    nextStep: optionalString(header.nextStep),
  };
};

export const normalizeSaveEditorRequest = (
  body: Partial<SaveEditorRequest> | null | undefined,
): SaveEditorRequest => {
  if (body === undefined || body === null) {
    throw new ApplicationError(
      'COMMERCIAL_PROPOSAL_VALIDATION_FAILED',
      'Request body is required',
    );
  }

  if (!Array.isArray(body.items) || !Array.isArray(body.stages)) {
    throw new ApplicationError(
      'COMMERCIAL_PROPOSAL_VALIDATION_FAILED',
      'items and stages must be arrays',
    );
  }

  assertPlainObjectEntries(body.items, 'items');
  assertPlainObjectEntries(body.stages, 'stages');

  const editorRevision = body.editorRevision;

  if (
    typeof editorRevision !== 'number' ||
    !Number.isInteger(editorRevision) ||
    editorRevision < 1
  ) {
    throw new ApplicationError(
      'COMMERCIAL_PROPOSAL_VALIDATION_FAILED',
      'editorRevision must be a positive integer',
    );
  }

  assertUniqueValues(
    body.items.map((item) => item.clientKey),
    'items.clientKey',
  );
  assertUniqueValues(
    body.stages.map((stage) => stage.clientKey),
    'stages.clientKey',
  );
  assertUniqueValues(
    body.items.map((item) => item.id),
    'items.id',
  );
  assertUniqueValues(
    body.stages.map((stage) => stage.id),
    'stages.id',
  );

  return {
    operationId: requireUuid(body.operationId, 'operationId'),
    editorRevision,
    header: normalizeHeader(body.header),
    items: body.items,
    stages: body.stages,
  };
};

export const normalizeRecalculateRequest = (
  body: Partial<RecalculateRequest> | null | undefined,
): RecalculateRequest => {
  if (body === undefined || body === null || !Array.isArray(body.items)) {
    throw new ApplicationError(
      'COMMERCIAL_PROPOSAL_VALIDATION_FAILED',
      'items must be an array',
    );
  }


  assertPlainObjectEntries(body.items, 'items');

  return {
    currencyCode: optionalString(body.currencyCode),
    items: body.items,
  };
};

const normalizeItems = (
  items: SaveEditorItemInput[],
  currencyCode: string | null,
): NormalizedEditorItem[] =>
  items.map((item, index) => {
    const clientKey = requireUuid(item.clientKey, `items[${index}].clientKey`);
    const calculated = calculateProposalLineAmount({
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discountPercent: item.discountPercent,
    });

    if (currencyCode === null) {
      throw new ApplicationError(
        'COMMERCIAL_PROPOSAL_VALIDATION_FAILED',
        'currencyCode is required when items are present',
      );
    }

    return {
      id: optionalUuid(item.id, `items[${index}].id`) ?? undefined,
      clientKey,
      position: index + 1,
      block: requireString(item.block, `items[${index}].block`),
      name: requireString(item.name, `items[${index}].name`),
      description: optionalString(item.description),
      unit: requireString(item.unit, `items[${index}].unit`),
      currencyCode,
      ...calculated,
    };
  });

const normalizeRecalculateItems = (
  items: RecalculateItemInput[],
  currencyCode: string | null,
) => {
  assertUniqueValues(
    items.map((item) => item.clientKey),
    'items.clientKey',
  );

  return items.map((item, index) => {
    const clientKey = requireUuid(item.clientKey, `items[${index}].clientKey`);
    const calculated = calculateProposalLineAmount({
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discountPercent: item.discountPercent,
    });

    if (currencyCode === null) {
      throw new ApplicationError(
        'COMMERCIAL_PROPOSAL_VALIDATION_FAILED',
        'currencyCode is required when items are present',
      );
    }

    return {
      clientKey,
      position: index + 1,
      currencyCode,
      ...calculated,
    };
  });
};

const normalizeStages = (
  stages: SaveEditorStageInput[],
): NormalizedEditorStage[] =>
  stages.map((stage, index) => ({
    id: optionalUuid(stage.id, `stages[${index}].id`) ?? undefined,
    clientKey: requireUuid(stage.clientKey, `stages[${index}].clientKey`),
    position: index + 1,
    title: requireString(stage.title, `stages[${index}].title`),
    result: optionalString(stage.result),
    duration: optionalString(stage.duration),
    description: optionalString(stage.description),
  }));

export const ensureCommercialProposalEditable = (
  aggregate: CommercialProposalAggregate,
) => {
  if (!EDITABLE_STATUSES.has(aggregate.proposal.status)) {
    throw new ApplicationError(
      'COMMERCIAL_PROPOSAL_INVALID_STATUS',
      'Commercial proposal can be edited only in DRAFT or FAILED status',
    );
  }
};

const assertUniquePersistedClientKeys = (
  records: Array<{ clientKey: string }>,
  recordType: 'item' | 'stage',
) => {
  const keys = records.map((record) => record.clientKey);

  if (new Set(keys).size !== keys.length) {
    throw new ApplicationError(
      'COMMERCIAL_PROPOSAL_DATA_INTEGRITY_ERROR',
      `Commercial proposal contains duplicate persisted ${recordType} client keys`,
    );
  }
};

export const assertAggregateIntegrity = (
  aggregate: CommercialProposalAggregate,
) => {
  assertUniquePersistedClientKeys(aggregate.items, 'item');
  assertUniquePersistedClientKeys(aggregate.stages, 'stage');
};

const buildNormalizedSave = (
  aggregate: CommercialProposalAggregate,
  request: SaveEditorRequest,
): NormalizedSaveEditorRequest => {
  ensureCommercialProposalEditable(aggregate);
  assertUniqueValues(
    request.items.map((item) => item.clientKey),
    'items.clientKey',
  );
  assertUniqueValues(
    request.stages.map((stage) => stage.clientKey),
    'stages.clientKey',
  );
  assertUniqueValues(
    request.items.map((item) => item.id),
    'items.id',
  );
  assertUniqueValues(
    request.stages.map((stage) => stage.id),
    'stages.id',
  );

  if (aggregate.proposal.editorRevision !== request.editorRevision) {
    throw new ApplicationError(
      'COMMERCIAL_PROPOSAL_EDITOR_CONFLICT',
      'Commercial proposal was changed. Reload it and try again.',
    );
  }

  const normalizedItems = normalizeItems(request.items, request.header.currencyCode);
  const normalizedStages = normalizeStages(request.stages);
  const nextContentModelVersion =
    normalizedItems.length > 0
      ? 'AGGREGATE_V2'
      : aggregate.proposal.contentModelVersion;

  if (
    aggregate.proposal.contentModelVersion === 'AGGREGATE_V2' &&
    normalizedItems.length === 0
  ) {
    throw new ApplicationError(
      'COMMERCIAL_PROPOSAL_VALIDATION_FAILED',
      'Aggregate commercial proposal must contain at least one item',
    );
  }

  const amount =
    normalizedItems.length === 0
      ? aggregate.proposal.amount ?? 0
      : sumLineAmounts(normalizedItems.map((item) => item.lineAmount));

  return {
    operationId: request.operationId,
    editorRevision: request.editorRevision,
    header: request.header,
    items: normalizedItems,
    stages: normalizedStages,
    nextContentModelVersion,
    amount,
  };
};

const ensureChildOwnership = (
  aggregate: CommercialProposalAggregate,
  normalized: NormalizedSaveEditorRequest,
) => {
  const itemIds = new Set(aggregate.items.map((item) => item.id));
  const stageIds = new Set(aggregate.stages.map((stage) => stage.id));

  for (const item of normalized.items) {
    if (item.id !== undefined && !itemIds.has(item.id)) {
      throw new ApplicationError(
        'COMMERCIAL_PROPOSAL_CHILD_FORBIDDEN',
        'Commercial proposal item does not belong to this proposal',
      );
    }
  }

  for (const stage of normalized.stages) {
    if (stage.id !== undefined && !stageIds.has(stage.id)) {
      throw new ApplicationError(
        'COMMERCIAL_PROPOSAL_CHILD_FORBIDDEN',
        'Commercial proposal stage does not belong to this proposal',
      );
    }
  }
};

const ensureChildIdentity = async (
  proposalId: string,
  aggregate: CommercialProposalAggregate,
  normalized: NormalizedSaveEditorRequest,
  repository: CommercialProposalAggregateRepository,
) => {
  const itemsById = new Map(aggregate.items.map((item) => [item.id, item]));
  const stagesById = new Map(aggregate.stages.map((stage) => [stage.id, stage]));

  for (const item of normalized.items) {
    const existingById = item.id === undefined ? undefined : itemsById.get(item.id);
    const existingByKey = await repository.findItemByParentAndClientKey(
      proposalId,
      item.clientKey,
    );

    if (
      (existingById !== undefined && existingById.clientKey !== item.clientKey) ||
      (existingByKey !== null && item.id !== undefined && existingByKey.id !== item.id)
    ) {
      throw new ApplicationError(
        'COMMERCIAL_PROPOSAL_CHILD_IDENTITY_CONFLICT',
        'Commercial proposal item id and clientKey identify different records',
      );
    }
  }

  for (const stage of normalized.stages) {
    const existingById = stage.id === undefined ? undefined : stagesById.get(stage.id);
    const existingByKey = await repository.findStageByParentAndClientKey(
      proposalId,
      stage.clientKey,
    );

    if (
      (existingById !== undefined && existingById.clientKey !== stage.clientKey) ||
      (existingByKey !== null && stage.id !== undefined && existingByKey.id !== stage.id)
    ) {
      throw new ApplicationError(
        'COMMERCIAL_PROPOSAL_CHILD_IDENTITY_CONFLICT',
        'Commercial proposal stage id and clientKey identify different records',
      );
    }
  }
};

const assertCanonicalChildren = (
  persisted: CommercialProposalAggregate,
  normalized: NormalizedSaveEditorRequest,
) => {
  assertAggregateIntegrity(persisted);
  const requestedItemKeys = new Set(normalized.items.map((item) => item.clientKey));
  const requestedStageKeys = new Set(normalized.stages.map((stage) => stage.clientKey));
  const persistedItemKeys = new Set(persisted.items.map((item) => item.clientKey));
  const persistedStageKeys = new Set(persisted.stages.map((stage) => stage.clientKey));
  const sameSet = (left: Set<string>, right: Set<string>) =>
    left.size === right.size && [...left].every((value) => right.has(value));

  if (
    persisted.items.length !== normalized.items.length ||
    persisted.stages.length !== normalized.stages.length ||
    !sameSet(persistedItemKeys, requestedItemKeys) ||
    !sameSet(persistedStageKeys, requestedStageKeys)
  ) {
    throw new ApplicationError(
      'COMMERCIAL_PROPOSAL_SAVE_FAILED',
      'Persisted commercial proposal children do not match the requested aggregate',
    );
  }
};

export const buildEditorContext = (
  aggregate: CommercialProposalAggregate,
  displayContext?: {
    opportunity: {
      id: string;
      name: string;
      amount: number | null;
      currencyCode: string | null;
    } | null;
    company: { id: string; name: string } | null;
    warnings?: Array<
      'OPPORTUNITY_CONTEXT_UNAVAILABLE' | 'COMPANY_CONTEXT_UNAVAILABLE'
    >;
  },
) => ({
  ...aggregate,
  opportunity: displayContext?.opportunity ?? null,
  company: displayContext?.company ?? null,
  warnings: displayContext?.warnings ?? [],
  isEditable: EDITABLE_STATUSES.has(aggregate.proposal.status),
  generationAvailability: { allowed: true, reason: null },
  legacySuggestion:
    aggregate.proposal.contentModelVersion === 'LEGACY_V1' &&
    aggregate.items.length === 0 &&
    EDITABLE_STATUSES.has(aggregate.proposal.status)
      ? {
          canCreateStarterItem: true,
          amount: aggregate.proposal.amount,
          currencyCode: aggregate.proposal.currencyCode,
          suggestedTitle: aggregate.proposal.title,
        }
      : {
          canCreateStarterItem: false,
          amount: null,
          currencyCode: null,
          suggestedTitle: null,
        },
});

export const recalculateCommercialProposal = (
  request: RecalculateRequest,
): RecalculateResult => {
  const items = normalizeRecalculateItems(request.items, request.currencyCode);

  return {
    currencyCode: request.currencyCode,
    amount: sumLineAmounts(items.map((item) => item.lineAmount)),
    items: items.map((item) => ({
      clientKey: item.clientKey,
      position: item.position,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discountPercent: item.discountPercent,
      lineAmount: item.lineAmount,
      currencyCode: request.currencyCode,
    })),
  };
};

export const saveCommercialProposalEditor = async ({
  proposalId,
  request,
  repository,
}: {
  proposalId: string;
  request: SaveEditorRequest;
  repository: CommercialProposalAggregateRepository;
}): Promise<SaveEditorResult> => {
  requireUuid(proposalId, 'proposalId');
  const aggregate = await repository.getCommercialProposalAggregate(proposalId);
  assertAggregateIntegrity(aggregate);

  if (aggregate.proposal.lastEditorOperationId === request.operationId) {
    return {
      ...aggregate,
      saved: false,
      replayed: true,
    };
  }

  const normalized = buildNormalizedSave(aggregate, request);
  ensureChildOwnership(aggregate, normalized);
  await ensureChildIdentity(proposalId, aggregate, normalized, repository);

  for (const item of normalized.items) {
    const existingByKey = await repository.findItemByParentAndClientKey(
      proposalId,
      item.clientKey,
    );

    await repository.upsertItem(proposalId, {
      ...item,
      id: item.id ?? existingByKey?.id,
    });
  }

  for (const stage of normalized.stages) {
    const existingByKey = await repository.findStageByParentAndClientKey(
      proposalId,
      stage.clientKey,
    );

    await repository.upsertStage(proposalId, {
      ...stage,
      id: stage.id ?? existingByKey?.id,
    });
  }

  const persisted = await repository.getCommercialProposalAggregate(proposalId);
  assertAggregateIntegrity(persisted);
  const keptItemKeys = new Set(normalized.items.map((item) => item.clientKey));
  const keptStageKeys = new Set(normalized.stages.map((stage) => stage.clientKey));

  for (const item of persisted.items) {
    if (!keptItemKeys.has(item.clientKey)) {
      await repository.deleteItem(item.id);
    }
  }

  for (const stage of persisted.stages) {
    if (!keptStageKeys.has(stage.clientKey)) {
      await repository.deleteStage(stage.id);
    }
  }

  const canonical = await repository.getCommercialProposalAggregate(proposalId);
  assertCanonicalChildren(canonical, normalized);

  const finalRevisionAggregate =
    await repository.getCommercialProposalAggregate(proposalId);

  if (
    finalRevisionAggregate.proposal.editorRevision !==
    aggregate.proposal.editorRevision
  ) {
    throw new ApplicationError(
      'COMMERCIAL_PROPOSAL_EDITOR_CONFLICT',
      'Commercial proposal was changed during save. Reload it and try again.',
    );
  }

  const canonicalAmount =
    canonical.items.length === 0
      ? aggregate.proposal.amount ?? 0
      : sumLineAmounts(canonical.items.map((item) => item.lineAmount));

  await repository.updateCommercialProposalForEditor(proposalId, {
    header: normalized.header,
    amount: canonicalAmount,
    contentModelVersion: normalized.nextContentModelVersion,
    editorRevision: aggregate.proposal.editorRevision + 1,
    lastEditorOperationId: normalized.operationId,
  });

  const savedAggregate =
    await repository.getCommercialProposalAggregate(proposalId);

  return {
    ...savedAggregate,
    saved: true,
    replayed: false,
  };
};
