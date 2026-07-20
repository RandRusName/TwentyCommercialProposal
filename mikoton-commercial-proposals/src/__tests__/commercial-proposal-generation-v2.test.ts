import { describe, expect, it } from 'vitest';

import {
  buildDocumentGenerationPayloadV2,
  calculateSnapshotHash,
  canonicalJson,
  validateAggregateForGeneration,
} from 'src/domain/commercial-proposal';
import {
  normalizeRecalculateRequest,
  normalizeSaveEditorRequest,
  type CommercialProposalAggregate,
} from 'src/domain/commercial-proposal-aggregate';

const aggregateFixture = (): CommercialProposalAggregate => ({
  proposal: {
    id: '11111111-1111-4111-8111-111111111111',
    title: 'Интеграция CRM',
    number: 'КП-007 от 20.07.2026',
    status: 'DRAFT',
    version: 1,
    contentModelVersion: 'AGGREGATE_V2',
    editorRevision: 3,
    lastEditorOperationId: null,
    sourceType: 'OPPORTUNITY',
    templateCode: 'standard-commercial-proposal',
    templateVersion: null,
    language: 'ru-RU',
    payloadSnapshot: null,
    resultMetadata: null,
    opportunityId: '22222222-2222-4222-8222-222222222222',
    companyId: '33333333-3333-4333-8333-333333333333',
    contactName: 'Иван Иванов',
    contextAndGoal: 'Автоматизировать обработку лидов',
    validityDays: 14,
    paymentTerms: '50% аванс',
    assumptions: 'Доступы предоставляет заказчик',
    nextStep: 'Согласовать старт',
    amount: 1900,
    currencyCode: 'RUB',
    generatedAt: null,
    idempotencyKey: '44444444-4444-4444-8444-444444444444',
    lastError: null,
  },
  items: [
    {
      id: '55555555-5555-4555-8555-555555555555',
      commercialProposalId: '11111111-1111-4111-8111-111111111111',
      clientKey: '66666666-6666-4666-8666-666666666666',
      position: 1,
      block: 'Анализ',
      name: 'Интервью',
      description: 'Сбор требований',
      quantity: 2,
      unit: 'час',
      unitPrice: 1000,
      discountPercent: 5,
      lineAmount: 1900,
      currencyCode: 'RUB',
    },
  ],
  stages: [
    {
      id: '77777777-7777-4777-8777-777777777777',
      commercialProposalId: '11111111-1111-4111-8111-111111111111',
      clientKey: '88888888-8888-4888-8888-888888888888',
      position: 1,
      title: 'Диагностика',
      result: 'Согласованные требования',
      duration: '2 дня',
      description: 'Интервью с командой',
    },
  ],
});

describe('generation schema v2', () => {
  it('builds deterministic payload from canonical aggregate fields', () => {
    const aggregate = aggregateFixture();
    const payload = buildDocumentGenerationPayloadV2({
      aggregate,
      opportunity: null,
      company: { id: aggregate.proposal.companyId!, name: 'ООО Заказчик' },
      now: new Date('2026-07-20T09:00:00Z'),
    });

    expect(payload).toMatchObject({
      schemaVersion: '2.0',
      templateVersion: '2',
      proposal: { title: 'Интеграция CRM', amount: 1900 },
      content: {
        workItems: [{ name: 'Интервью', description: 'Сбор требований', lineAmount: 1900 }],
        plan: [{ title: 'Диагностика', description: 'Интервью с командой' }],
      },
    });
    expect(calculateSnapshotHash(payload)).toMatch(/^[a-f0-9]{64}$/);
    expect(canonicalJson({ b: 1, a: { d: 2, c: 3 } })).toBe(
      '{"a":{"c":3,"d":2},"b":1}',
    );
  });

  it('rejects incomplete aggregate before generation', () => {
    const aggregate = aggregateFixture();
    aggregate.stages[0]!.duration = null;
    expect(() => validateAggregateForGeneration(aggregate)).toThrowError(
      expect.objectContaining({ code: 'COMMERCIAL_PROPOSAL_GENERATION_VALIDATION_FAILED' }),
    );
  });

  it.each([null, 1, 'bad', []])('rejects malformed item element %j safely', (item) => {
    expect(() =>
      normalizeSaveEditorRequest({
        operationId: '99999999-9999-4999-8999-999999999999',
        editorRevision: 1,
        header: {
          title: 'КП', companyId: null, contactName: null, contextAndGoal: null,
          currencyCode: 'RUB', validityDays: 14, paymentTerms: null,
          assumptions: null, nextStep: null,
        },
        items: [item] as never,
        stages: [],
      }),
    ).toThrowError(expect.objectContaining({ code: 'COMMERCIAL_PROPOSAL_VALIDATION_FAILED' }));
  });

  it('rejects malformed recalculate items safely', () => {
    expect(() =>
      normalizeRecalculateRequest({ currencyCode: 'RUB', items: [null] as never }),
    ).toThrowError(expect.objectContaining({ code: 'COMMERCIAL_PROPOSAL_VALIDATION_FAILED' }));
  });
});
