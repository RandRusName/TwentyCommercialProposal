import { afterEach, describe, expect, it, vi } from 'vitest';

import type { CommercialProposalDraft } from 'src/domain/commercial-proposal';
import {
  assertAggregateIntegrity,
  normalizeSaveEditorRequest,
  saveCommercialProposalEditor,
  type CommercialProposalAggregate,
  type CommercialProposalAggregateRepository,
  type CommercialProposalItem,
  type CommercialProposalStage,
  type SaveEditorRequest,
} from 'src/domain/commercial-proposal-aggregate';
import {
  applyCanonicalResponse,
  buildSaveRequest,
  calculatePreview,
  createEmptyItem,
  createEmptyStage,
  duplicateItem,
  duplicateStage,
  getProposalDisplayNumber,
  isAggregateReadyForGeneration,
  isEditorDirty,
  moveEntry,
  normalizeDecimalInput,
  removeEntry,
  validateEditorState,
} from 'src/front-components/commercial-proposal-editor/editor-helpers';
import type {
  EditorContextResponse,
  EditorState,
} from 'src/front-components/commercial-proposal-editor/editor-types';
import {
  AppRouteError,
  callAppRoute,
  isApplicationError,
} from 'src/front-components/utils/call-app-route';

const proposalId = '123e4567-e89b-42d3-a456-426614174100';
const operationId = '123e4567-e89b-42d3-a456-426614174101';
const itemKey = '123e4567-e89b-42d3-a456-426614174102';
const stageKey = '123e4567-e89b-42d3-a456-426614174103';
const itemId = '123e4567-e89b-42d3-a456-426614174104';
const stageId = '123e4567-e89b-42d3-a456-426614174105';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const proposal = (overrides: Partial<CommercialProposalDraft> = {}): CommercialProposalDraft => ({
  id: proposalId,
  title: 'Proposal',
  number: 'DRAFT-test',
  status: 'DRAFT',
  version: 1,
  contentModelVersion: 'LEGACY_V1',
  editorRevision: 1,
  lastEditorOperationId: null,
  sourceType: 'OPPORTUNITY',
  templateCode: 'standard-commercial-proposal',
  templateVersion: null,
  language: 'ru-RU',
  payloadSnapshot: null,
  resultMetadata: null,
  opportunityId: '123e4567-e89b-42d3-a456-426614174106',
  companyId: null,
  contactName: null,
  contextAndGoal: null,
  validityDays: 14,
  paymentTerms: null,
  assumptions: null,
  nextStep: null,
  amount: 100,
  currencyCode: 'RUB',
  generatedAt: null,
  idempotencyKey: '123e4567-e89b-42d3-a456-426614174107',
  lastError: null,
  ...overrides,
});

const item = (overrides: Partial<CommercialProposalItem> = {}): CommercialProposalItem => ({
  catalogItemId: null,
  id: itemId,
  commercialProposalId: proposalId,
  clientKey: itemKey,
  position: 1,
  block: 'Работы',
  name: 'Анализ',
  description: null,
  quantity: 2,
  unit: 'час',
  unitPrice: 100,
  discountPercent: 0,
  lineAmount: 200,
  currencyCode: 'RUB',
  ...overrides,
});

const stage = (overrides: Partial<CommercialProposalStage> = {}): CommercialProposalStage => ({
  id: stageId,
  commercialProposalId: proposalId,
  clientKey: stageKey,
  position: 1,
  title: 'Старт',
  result: null,
  duration: null,
  description: null,
  ...overrides,
});

const aggregate = (overrides: Partial<CommercialProposalAggregate> = {}): CommercialProposalAggregate => ({
  proposal: proposal(),
  items: [],
  stages: [],
  ...overrides,
});

const request = (overrides: Partial<SaveEditorRequest> = {}): SaveEditorRequest => ({
  operationId,
  editorRevision: 1,
  header: {
    title: 'Proposal',
    companyId: null,
    contactName: null,
    contextAndGoal: null,
    currencyCode: 'RUB',
    validityDays: 14,
    paymentTerms: null,
    assumptions: null,
    nextStep: null,
  },
  items: [{ clientKey: itemKey, block: 'Работы', name: 'Анализ', quantity: '2', unit: 'час', unitPrice: '100', discountPercent: '0' }],
  stages: [{ clientKey: stageKey, title: 'Старт' }],
  ...overrides,
});

const makeRepository = (initial = aggregate()) => {
  let current = structuredClone(initial) as CommercialProposalAggregate;
  const repository: CommercialProposalAggregateRepository = {
    getCommercialProposalAggregate: vi.fn(async () => structuredClone(current)),
    findItemByParentAndClientKey: vi.fn(async (_id, key) => current.items.find((entry) => entry.clientKey === key) ?? null),
    findStageByParentAndClientKey: vi.fn(async (_id, key) => current.stages.find((entry) => entry.clientKey === key) ?? null),
    upsertItem: vi.fn(async (parentId, input) => {
      const persisted = item({ ...input, id: input.id ?? itemId, commercialProposalId: parentId });
      current.items = [...current.items.filter((entry) => entry.id !== persisted.id), persisted];
      return persisted;
    }),
    upsertStage: vi.fn(async (parentId, input) => {
      const persisted = stage({ ...input, id: input.id ?? stageId, commercialProposalId: parentId });
      current.stages = [...current.stages.filter((entry) => entry.id !== persisted.id), persisted];
      return persisted;
    }),
    deleteItem: vi.fn(async (id) => { current.items = current.items.filter((entry) => entry.id !== id); }),
    deleteStage: vi.fn(async (id) => { current.stages = current.stages.filter((entry) => entry.id !== id); }),
    updateCommercialProposalForEditor: vi.fn(async (_id, patch) => {
      current.proposal = { ...current.proposal, ...patch.header, amount: patch.amount, contentModelVersion: patch.contentModelVersion, editorRevision: patch.editorRevision, lastEditorOperationId: patch.lastEditorOperationId };
    }),
  };
  return { repository, read: () => structuredClone(current) };
};

const context = (source = aggregate()): EditorContextResponse => ({
  status: 'success',
  ...source,
  opportunity: { id: source.proposal.opportunityId, name: 'Opportunity', amount: 100, currencyCode: 'RUB' },
  company: null,
  legacySuggestion: { canCreateStarterItem: true, amount: 100, currencyCode: 'RUB', suggestedTitle: 'Proposal' },
  isEditable: true,
  generationAvailability: { allowed: true, reason: null },
});

describe('aggregate identity and consistency hardening', () => {
  it.each([
    ['item clientKey', { items: [request().items[0]!, { ...request().items[0]!, name: 'Second' }] }],
    ['stage clientKey', { stages: [request().stages[0]!, { ...request().stages[0]!, title: 'Second' }] }],
    ['item id', { items: [{ ...request().items[0]!, id: itemId }, { ...request().items[0]!, id: itemId, clientKey: '123e4567-e89b-42d3-a456-426614174108' }] }],
    ['stage id', { stages: [{ ...request().stages[0]!, id: stageId }, { ...request().stages[0]!, id: stageId, clientKey: '123e4567-e89b-42d3-a456-426614174109' }] }],
  ])('rejects duplicate %s values', (_label, override) => {
    expect(() => normalizeSaveEditorRequest(request(override))).toThrowError(expect.objectContaining({ code: 'COMMERCIAL_PROPOSAL_VALIDATION_FAILED' }));
  });

  it('rejects mismatched existing id and clientKey identities', async () => {
    const { repository } = makeRepository(aggregate({ items: [item()] }));
    await expect(saveCommercialProposalEditor({ proposalId, repository, request: request({ items: [{ ...request().items[0]!, id: itemId, clientKey: '123e4567-e89b-42d3-a456-426614174110' }] }) })).rejects.toMatchObject({ code: 'COMMERCIAL_PROPOSAL_CHILD_IDENTITY_CONFLICT' });
  });

  it('detects duplicate persisted child keys', () => {
    expect(() => assertAggregateIntegrity(aggregate({ items: [item(), item({ id: '123e4567-e89b-42d3-a456-426614174111' })] }))).toThrowError(expect.objectContaining({ code: 'COMMERCIAL_PROPOSAL_DATA_INTEGRITY_ERROR' }));
  });

  it('uses persisted line amounts as the canonical proposal total', async () => {
    const { repository } = makeRepository();
    vi.mocked(repository.upsertItem).mockImplementationOnce(async (parentId, input) => {
      const persisted = item({ ...input, id: itemId, commercialProposalId: parentId, lineAmount: 199.99 });
      vi.mocked(repository.getCommercialProposalAggregate).mockImplementation(async () => aggregate({ proposal: proposal({ amount: 100 }), items: [persisted], stages: [stage()] }));
      return persisted;
    });
    await saveCommercialProposalEditor({ proposalId, request: request(), repository });
    expect(repository.updateCommercialProposalForEditor).toHaveBeenCalledWith(proposalId, expect.objectContaining({ amount: 199.99 }));
  });

  it('rejects canonical child count/key mismatches', async () => {
    const { repository } = makeRepository();
    vi.mocked(repository.upsertItem).mockResolvedValue(item());
    vi.mocked(repository.upsertStage).mockResolvedValue(stage());
    await expect(saveCommercialProposalEditor({ proposalId, request: request(), repository })).rejects.toMatchObject({ code: 'COMMERCIAL_PROPOSAL_SAVE_FAILED' });
  });

  it('detects a final revision change after child mutations', async () => {
    const { repository, read } = makeRepository();
    let reads = 0;
    vi.mocked(repository.getCommercialProposalAggregate).mockImplementation(async () => {
      reads += 1;
      const value = read();
      return reads >= 4
        ? { ...value, proposal: { ...value.proposal, editorRevision: 2 } }
        : value;
    });
    await expect(saveCommercialProposalEditor({ proposalId, request: request(), repository })).rejects.toMatchObject({ code: 'COMMERCIAL_PROPOSAL_EDITOR_CONFLICT' });
  });

  it('converges without duplicate children after failure before proposal update', async () => {
    const { repository, read } = makeRepository();
    vi.mocked(repository.updateCommercialProposalForEditor)
      .mockRejectedValueOnce(new Error('injected failure'))
      .mockImplementationOnce(async (_id, patch) => {
        const snapshot = read();
        snapshot.proposal.editorRevision = patch.editorRevision;
        snapshot.proposal.lastEditorOperationId = patch.lastEditorOperationId;
        vi.mocked(repository.getCommercialProposalAggregate).mockResolvedValue(snapshot);
      });
    await expect(saveCommercialProposalEditor({ proposalId, request: request(), repository })).rejects.toThrow('injected failure');
    const retryRepository = makeRepository(read());
    const result = await saveCommercialProposalEditor({ proposalId, request: request(), repository: retryRepository.repository });
    expect(result.items).toHaveLength(1);
    expect(result.stages).toHaveLength(1);
    expect(result.proposal.editorRevision).toBe(2);
  });

  it('converges after a failure following item upsert', async () => {
    const { repository, read } = makeRepository();
    vi.mocked(repository.upsertStage).mockRejectedValueOnce(
      new Error('failure after item upsert'),
    );
    await expect(
      saveCommercialProposalEditor({ proposalId, request: request(), repository }),
    ).rejects.toThrow('failure after item upsert');
    expect(read().items).toHaveLength(1);
    const retry = makeRepository(read());
    const result = await saveCommercialProposalEditor({
      proposalId,
      request: request(),
      repository: retry.repository,
    });
    expect(result.items).toHaveLength(1);
    expect(result.stages).toHaveLength(1);
  });

  it('converges after a failure following all child upserts', async () => {
    const { repository, read } = makeRepository();
    let reads = 0;
    vi.mocked(repository.getCommercialProposalAggregate).mockImplementation(
      async () => {
        reads += 1;
        if (reads === 2) throw new Error('failure after stage upsert');
        return read();
      },
    );
    await expect(
      saveCommercialProposalEditor({ proposalId, request: request(), repository }),
    ).rejects.toThrow('failure after stage upsert');
    const retry = makeRepository(read());
    const result = await saveCommercialProposalEditor({
      proposalId,
      request: request(),
      repository: retry.repository,
    });
    expect(result.items).toHaveLength(1);
    expect(result.stages).toHaveLength(1);
  });

  it('converges after a failure during removal of omitted children', async () => {
    const oldKey = '123e4567-e89b-42d3-a456-426614174113';
    const oldId = '123e4567-e89b-42d3-a456-426614174114';
    const { repository, read } = makeRepository(
      aggregate({ items: [item({ id: oldId, clientKey: oldKey })] }),
    );
    vi.mocked(repository.deleteItem).mockRejectedValueOnce(
      new Error('failure during delete'),
    );
    await expect(
      saveCommercialProposalEditor({ proposalId, request: request(), repository }),
    ).rejects.toThrow('failure during delete');
    const retry = makeRepository(read());
    const result = await saveCommercialProposalEditor({
      proposalId,
      request: request(),
      repository: retry.repository,
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.clientKey).toBe(itemKey);
  });
});

describe('commercial proposal editor helpers', () => {
  it('hides technical draft identifiers from the business title', () => {
    expect(getProposalDisplayNumber('Черновик')).toBe('Черновик');
    expect(getProposalDisplayNumber('DRAFT-123e4567-e89b-42d3-a456-426614174107')).toBe('Черновик');
    expect(getProposalDisplayNumber('КП-005 от 17.07.2026')).toBe('КП-005 от 17.07.2026');
  });

  it('creates stable UUID identities and duplicates without persisted ids', () => {
    const createdItem = createEmptyItem();
    const createdStage = createEmptyStage();
    expect(createdItem.clientKey).toMatch(/^[0-9a-f-]{36}$/i);
    expect(createdStage.clientKey).toMatch(/^[0-9a-f-]{36}$/i);
    expect(duplicateItem({ ...createdItem, id: itemId }).id).toBeUndefined();
    expect(duplicateItem(createdItem).clientKey).not.toBe(createdItem.clientKey);
    expect(duplicateStage({ ...createdStage, id: stageId }).id).toBeUndefined();
  });

  it('moves and removes entries without mutating the source', () => {
    const source = ['a', 'b', 'c'];
    expect(moveEntry(source, 1, -1)).toEqual(['b', 'a', 'c']);
    expect(removeEntry(source, 1)).toEqual(['a', 'c']);
    expect(source).toEqual(['a', 'b', 'c']);
  });

  it('normalizes comma decimals and calculates preview', () => {
    expect(normalizeDecimalInput(' 1,5 ')).toBe('1.5');
    const state = applyCanonicalResponse(context());
    state.items = [{ ...createEmptyItem(), block: 'Работы', name: 'Анализ', unit: 'час', quantity: '1,5', unitPrice: '100', discountPercent: '10' }];
    expect(calculatePreview(state)).toBe(135);
  });

  it('validates fields and tracks dirty/canonical state', () => {
    const canonical = applyCanonicalResponse(context());
    const invalid: EditorState = { ...canonical, items: [{ ...createEmptyItem(), name: '', unit: '' }] };
    expect(validateEditorState(invalid).valid).toBe(false);
    expect(isEditorDirty(canonical, structuredClone(canonical))).toBe(false);
    expect(isEditorDirty(invalid, canonical)).toBe(true);
  });

  it('blocks aggregate generation until the customer contact is set', () => {
    const state = applyCanonicalResponse(
      context(
        aggregate({
          proposal: proposal({ contentModelVersion: 'AGGREGATE_V2' }),
          items: [item()],
          stages: [stage({ result: 'Ready', duration: '1 day' })],
        }),
      ),
    );

    expect(isAggregateReadyForGeneration(state)).toBe(false);
    expect(
      isAggregateReadyForGeneration({
        ...state,
        header: { ...state.header, contactName: 'Customer Contact' },
      }),
    ).toBe(true);
  });

  it('freezes an operation id for retry and creates a new one after an edit', () => {
    const state = applyCanonicalResponse(context());
    const first = buildSaveRequest(state, operationId);
    const retry = first;
    const edited = { ...state, header: { ...state.header, title: 'Changed' } };
    const next = buildSaveRequest(edited, '123e4567-e89b-42d3-a456-426614174112');
    expect(retry.operationId).toBe(first.operationId);
    expect(next.operationId).not.toBe(first.operationId);
  });

  it('applies canonical ids, total and revision after save', () => {
    const next = applyCanonicalResponse(context(aggregate({ proposal: proposal({ editorRevision: 2, amount: 200, contentModelVersion: 'AGGREGATE_V2' }), items: [item()], stages: [stage()] })));
    expect(next.editorRevision).toBe(2);
    expect(next.amount).toBe(200);
    expect(next.items[0]?.id).toBe(itemId);
  });
});

describe('front app route application errors', () => {
  it.each([[400, 'COMMERCIAL_PROPOSAL_VALIDATION_FAILED'], [403, 'COMMERCIAL_PROPOSAL_CHILD_FORBIDDEN'], [409, 'COMMERCIAL_PROPOSAL_EDITOR_CONFLICT'], [422, 'COMMERCIAL_PROPOSAL_GENERATION_MODEL_NOT_SUPPORTED'], [500, 'INTERNAL_ERROR']] as const)(
    'preserves backend code for HTTP %s',
    async (status, code) => {
      vi.stubGlobal('frontComponentHostCommunicationApi', { requestAccessTokenRefresh: vi.fn(async () => 'token') });
      vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ status: 'failed', error: { code, message: 'safe message' } }), { status, headers: { 'content-type': 'application/json' } })));
      let caught: unknown;
      try { await callAppRoute('/commercial-proposals/test', {}); } catch (error) { caught = error; }
      expect(caught).toBeInstanceOf(AppRouteError);
      expect(caught).toMatchObject({ applicationErrorCode: code, responseStatus: status });
      expect(isApplicationError(caught, code)).toBe(true);
    },
  );
});
