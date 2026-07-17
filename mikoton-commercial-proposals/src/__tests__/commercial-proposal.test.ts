import {
  ApplicationError,
  buildDraftTechnicalNumber,
  buildDocumentGenerationPayload,
  buildCommercialProposalNumber,
  createCommercialProposalDraft,
  generateCommercialProposalDocuments,
  getNextCommercialProposalSequence,
  normalizeCreateDraftRequest,
  normalizeGenerateCommercialProposalRequest,
  parseCommercialProposalNumber,
  SUPPORTED_LANGUAGE,
  SUPPORTED_TEMPLATE_CODE,
  type CommercialProposalDraft,
  type CommercialProposalGenerationFile,
  type CommercialProposalRepository,
} from 'src/domain/commercial-proposal';
import {
  buildCreateDraftRequest,
  CREATE_IDEMPOTENCY_KEY_ERROR,
  createIdempotencyKey,
  formatAmount,
  getSafeErrorMessage,
  isCreateDraftDisabled,
} from 'src/front-components/create-commercial-proposal.helpers';
import {
  AppRouteError,
  buildAppRouteUrl,
  callAppRoute,
} from 'src/front-components/utils/call-app-route';
import {
  normalizeOpportunityAmount,
  normalizeOpportunityCurrency,
  TwentyRecordRepository,
} from 'src/services/twenty-record-repository';
import { HttpDocumentServiceClient } from 'src/services/document-service-client';
import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';

const fixedDate = new Date('2026-07-12T10:11:12.000Z');
const idempotencyKey = '123e4567-e89b-12d3-a456-426614174000';

const restoreApplicationVariables = (value: string | undefined) => {
  if (value === undefined) {
    delete process.env.applicationVariables;
    return;
  }

  process.env.applicationVariables = value;
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete process.env.TWENTY_APP_ACCESS_TOKEN;
  delete process.env.TWENTY_API_URL;
  delete process.env.TWENTY_FUNCTIONS_URL;
  delete process.env.DOCUMENT_SERVICE_URL;
  delete process.env.DOCUMENT_SERVICE_SECRET;
  delete process.env.DOCUMENT_SERVICE_TIMEOUT_MS;
});

const getFetchCallOptions = (fetchSpy: ReturnType<typeof vi.fn>) =>
  fetchSpy.mock.calls[0]?.[1] as RequestInit | undefined;

const expectFetchAuthorization = (
  fetchSpy: ReturnType<typeof vi.fn>,
  expectedToken: string,
) => {
  const options = getFetchCallOptions(fetchSpy);
  const headers = new Headers(options?.headers);

  expect(headers.get('Authorization')).toBe(`Bearer ${expectedToken}`);
  expect(headers.get('Content-Type')).toBe('application/json');
  expect(options).not.toEqual(
    expect.objectContaining({ credentials: expect.any(String) }),
  );
};

const makeDraft = (
  overrides: Partial<CommercialProposalDraft> = {},
): CommercialProposalDraft => ({
  id: 'draft-id',
  title: 'Черновик КП - Test opportunity',
  number: buildDraftTechnicalNumber(idempotencyKey),
  status: 'DRAFT',
  sourceType: 'OPPORTUNITY',
  templateCode: SUPPORTED_TEMPLATE_CODE,
  templateVersion: null,
  language: SUPPORTED_LANGUAGE,
  payloadSnapshot: null,
  resultMetadata: null,
  opportunityId: 'opportunity-id',
  companyId: 'company-id',
  amount: 123.45,
  currencyCode: 'RUB',
  generatedAt: null,
  idempotencyKey,
  lastError: null,
  ...overrides,
});

const makeRepository = (
  existingDraft: CommercialProposalDraft | null = null,
): CommercialProposalRepository => ({
  getOpportunityContext: vi.fn(async () => ({
    id: 'opportunity-id',
    name: 'Test opportunity',
    company: {
      id: 'company-id',
      name: 'Test company',
    },
    amount: 123.45,
    currencyCode: 'RUB',
  })),
  findDraftByIdempotencyKey: vi.fn(async () => existingDraft),
  createDraft: vi.fn(async (draft) => ({
    id: 'draft-id',
    ...draft,
  })),
  getCommercialProposal: vi.fn(async () => makeDraft()),
  updateCommercialProposal: vi.fn(async (_id, patch) => ({
    ...makeDraft(),
    ...patch,
  })),
  listCommercialProposalNumbers: vi.fn(async () => []),
  attachGeneratedFiles: vi.fn(async (_id, files: CommercialProposalGenerationFile[]) =>
    files.map((file) => ({
      ...file,
      twentyFileId: `twenty-${file.format}`,
      twentyFileUrl: `https://twenty.test/${file.fileName}`,
      downloadUrl: `https://twenty.test/${file.fileName}`,
    })),
  ),
  isDuplicateConflict: vi.fn(() => false),
});

const makeInput = () =>
  normalizeCreateDraftRequest({
    source: {
      object: 'opportunity',
      recordId: 'opportunity-id',
    },
    templateCode: SUPPORTED_TEMPLATE_CODE,
    language: SUPPORTED_LANGUAGE,
    idempotencyKey,
  });

const generationIdempotencyKey = '123e4567-e89b-42d3-a456-426614174001';
const hash = (value: string) => createHash('sha256').update(value).digest('hex');

describe('commercial proposal domain', () => {
  it('builds a localized yearly proposal number', () => {
    expect(buildCommercialProposalNumber(fixedDate, 5)).toBe(
      'КП-005 от 12.07.2026',
    );
  });

  it('parses final proposal numbers and ignores legacy draft numbers', () => {
    expect(parseCommercialProposalNumber('КП-005 от 12.07.2026')).toEqual({
      sequence: 5,
      year: 2026,
    });
    expect(parseCommercialProposalNumber('CP-20260712-101112-A7K2')).toBeNull();
    expect(parseCommercialProposalNumber(buildDraftTechnicalNumber(idempotencyKey))).toBeNull();
  });

  it('allocates the next yearly proposal sequence and stops at 999', () => {
    expect(
      getNextCommercialProposalSequence(
        ['КП-001 от 01.01.2026', 'КП-099 от 12.07.2026', 'КП-999 от 31.12.2025'],
        fixedDate,
      ),
    ).toBe(100);

    expect(() =>
      getNextCommercialProposalSequence(['КП-999 от 12.07.2026'], fixedDate),
    ).toThrow(ApplicationError);
  });

  it('normalizes the new HTTP contract', () => {
    expect(makeInput()).toEqual({
      source: {
        object: 'opportunity',
        recordId: 'opportunity-id',
      },
      templateCode: SUPPORTED_TEMPLATE_CODE,
      language: SUPPORTED_LANGUAGE,
      idempotencyKey,
    });
  });

  it('normalizes the generation request contract', () => {
    expect(
      normalizeGenerateCommercialProposalRequest({
        commercialProposalId: '123e4567-e89b-42d3-a456-426614174002',
        idempotencyKey: generationIdempotencyKey,
      }),
    ).toEqual({
      commercialProposalId: '123e4567-e89b-42d3-a456-426614174002',
      idempotencyKey: generationIdempotencyKey,
    });
  });

  it('builds the document generation payload from a draft snapshot', () => {
    const payload = buildDocumentGenerationPayload({
      draft: makeDraft({ amount: 123.45, currencyCode: 'EUR' }),
      opportunity: {
        id: 'opportunity-id',
        name: 'Test opportunity',
        company: { id: 'company-id', name: 'Test company' },
        amount: 200,
        currencyCode: 'RUB',
      },
      now: fixedDate,
    });

    expect(payload.templateCode).toBe('mikoton-commercial-proposal');
    expect(payload.templateVersion).toBe('1');
    expect(payload.proposal.date).toBe('2026-07-12');
    expect(payload.proposal.currencyCode).toBe('EUR');
    expect(payload.customer.companyName).toBe('Test company');
    expect(payload.content.workItems).toEqual([
      expect.objectContaining({
        quantity: 1,
        rate: 123.45,
        discount: 0,
      }),
    ]);
  });

  it('moves a draft through generation and stores result metadata', async () => {
    const repository = makeRepository();
    const documentClient = {
      generate: vi.fn(async () => ({
        status: 'success' as const,
        generationId: 'generation-id',
        templateCode: 'mikoton-commercial-proposal' as const,
        templateVersion: '1' as const,
        generatedAt: '2026-07-12T10:11:12Z',
        files: [
          {
            format: 'xlsm' as const,
            fileName: 'cp.xlsm',
            contentType: 'application/vnd.ms-excel.sheet.macroEnabled.12',
            size: 100,
            sha256: 'sha-xlsm',
            storageKey: 'commercial-proposals/draft-id/generation-id/cp.xlsm',
            downloadUrl: 'https://documents.test/cp.xlsm',
            downloadUrlExpiresAt: '2026-07-12T10:26:12Z',
          },
          {
            format: 'pdf' as const,
            fileName: 'cp.pdf',
            contentType: 'application/pdf',
            size: 100,
            sha256: 'sha-pdf',
            storageKey: 'commercial-proposals/draft-id/generation-id/cp.pdf',
            downloadUrl: 'https://documents.test/cp.pdf',
            downloadUrlExpiresAt: '2026-07-12T10:26:12Z',
          },
        ],
      })),
    };

    const result = await generateCommercialProposalDocuments({
      input: {
        commercialProposalId: '123e4567-e89b-42d3-a456-426614174002',
        idempotencyKey: generationIdempotencyKey,
      },
      repository,
      documentClient,
      now: fixedDate,
    });

    expect(result.generated).toBe(true);
    expect(documentClient.generate).toHaveBeenCalledOnce();
    expect(repository.attachGeneratedFiles).toHaveBeenCalledWith('draft-id', [
      expect.objectContaining({ format: 'xlsm' }),
      expect.objectContaining({ format: 'pdf' }),
    ]);
    expect(documentClient.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          proposal: expect.objectContaining({
            number: 'КП-001 от 12.07.2026',
          }),
        }),
      }),
    );
    expect(repository.updateCommercialProposal).toHaveBeenNthCalledWith(
      1,
      'draft-id',
      expect.objectContaining({
        status: 'GENERATING',
        number: 'КП-001 от 12.07.2026',
        title: 'КП-001 от 12.07.2026 - Test opportunity',
      }),
    );
    expect(repository.updateCommercialProposal).toHaveBeenNthCalledWith(
      2,
      'draft-id',
      expect.objectContaining({
        status: 'GENERATED',
        generatedAt: '2026-07-12T10:11:12Z',
        resultMetadata: expect.objectContaining({
          generationIdempotencyKey,
          files: [
            expect.objectContaining({
              format: 'xlsm',
              twentyFileId: 'twenty-xlsm',
            }),
            expect.objectContaining({
              format: 'pdf',
              twentyFileId: 'twenty-pdf',
            }),
          ],
        }),
      }),
    );
  });

  it('returns an existing generated result for the same generation key', async () => {
    const repository = makeRepository();
    const existing = makeDraft({
      status: 'GENERATED',
      resultMetadata: {
        generationId: 'generation-id',
        generationIdempotencyKey,
        templateCode: 'mikoton-commercial-proposal',
        templateVersion: '1',
        files: [],
      },
    });
    vi.mocked(repository.getCommercialProposal).mockResolvedValue(existing);
    const documentClient = { generate: vi.fn() };

    const result = await generateCommercialProposalDocuments({
      input: {
        commercialProposalId: '123e4567-e89b-42d3-a456-426614174002',
        idempotencyKey: generationIdempotencyKey,
      },
      repository,
      documentClient,
    });

    expect(result.generated).toBe(false);
    expect(documentClient.generate).not.toHaveBeenCalled();
    expect(repository.updateCommercialProposal).not.toHaveBeenCalled();
  });

  it('rejects unsupported source objects with structured errors', () => {
    expect(() =>
      normalizeCreateDraftRequest({
        source: {
          object: 'company',
          recordId: 'company-id',
        },
        templateCode: SUPPORTED_TEMPLATE_CODE,
        language: SUPPORTED_LANGUAGE,
        idempotencyKey,
      }),
    ).toThrow(ApplicationError);
  });

  it('rejects invalid idempotency keys with structured errors', () => {
    expect(() =>
      normalizeCreateDraftRequest({
        source: {
          object: 'opportunity',
          recordId: 'opportunity-id',
        },
        templateCode: SUPPORTED_TEMPLATE_CODE,
        language: SUPPORTED_LANGUAGE,
        idempotencyKey: 'not-a-uuid',
      }),
    ).toThrow(ApplicationError);
  });

  it('creates a draft from opportunity context with generatedAt set to null', async () => {
    const repository = makeRepository();

    const result = await createCommercialProposalDraft({
      input: makeInput(),
      repository,
      now: fixedDate,
    });

    expect(result.created).toBe(true);
    expect(result.draft).toMatchObject({
      id: 'draft-id',
      status: 'DRAFT',
      sourceType: 'OPPORTUNITY',
      templateCode: SUPPORTED_TEMPLATE_CODE,
      templateVersion: null,
      language: SUPPORTED_LANGUAGE,
      opportunityId: 'opportunity-id',
      companyId: 'company-id',
      amount: 123.45,
      currencyCode: 'RUB',
      generatedAt: null,
      idempotencyKey,
      lastError: null,
    });
    expect(result.draft.number).toBe(buildDraftTechnicalNumber(idempotencyKey));
    expect(result.draft.title).toBe('Черновик КП - Test opportunity');
    expect(result.draft.payloadSnapshot).toEqual(makeInput());
  });

  it('does not invent a currency when the opportunity has none', async () => {
    const repository = makeRepository();
    vi.mocked(repository.getOpportunityContext).mockResolvedValueOnce({
      id: 'opportunity-id',
      name: 'Test opportunity',
      company: null,
      amount: 0,
      currencyCode: null,
    });

    const result = await createCommercialProposalDraft({
      input: makeInput(),
      repository,
      now: fixedDate,
    });

    expect(result.draft).toMatchObject({
      companyId: null,
      amount: 0,
      currencyCode: null,
    });
  });

  it('wraps create failures without leaking raw internal errors', async () => {
    const repository = makeRepository();
    vi.mocked(repository.createDraft).mockRejectedValueOnce(
      new Error('GraphQL secret token failure'),
    );

    await expect(
      createCommercialProposalDraft({
        input: makeInput(),
        repository,
        now: fixedDate,
      }),
    ).rejects.toMatchObject({
      code: 'COMMERCIAL_PROPOSAL_CREATE_FAILED',
      message: 'Не удалось создать черновик коммерческого предложения',
    });
  });

  it('returns an existing draft for the same idempotency key', async () => {
    const existingDraft = makeDraft({ id: 'existing-draft-id' });
    const repository = makeRepository(existingDraft);

    const result = await createCommercialProposalDraft({
      input: makeInput(),
      repository,
      now: fixedDate,
    });

    expect(result).toEqual({
      draft: existingDraft,
      created: false,
    });
    expect(repository.createDraft).not.toHaveBeenCalled();
  });

  it('reads and returns an existing draft after a duplicate conflict', async () => {
    const existingDraft = makeDraft({ id: 'existing-after-conflict' });
    const duplicateError = new Error('duplicate key violates unique constraint');
    const repository = makeRepository(null);

    vi.mocked(repository.createDraft).mockRejectedValueOnce(duplicateError);
    vi.mocked(repository.findDraftByIdempotencyKey)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existingDraft);
    vi.mocked(repository.isDuplicateConflict ?? vi.fn()).mockReturnValue(true);

    const result = await createCommercialProposalDraft({
      input: makeInput(),
      repository,
      now: fixedDate,
    });

    expect(result).toEqual({
      draft: existingDraft,
      created: false,
    });
  });

  it('handles two parallel requests after a duplicate conflict is visible', async () => {
    const createdDraft = makeDraft({ id: 'created-by-first-request' });
    const duplicateError = new Error('duplicate idempotency key');
    const repository = makeRepository(null);
    let createCalls = 0;

    vi.mocked(repository.findDraftByIdempotencyKey)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(createdDraft);
    vi.mocked(repository.createDraft).mockImplementation(async (draft) => {
      createCalls += 1;

      if (createCalls === 1) {
        return {
          ...createdDraft,
          ...draft,
          id: createdDraft.id,
        };
      }

      throw duplicateError;
    });
    vi.mocked(repository.isDuplicateConflict ?? vi.fn()).mockReturnValue(true);

    const [first, second] = await Promise.all([
      createCommercialProposalDraft({
        input: makeInput(),
        repository,
        now: fixedDate,
      }),
      createCommercialProposalDraft({
        input: makeInput(),
        repository,
        now: fixedDate,
      }),
    ]);

    expect(first.created).toBe(true);
    expect(second).toEqual({
      draft: createdDraft,
      created: false,
    });
  });

  it('fails safely when a duplicate technical draft number never becomes readable', async () => {
    const duplicateError = new Error('unique constraint on number');
    const repository = makeRepository(null);

    vi.mocked(repository.createDraft)
      .mockRejectedValueOnce(duplicateError)
      .mockRejectedValueOnce(duplicateError)
      .mockRejectedValueOnce(duplicateError);
    vi.mocked(repository.findDraftByIdempotencyKey).mockResolvedValue(null);
    vi.mocked(repository.isDuplicateConflict ?? vi.fn()).mockReturnValue(true);

    await expect(
      createCommercialProposalDraft({
        input: makeInput(),
        repository,
        now: fixedDate,
      }),
    ).rejects.toMatchObject({
      code: 'COMMERCIAL_PROPOSAL_CREATE_FAILED',
    });
    expect(repository.createDraft).toHaveBeenCalledTimes(3);
  });
});

describe('opportunity amount normalization', () => {
  it('normalizes decimal values', () => {
    expect(normalizeOpportunityAmount(123.45)).toBe(123.45);
    expect(normalizeOpportunityAmount('123.45')).toBe(123.45);
  });

  it('normalizes Twenty currency micros without scale drift', () => {
    const amount = {
      amountMicros: 123_450_000,
      currencyCode: 'RUB',
    };

    expect(normalizeOpportunityAmount(amount)).toBe(123.45);
    expect(normalizeOpportunityCurrency(amount)).toBe('RUB');
  });

  it('normalizes string micros and preserves missing currency as null', () => {
    expect(
      normalizeOpportunityAmount({
        amountMicros: '125000000000',
        currencyCode: null,
      }),
    ).toBe(125000);
    expect(
      normalizeOpportunityCurrency({
        amountMicros: '125000000000',
        currencyCode: null,
      }),
    ).toBeNull();
  });

  it('keeps zero amounts and invalid micros explicit', () => {
    expect(normalizeOpportunityAmount({ amountMicros: 0 })).toBe(0);
    expect(normalizeOpportunityAmount({ amountMicros: 'not-a-number' })).toBeNull();
  });
});

describe('twenty record repository generated file attachments', () => {
  it('uploads generated files and creates CommercialProposal attachments', async () => {
    const mutation = vi.fn(async () => ({ createAttachment: { id: 'attachment-id' } }));
    const repository = new TwentyRecordRepository({
      query: vi.fn(),
      mutation,
    } as never);
    process.env.TWENTY_API_URL = 'https://twenty.test';
    process.env.TWENTY_APP_ACCESS_TOKEN = 'app-token';
    process.env.TWENTY_FILE_UPLOAD_API_KEY = 'upload-token';
    delete process.env.TWENTY_API_KEY;

    vi.stubGlobal(
      'fetch',
      vi.fn(
        async (url: string) => {
          if (url === 'https://documents.test/proposal.pdf') {
            return new Response('hello', {
              status: 200,
              headers: { 'content-type': 'application/pdf' },
            });
          }

          return new Response(
            JSON.stringify({
              data: {
                uploadFilesFieldFileByUniversalIdentifier: {
                  id: 'twenty-file-id',
                  path: 'files-field/twenty-file-id.pdf',
                  size: 5,
                  createdAt: '2026-07-12T10:11:12Z',
                  url: 'https://twenty.test/files/twenty-file-id.pdf',
                },
              },
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          );
        },
      ),
    );

    const [file] = await repository.attachGeneratedFiles('proposal-id', [
      {
        format: 'pdf',
        fileName: 'proposal.pdf',
        contentType: 'application/pdf',
        size: 5,
        sha256: hash('hello'),
        downloadUrl: 'https://documents.test/proposal.pdf',
      },
    ]);

    expect(fetch).toHaveBeenCalledWith(
      'https://twenty.test/metadata',
      expect.objectContaining({
        method: 'POST',
        headers: {
          authorization: 'Bearer upload-token',
        },
      }),
    );
    expect(mutation).toHaveBeenCalledWith({
      createAttachment: {
        __args: {
          data: expect.objectContaining({
            name: 'proposal.pdf',
            targetCommercialProposalId: 'proposal-id',
            fullPath: 'files-field/twenty-file-id.pdf',
            fileCategory: 'TEXT_DOCUMENT',
            file: [
              {
                fileId: 'twenty-file-id',
                label: 'proposal.pdf',
              },
            ],
          }),
        },
        id: true,
      },
    });
    expect(file).toMatchObject({
      twentyFileId: 'twenty-file-id',
      twentyFileUrl: 'https://twenty.test/files/twenty-file-id.pdf',
      downloadUrl: 'https://twenty.test/files/twenty-file-id.pdf',
    });
  });

  it('rejects generated files with a checksum mismatch', async () => {
    const repository = new TwentyRecordRepository({
      query: vi.fn(),
      mutation: vi.fn(),
      uploadFile: vi.fn(),
    } as never);

    vi.stubGlobal('fetch', vi.fn(async () => new Response('tampered')));

    await expect(
      repository.attachGeneratedFiles('proposal-id', [
        {
          format: 'pdf',
          fileName: 'proposal.pdf',
          contentType: 'application/pdf',
          size: 8,
          sha256: hash('expected'),
          downloadUrl: 'https://documents.test/proposal.pdf',
        },
      ]),
    ).rejects.toMatchObject({
      code: 'DOCUMENT_STORAGE_FAILED',
    });
  });
});

describe('commercial proposal front component helpers', () => {
  it('creates a backend-compatible UUID idempotency key', () => {
    const key = createIdempotencyKey();

    expect(key).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(() =>
      normalizeCreateDraftRequest({
        source: {
          object: 'opportunity',
          recordId: 'opportunity-id',
        },
        templateCode: SUPPORTED_TEMPLATE_CODE,
        language: SUPPORTED_LANGUAGE,
        idempotencyKey: key,
      }),
    ).not.toThrow();
  });

  it('returns a readable error when secure UUID generation is unavailable', () => {
    vi.stubGlobal('crypto', {});

    expect(() => createIdempotencyKey()).toThrow(CREATE_IDEMPOTENCY_KEY_ERROR);
  });

  it('creates a UUID v4 idempotency key with getRandomValues fallback', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: (bytes: Uint8Array) => {
        bytes.set([
          0x12, 0x3e, 0x45, 0x67, 0xe8, 0x9b, 0x02, 0xd3, 0x24, 0x56, 0x42,
          0x66, 0x14, 0x17, 0x40, 0x00,
        ]);
        return bytes;
      },
    });

    const key = createIdempotencyKey();

    expect(key).toBe('123e4567-e89b-42d3-a456-426614174000');
    expect(() =>
      normalizeCreateDraftRequest({
        source: {
          object: 'opportunity',
          recordId: 'opportunity-id',
        },
        templateCode: SUPPORTED_TEMPLATE_CODE,
        language: SUPPORTED_LANGUAGE,
        idempotencyKey: key,
      }),
    ).not.toThrow();
  });

  it('reuses one stable idempotency key for one operation and retry', () => {
    const stableKey = '123e4567-e89b-12d3-a456-426614174000';
    const firstRequest = buildCreateDraftRequest({
      opportunityId: 'opportunity-id',
      idempotencyKey: stableKey,
    });
    const retryRequest = buildCreateDraftRequest({
      opportunityId: 'opportunity-id',
      idempotencyKey: stableKey,
    });

    expect(firstRequest.idempotencyKey).toBe(stableKey);
    expect(retryRequest.idempotencyKey).toBe(stableKey);
    expect(retryRequest).toEqual(firstRequest);
  });

  it('formats amounts for null, zero, decimals and currencies', () => {
    expect(formatAmount(null, 'RUB')).toBe('Сумма не указана');
    expect(formatAmount(0, 'RUB')).toBe('0 RUB');
    expect(formatAmount(123.45, 'RUB')).toBe('123,45 RUB');
    expect(formatAmount(123.45, 'USD')).toBe('123,45 USD');
    expect(formatAmount(123.45, null)).toBe('123,45');
  });

  it('disables create while loading, submitting, after success or without key', () => {
    const base = {
      isCreating: false,
      isLoadingContext: false,
      hasOpportunity: true,
      hasDraft: false,
      hasIdempotencyKey: true,
    };

    expect(isCreateDraftDisabled(base)).toBe(false);
    expect(isCreateDraftDisabled({ ...base, isLoadingContext: true })).toBe(true);
    expect(isCreateDraftDisabled({ ...base, isCreating: true })).toBe(true);
    expect(isCreateDraftDisabled({ ...base, hasDraft: true })).toBe(true);
    expect(isCreateDraftDisabled({ ...base, hasIdempotencyKey: false })).toBe(
      true,
    );
  });

  it('does not surface unsafe internal error details', () => {
    expect(
      getSafeErrorMessage(
        new Error('GraphQL token failure\n    at sdk.call'),
        'Безопасная ошибка',
      ),
    ).toBe('Безопасная ошибка');
    expect(getSafeErrorMessage(new Error('Сделка не найдена'), 'fallback')).toBe(
      'Сделка не найдена',
    );
  });

  it('builds absolute app route URLs for worker execution', () => {
    vi.stubGlobal('location', {
      origin: 'http://twenty.example.test',
    });

    expect(buildAppRouteUrl('/commercial-proposals/drafts')).toBe(
      'http://twenty.example.test/s/commercial-proposals/drafts',
    );
  });

  it('prefers the SDK-provided functions base URL for app routes', () => {
    process.env.TWENTY_FUNCTIONS_URL = 'https://workspace.functions.test';
    process.env.TWENTY_API_URL = 'http://twenty.example.test';

    expect(buildAppRouteUrl('/commercial-proposals/drafts')).toBe(
      'https://workspace.functions.test/commercial-proposals/drafts',
    );
  });

  it('builds app route URLs from application variables in front component workers', () => {
    const previousApplicationVariables = process.env.applicationVariables;

    process.env.applicationVariables = JSON.stringify({
      TWENTY_API_URL: 'http://192.168.100.11:3000',
    });
    vi.stubGlobal('location', {
      origin: 'null',
      href: 'blob:null/worker',
    });

    expect(buildAppRouteUrl('/commercial-proposals/opportunity-context')).toBe(
      'http://192.168.100.11:3000/s/commercial-proposals/opportunity-context',
    );

    restoreApplicationVariables(previousApplicationVariables);
  });

  it('falls back to the target Twenty URL when worker origin is unusable', () => {
    const previousApplicationVariables = process.env.applicationVariables;

    delete process.env.applicationVariables;
    vi.stubGlobal('location', {
      origin: 'null',
      href: 'blob:null/worker',
    });

    expect(buildAppRouteUrl('/commercial-proposals/drafts')).toBe(
      'http://192.168.100.11:3000/s/commercial-proposals/drafts',
    );

    restoreApplicationVariables(previousApplicationVariables);
  });

  it('does not fetch when host token refresh API is unavailable', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubGlobal('frontComponentHostCommunicationApi', {});

    await expect(
      callAppRoute('/commercial-proposals/drafts', {}),
    ).rejects.toMatchObject({
      code: 'APP_TOKEN_API_UNAVAILABLE',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does not use a worker env token when the host refresh API is unavailable', async () => {
    process.env.TWENTY_APP_ACCESS_TOKEN = 'initial-application-token';
    process.env.TWENTY_API_URL = 'http://twenty.example.test';
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubGlobal('frontComponentHostCommunicationApi', {});

    await expect(callAppRoute('/commercial-proposals/drafts', {})).rejects.toMatchObject({
      code: 'APP_TOKEN_API_UNAVAILABLE',
    });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does not fetch when host token refresh throws', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubGlobal('frontComponentHostCommunicationApi', {
      requestAccessTokenRefresh: vi.fn(async () => {
        throw new Error('refresh failed with secret-token-value');
      }),
    });

    await expect(callAppRoute('/commercial-proposals/drafts', {})).rejects.toMatchObject({
      code: 'APP_TOKEN_REFRESH_FAILED',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does not fetch when host token refresh returns an empty token', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubGlobal('frontComponentHostCommunicationApi', {
      requestAccessTokenRefresh: vi.fn(async () => ''),
    });

    await expect(callAppRoute('/commercial-proposals/drafts', {})).rejects.toMatchObject({
      code: 'APP_TOKEN_EMPTY',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('adds a valid application access token as a Bearer token', async () => {
    const fetchSpy = vi.fn(async () => new Response('{"status":"success"}'));
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubGlobal('frontComponentHostCommunicationApi', {
      requestAccessTokenRefresh: vi.fn(async () => 'application-access-token'),
    });

    await expect(callAppRoute('/commercial-proposals/drafts', {})).resolves.toEqual({
      status: 'success',
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://192.168.100.11:3000/s/commercial-proposals/drafts',
      expect.any(Object),
    );
    expectFetchAuthorization(fetchSpy, 'application-access-token');
  });

  it('maps HTTP 401 to a safe auth error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 401, statusText: 'Unauthorized' })));
    vi.stubGlobal('frontComponentHostCommunicationApi', {
      requestAccessTokenRefresh: vi.fn(async () => 'application-access-token'),
    });

    await expect(
      callAppRoute('/commercial-proposals/drafts', {}),
    ).rejects.toMatchObject({
      code: 'APP_ROUTE_UNAUTHORIZED',
    });
  });

  it('maps HTTP 403 with an empty body to a safe auth error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 403, statusText: 'Forbidden' })));
    vi.stubGlobal('frontComponentHostCommunicationApi', {
      requestAccessTokenRefresh: vi.fn(async () => 'application-access-token'),
    });

    await expect(
      callAppRoute('/commercial-proposals/drafts', {}),
    ).rejects.toMatchObject({
      code: 'APP_ROUTE_FORBIDDEN',
      diagnostic: expect.objectContaining({
        responseStatus: 403,
        responseStatusText: 'Forbidden',
        responseBodyPresent: false,
      }),
    });
  });

  it('maps structured JSON errors without leaking tokens', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            '{"status":"failed","error":{"code":"INVALID_INPUT","message":"Некорректный запрос"}}',
            { status: 400, statusText: 'Bad Request' },
          ),
      ),
    );
    vi.stubGlobal('frontComponentHostCommunicationApi', {
      requestAccessTokenRefresh: vi.fn(async () => 'secret-application-token'),
    });

    let caught: unknown;
    try {
      await callAppRoute('/commercial-proposals/drafts', {});
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(AppRouteError);
    expect(caught).toMatchObject({
      code: 'APP_ROUTE_APPLICATION_ERROR',
      message: 'Некорректный запрос',
    });
    expect(JSON.stringify(caught)).not.toContain('secret-application-token');
  });

  it('maps non-JSON error bodies to invalid response errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('Forbidden text', { status: 500, statusText: 'Server Error' })),
    );
    vi.stubGlobal('frontComponentHostCommunicationApi', {
      requestAccessTokenRefresh: vi.fn(async () => 'application-access-token'),
    });

    await expect(callAppRoute('/commercial-proposals/drafts', {})).rejects.toMatchObject({
      code: 'APP_ROUTE_INVALID_RESPONSE',
      message: 'App route returned a non-JSON response',
    });
  });

  it('returns successful JSON responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{"status":"success","value":42}', { status: 200 })),
    );
    vi.stubGlobal('frontComponentHostCommunicationApi', {
      requestAccessTokenRefresh: vi.fn(async () => 'application-access-token'),
    });

    await expect(callAppRoute('/commercial-proposals/drafts', {})).resolves.toEqual({
      status: 'success',
      value: 42,
    });
  });
});

describe('document service client', () => {
  const request = {
    requestId: generationIdempotencyKey,
    idempotencyKey: generationIdempotencyKey,
    payload: buildDocumentGenerationPayload({
      draft: makeDraft(),
      opportunity: {
        id: 'opportunity-id',
        name: 'Test opportunity',
        company: { id: 'company-id', name: 'Test company' },
        amount: 123.45,
        currencyCode: 'RUB',
      },
      now: fixedDate,
    }),
    requestedFormats: ['xlsm' as const, 'pdf' as const],
  };

  const makeClient = () => {
    process.env.DOCUMENT_SERVICE_URL = 'https://document-service.test';
    process.env.DOCUMENT_SERVICE_SECRET = 'server-side-secret';

    return new HttpDocumentServiceClient();
  };

  it('accepts successful document-service responses with download URLs', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              status: 'success',
              generationId: 'generation-id',
              templateCode: 'mikoton-commercial-proposal',
              templateVersion: '1',
              generatedAt: '2026-07-12T10:11:12Z',
              files: [
                {
                  format: 'xlsm',
                  fileName: 'cp.xlsm',
                  contentType:
                    'application/vnd.ms-excel.sheet.macroEnabled.12',
                  size: 100,
                  sha256: 'sha-xlsm',
                  storageKey: 'commercial-proposals/draft/generation/cp.xlsm',
                  downloadUrl: 'https://documents.test/cp.xlsm',
                  downloadUrlExpiresAt: '2026-07-12T10:26:12Z',
                },
              ],
            }),
            {
              status: 200,
              headers: { 'content-type': 'application/json' },
            },
          ),
      ),
    );

    const result = await makeClient().generate(request);

    expect(result.files[0]?.downloadUrl).toBe('https://documents.test/cp.xlsm');
  });

  it('maps document-service auth failures without leaking the secret', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              status: 'failed',
              error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
            }),
            {
              status: 401,
              headers: { 'content-type': 'application/json' },
            },
          ),
      ),
    );

    let caught: unknown;
    try {
      await makeClient().generate(request);
    } catch (error) {
      caught = error;
    }

    expect(caught).toMatchObject({ code: 'DOCUMENT_SERVICE_FORBIDDEN' });
    expect(JSON.stringify(caught)).not.toContain('server-side-secret');
  });

  it('rejects non-JSON document-service responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response('not json', {
            status: 200,
            headers: { 'content-type': 'text/plain' },
          }),
      ),
    );

    await expect(makeClient().generate(request)).rejects.toMatchObject({
      code: 'DOCUMENT_SERVICE_INVALID_RESPONSE',
    });
  });

  it('retries one transient 5xx with the same idempotency key', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 'failed',
            error: { code: 'INTERNAL_ERROR', message: 'temporary' },
          }),
          {
            status: 503,
            headers: { 'content-type': 'application/json' },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 'success',
            generationId: 'generation-id',
            templateCode: 'mikoton-commercial-proposal',
            templateVersion: '1',
            generatedAt: '2026-07-12T10:11:12Z',
            files: [
              {
                format: 'pdf',
                fileName: 'cp.pdf',
                contentType: 'application/pdf',
                size: 100,
                sha256: 'sha-pdf',
                downloadUrl: 'https://documents.test/cp.pdf',
              },
            ],
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        ),
      );
    vi.stubGlobal('fetch', fetchSpy);

    await makeClient().generate(request);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const firstBody = JSON.parse(
      String((fetchSpy.mock.calls[0]?.[1] as RequestInit).body),
    ) as { idempotencyKey: string };
    const secondBody = JSON.parse(
      String((fetchSpy.mock.calls[1]?.[1] as RequestInit).body),
    ) as { idempotencyKey: string };

    expect(firstBody.idempotencyKey).toBe(generationIdempotencyKey);
    expect(secondBody.idempotencyKey).toBe(generationIdempotencyKey);
  });
});
