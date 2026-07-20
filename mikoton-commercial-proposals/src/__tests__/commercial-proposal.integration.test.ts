import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  SUPPORTED_LANGUAGE,
  SUPPORTED_TEMPLATE_CODE,
} from 'src/domain/commercial-proposal';

type CreatedRecord = {
  id: string;
};

type CommercialProposalNode = {
  id: string;
  title: string | null;
  number: string | null;
  status: string | null;
  sourceType: string | null;
  templateCode: string | null;
  language: string | null;
  amount: number | null;
  currencyCode: string | null;
  generatedAt: string | null;
  idempotencyKey: string | null;
  opportunity: { id: string | null } | null;
  company: { id: string | null } | null;
};

const apiUrl = process.env.TWENTY_API_URL;
const apiKey = process.env.TWENTY_API_KEY;
const mode = process.env.TWENTY_TEST_INSTANCE_MODE;

const headers = () => ({
  Authorization: `Bearer ${apiKey}`,
  'content-type': 'application/json',
});

const createdIds = {
  commercialProposal: null as string | null,
  opportunity: null as string | null,
  opportunityWithoutCompany: null as string | null,
  company: null as string | null,
};

const smokeName = `[SMOKE] CP integration ${new Date()
  .toISOString()
  .replace(/[:.]/g, '-')}`;
const idempotencyKey = globalThis.crypto.randomUUID();

const requireIntegrationEnv = () => {
  expect(mode).toMatch(/^(ephemeral|target)$/);
  expect(apiUrl).toBeTruthy();
  expect(apiKey).toBeTruthy();
};

const graphql = async <T>(
  graphqlQuery: string,
  variables: Record<string, unknown> = {},
) => {
  const response = await fetch(`${apiUrl}/graphql`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      query: graphqlQuery,
      variables,
    }),
  });

  const payload = (await response.json()) as {
    data?: T;
    errors?: Array<{ message: string }>;
  };

  if (!response.ok || payload.errors !== undefined) {
    throw new Error(
      payload.errors?.map((error) => error.message).join('; ') ??
        `GraphQL request failed with ${response.status}`,
    );
  }

  if (payload.data === undefined) {
    throw new Error('GraphQL response did not contain data');
  }

  return payload.data;
};

const callDraftRoute = async (body: Record<string, unknown>) => {
  const response = await fetch(`${apiUrl}/s/commercial-proposals/drafts`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });

  const payload = (await response.json()) as Record<string, unknown>;

  return { response, payload };
};

const callContextRoute = async (body: Record<string, unknown>) => {
  const response = await fetch(
    `${apiUrl}/s/commercial-proposals/opportunity-context`,
    {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body),
    },
  );

  const payload = (await response.json()) as Record<string, unknown>;

  return { response, payload };
};

const callProposalRoute = async (
  proposalId: string,
  suffix: 'editor-context' | 'save-editor' | 'recalculate',
  body: Record<string, unknown>,
) => {
  const response = await fetch(
    `${apiUrl}/s/commercial-proposals/${encodeURIComponent(proposalId)}/${suffix}`,
    {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body),
    },
  );
  const payload = (await response.json()) as Record<string, unknown>;
  return { response, payload };
};

const callGenerateRoute = async (body: Record<string, unknown>) => {
  const response = await fetch(`${apiUrl}/s/commercial-proposals/generate`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as Record<string, unknown>;
  return { response, payload };
};

const createCompany = async () => {
  const response = await graphql<{ createCompany: CreatedRecord }>(
    `
      mutation CreateCompany($name: String!) {
        createCompany(data: { name: $name }) {
          id
        }
      }
    `,
    { name: smokeName },
  );

  createdIds.company = response.createCompany.id;

  return response.createCompany;
};

const createOpportunity = async (companyId: string) => {
  const response = await graphql<{ createOpportunity: CreatedRecord }>(
    `
      mutation CreateOpportunity($name: String!, $companyId: UUID!) {
        createOpportunity(
          data: {
            name: $name
            amount: { amountMicros: 123450000, currencyCode: "RUB" }
            companyId: $companyId
          }
        ) {
          id
        }
      }
    `,
    { name: smokeName, companyId },
  );

  createdIds.opportunity = response.createOpportunity.id;

  return response.createOpportunity;
};

const createOpportunityWithoutCompany = async () => {
  const response = await graphql<{ createOpportunity: CreatedRecord }>(
    `
      mutation CreateOpportunity($name: String!) {
        createOpportunity(
          data: {
            name: $name
            amount: { amountMicros: 0, currencyCode: "USD" }
          }
        ) {
          id
        }
      }
    `,
    { name: `${smokeName} no company` },
  );

  createdIds.opportunityWithoutCompany = response.createOpportunity.id;

  return response.createOpportunity;
};

const findCommercialProposalsByKey = async () => {
  const response = await graphql<{
    commercialProposals: {
      edges: Array<{ node: CommercialProposalNode }>;
    };
  }>(
    `
      query FindCommercialProposals($idempotencyKey: String!) {
        commercialProposals(
          filter: { idempotencyKey: { eq: $idempotencyKey } }
        ) {
          edges {
            node {
              id
              title
              number
              status
              sourceType
              templateCode
              language
              amount
              currencyCode
              generatedAt
              idempotencyKey
              opportunity {
                id
              }
              company {
                id
              }
            }
          }
        }
      }
    `,
    { idempotencyKey },
  );

  return response.commercialProposals.edges.map((edge) => edge.node);
};

const deleteRecord = async (operationName: string, id: string | null) => {
  if (id === null) {
    return;
  }

  await graphql(
    `
      mutation DeleteRecord($id: UUID!) {
        ${operationName}(id: $id) {
          id
        }
      }
    `,
    { id },
  ).catch((error) => {
    console.warn(`Best-effort cleanup failed for ${operationName}:`, error);
  });
};

describe('commercial proposal backend vertical slice', () => {
  beforeAll(async () => {
    requireIntegrationEnv();

    const health = await fetch(`${apiUrl}/healthz`);
    expect(health.ok).toBe(true);
  });

  afterAll(async () => {
    await deleteRecord(
      'deleteCommercialProposal',
      createdIds.commercialProposal,
    );
    await deleteRecord(
      'deleteOpportunity',
      createdIds.opportunityWithoutCompany,
    );
    await deleteRecord('deleteOpportunity', createdIds.opportunity);
    await deleteRecord('deleteCompany', createdIds.company);
  });

  it('creates a draft, preserves relations and stays idempotent', async () => {
    const company = await createCompany();
    const opportunity = await createOpportunity(company.id);

    const context = await callContextRoute({ opportunityId: opportunity.id });
    expect(context.response.status).toBe(200);
    expect(context.payload).toMatchObject({
      status: 'success',
      opportunity: {
        id: opportunity.id,
        name: smokeName,
        company: {
          id: company.id,
          name: smokeName,
        },
        amount: 123.45,
        currencyCode: 'RUB',
      },
    });

    const first = await callDraftRoute({
      source: {
        object: 'opportunity',
        recordId: opportunity.id,
      },
      templateCode: SUPPORTED_TEMPLATE_CODE,
      language: SUPPORTED_LANGUAGE,
      idempotencyKey,
    });

    expect(first.response.status).toBe(200);
    expect(first.payload.status).toBe('success');
    expect(first.payload.created).toBe(true);

    const draft = first.payload.draft as { id: string; number: string };
    createdIds.commercialProposal = draft.id;
    expect(draft.number).toBe(`DRAFT-${idempotencyKey}`);

    const records = await findCommercialProposalsByKey();
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      id: draft.id,
      status: 'DRAFT',
      sourceType: 'OPPORTUNITY',
      templateCode: SUPPORTED_TEMPLATE_CODE,
      language: SUPPORTED_LANGUAGE,
      amount: 123.45,
      currencyCode: 'RUB',
      generatedAt: null,
      idempotencyKey,
    });
    expect(records[0]?.opportunity?.id).toBe(opportunity.id);
    expect(records[0]?.company?.id).toBe(company.id);

    const second = await callDraftRoute({
      source: {
        object: 'opportunity',
        recordId: opportunity.id,
      },
      templateCode: SUPPORTED_TEMPLATE_CODE,
      language: SUPPORTED_LANGUAGE,
      idempotencyKey,
    });

    expect(second.response.status).toBe(200);
    expect(second.payload.status).toBe('success');
    expect(second.payload.created).toBe(false);
    expect((second.payload.draft as { id: string }).id).toBe(draft.id);
    expect(await findCommercialProposalsByKey()).toHaveLength(1);
  });

  it('returns context for an opportunity without company', async () => {
    const opportunity = await createOpportunityWithoutCompany();

    const context = await callContextRoute({ opportunityId: opportunity.id });

    expect(context.response.status).toBe(200);
    expect(context.payload).toMatchObject({
      status: 'success',
      opportunity: {
        id: opportunity.id,
        name: `${smokeName} no company`,
        company: null,
        amount: 0,
        currencyCode: 'USD',
      },
    });
  });

  it('saves and reloads the aggregate editor without identity duplicates', async () => {
    const proposalId = createdIds.commercialProposal;
    expect(proposalId).not.toBeNull();
    if (proposalId === null) return;

    const initial = await callProposalRoute(proposalId, 'editor-context', {});
    expect(initial.response.status).toBe(200);
    expect(initial.payload).toMatchObject({
      status: 'success',
      isEditable: true,
      proposal: {
        contentModelVersion: 'LEGACY_V1',
        editorRevision: 1,
        amount: 123.45,
      },
      opportunity: { name: smokeName, amount: 123.45, currencyCode: 'RUB' },
      company: { name: smokeName },
    });

    const baseHeader = {
      title: `${smokeName} proposal`,
      companyId: createdIds.company,
      contactName: 'Smoke Contact',
      contextAndGoal: 'Smoke editor context',
      currencyCode: 'RUB',
      validityDays: 14,
      paymentTerms: '50/50',
      assumptions: 'Smoke only',
      nextStep: 'Approve',
    };
    const headerOperation = globalThis.crypto.randomUUID();
    const headerOnly = await callProposalRoute(proposalId, 'save-editor', {
      operationId: headerOperation,
      editorRevision: 1,
      header: baseHeader,
      items: [],
      stages: [],
    });
    expect(headerOnly.response.status).toBe(200);
    expect(headerOnly.payload).toMatchObject({
      proposal: {
        contentModelVersion: 'LEGACY_V1',
        editorRevision: 2,
        amount: 123.45,
      },
    });

    const duplicateKey = globalThis.crypto.randomUUID();
    const duplicate = await callProposalRoute(proposalId, 'save-editor', {
      operationId: globalThis.crypto.randomUUID(),
      editorRevision: 2,
      header: baseHeader,
      items: [
        { clientKey: duplicateKey, block: 'A', name: 'One', quantity: '1', unit: 'hour', unitPrice: '1', discountPercent: '0' },
        { clientKey: duplicateKey, block: 'B', name: 'Two', quantity: '1', unit: 'hour', unitPrice: '1', discountPercent: '0' },
      ],
      stages: [],
    });
    expect(duplicate.response.status).toBe(400);
    expect(duplicate.payload).toMatchObject({ error: { code: 'COMMERCIAL_PROPOSAL_VALIDATION_FAILED' } });

    const aggregateOperation = globalThis.crypto.randomUUID();
    const itemKeys = [globalThis.crypto.randomUUID(), globalThis.crypto.randomUUID(), globalThis.crypto.randomUUID()];
    const stageKeys = [globalThis.crypto.randomUUID(), globalThis.crypto.randomUUID()];
    const saveBody = {
      operationId: aggregateOperation,
      editorRevision: 2,
      header: baseHeader,
      items: [
        { clientKey: itemKeys[0], block: 'Анализ', name: 'Discovery', quantity: '1.5', unit: 'час', unitPrice: '100', discountPercent: '10' },
        { clientKey: itemKeys[1], block: 'Разработка', name: 'Build', quantity: '2', unit: 'час', unitPrice: '50', discountPercent: '0' },
        { clientKey: itemKeys[2], block: 'Запуск', name: 'Launch', quantity: '1', unit: 'проект', unitPrice: '25', discountPercent: '0' },
      ],
      stages: [
        { clientKey: stageKeys[0], title: 'Старт', result: 'Требования', duration: '1 день' },
        { clientKey: stageKeys[1], title: 'Запуск', result: 'Рабочее решение', duration: '2 дня' },
      ],
    };
    const saved = await callProposalRoute(proposalId, 'save-editor', saveBody);
    expect(saved.response.status).toBe(200);
    expect(saved.payload).toMatchObject({
      saved: true,
      replayed: false,
      proposal: { contentModelVersion: 'AGGREGATE_V2', editorRevision: 3, amount: 260 },
    });
    expect(saved.payload.items).toHaveLength(3);
    expect(saved.payload.stages).toHaveLength(2);

    const replay = await callProposalRoute(proposalId, 'save-editor', saveBody);
    expect(replay.response.status).toBe(200);
    expect(replay.payload).toMatchObject({ replayed: true, proposal: { editorRevision: 3 } });
    expect(replay.payload.items).toHaveLength(3);

    const reloaded = await callProposalRoute(proposalId, 'editor-context', {});
    expect(reloaded.payload).toMatchObject({
      isEditable: true,
      proposal: { contentModelVersion: 'AGGREGATE_V2', editorRevision: 3, amount: 260 },
      generationAvailability: { allowed: false, reason: 'AGGREGATE_V2_NOT_SUPPORTED_UNTIL_PROMPT_5_3' },
    });
    expect(reloaded.payload.items).toHaveLength(3);
    expect(reloaded.payload.stages).toHaveLength(2);

    const stale = await callProposalRoute(proposalId, 'save-editor', {
      ...saveBody,
      operationId: globalThis.crypto.randomUUID(),
      editorRevision: 2,
    });
    expect(stale.response.status).toBe(409);
    expect(stale.payload).toMatchObject({ error: { code: 'COMMERCIAL_PROPOSAL_EDITOR_CONFLICT' } });

    const fabricated = await callProposalRoute(proposalId, 'save-editor', {
      ...saveBody,
      operationId: globalThis.crypto.randomUUID(),
      editorRevision: 3,
      items: [{ ...saveBody.items[0], id: globalThis.crypto.randomUUID() }],
    });
    expect(fabricated.response.status).toBe(403);
    expect(fabricated.payload).toMatchObject({ error: { code: 'COMMERCIAL_PROPOSAL_CHILD_FORBIDDEN' } });

    const recalculated = await callProposalRoute(proposalId, 'recalculate', {
      currencyCode: 'RUB',
      items: saveBody.items.map(({ clientKey, quantity, unitPrice, discountPercent }) => ({ clientKey, quantity, unitPrice, discountPercent })),
    });
    expect(recalculated.response.status).toBe(200);
    expect(recalculated.payload).toMatchObject({ amount: 260, currencyCode: 'RUB' });

    const generation = await callGenerateRoute({ commercialProposalId: proposalId, idempotencyKey: globalThis.crypto.randomUUID() });
    expect(generation.response.status).toBe(422);
    expect(generation.payload).toMatchObject({ error: { code: 'COMMERCIAL_PROPOSAL_GENERATION_MODEL_NOT_SUPPORTED' } });
  });

  it('returns structured INVALID_INPUT for missing context opportunityId', async () => {
    const result = await callContextRoute({});

    expect(result.response.status).toBe(400);
    expect(result.payload).toMatchObject({
      status: 'failed',
      error: {
        code: 'INVALID_INPUT',
      },
    });
  });

  it('returns structured OPPORTUNITY_NOT_FOUND for nonexistent context opportunity', async () => {
    const result = await callContextRoute({
      opportunityId: globalThis.crypto.randomUUID(),
    });

    expect(result.response.status).toBe(404);
    expect(result.payload).toMatchObject({
      status: 'failed',
      error: {
        code: 'OPPORTUNITY_NOT_FOUND',
      },
    });
  });

  it('returns structured INVALID_INPUT for malformed requests', async () => {
    const result = await callDraftRoute({
      source: {
        object: 'opportunity',
        recordId: '',
      },
      templateCode: SUPPORTED_TEMPLATE_CODE,
      language: SUPPORTED_LANGUAGE,
      idempotencyKey: globalThis.crypto.randomUUID(),
    });

    expect(result.response.status).toBe(400);
    expect(result.payload).toMatchObject({
      status: 'failed',
      error: {
        code: 'INVALID_INPUT',
      },
    });
  });

  it('returns structured UNSUPPORTED_SOURCE for unsupported source objects', async () => {
    const result = await callDraftRoute({
      source: {
        object: 'company',
        recordId: createdIds.company ?? globalThis.crypto.randomUUID(),
      },
      templateCode: SUPPORTED_TEMPLATE_CODE,
      language: SUPPORTED_LANGUAGE,
      idempotencyKey: globalThis.crypto.randomUUID(),
    });

    expect(result.response.status).toBe(400);
    expect(result.payload).toMatchObject({
      status: 'failed',
      error: {
        code: 'UNSUPPORTED_SOURCE',
      },
    });
  });
});
