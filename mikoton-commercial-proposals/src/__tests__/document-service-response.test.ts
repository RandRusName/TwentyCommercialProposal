import { describe, expect, it } from 'vitest';

import type { DocumentGenerationPayloadV2 } from 'src/domain/commercial-proposal';
import { validateDocumentServiceSuccessResponse } from 'src/services/document-service-client';

const payload: DocumentGenerationPayloadV2 = {
  schemaVersion: '2.0',
  templateCode: 'mikoton-commercial-proposal',
  templateVersion: '2',
  proposal: {
    id: '11111111-1111-4111-8111-111111111111',
    number: 'КП-001 от 20.07.2026',
    title: 'Test proposal',
    date: '2026-07-20',
    language: 'ru-RU',
    currencyCode: 'RUB',
    validityDays: 14,
    amount: 100,
  },
  customer: { companyId: null, companyName: 'Customer', contactName: '' },
  contractor: { name: 'Contractor', email: 'test@example.com' },
  content: {
    contextAndGoal: '',
    workItems: [{
      position: 1,
      block: '',
      name: 'Work',
      description: '',
      quantity: 1,
      unit: 'project',
      unitPrice: 100,
      discountPercent: 0,
      lineAmount: 100,
      currencyCode: 'RUB',
    }],
    plan: [{ position: 1, title: 'Stage', result: 'Result', duration: '1 day', description: '' }],
    paymentTerms: '',
    assumptions: '',
    nextStep: '',
  },
};

const validResponse = () => ({
  status: 'success',
  generationId: '22222222-2222-4222-8222-222222222222',
  schemaVersion: '2.0',
  snapshotHash: 'a'.repeat(64),
  templateCode: 'mikoton-commercial-proposal',
  templateVersion: '2',
  generatedAt: '2026-07-20T10:00:00.000Z',
  files: [
    {
      format: 'xlsx',
      fileName: 'proposal.xlsx',
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      size: 12345,
      sha256: 'b'.repeat(64),
      storageKey: 'commercial-proposals/proposal/generation/proposal.xlsx',
      downloadUrl: 'https://documents.example.test/proposal.xlsx?signature=redacted',
      downloadUrlExpiresAt: '2026-07-20T10:15:00.000Z',
    },
    {
      format: 'pdf',
      fileName: 'proposal.pdf',
      contentType: 'application/pdf',
      size: 6789,
      sha256: 'c'.repeat(64),
      storageKey: 'commercial-proposals/proposal/generation/proposal.pdf',
      downloadUrl: 'https://documents.example.test/proposal.pdf?signature=redacted',
      downloadUrlExpiresAt: '2026-07-20T10:15:00.000Z',
    },
  ],
});

const validate = (value: unknown) => validateDocumentServiceSuccessResponse({
  value,
  payload,
  requestedFormats: ['xlsx', 'pdf'],
});

describe('document service v2 response validation', () => {
  it('accepts a complete response for the exact requested artifacts', () => {
    expect(validate(validResponse())).toMatchObject({
      schemaVersion: '2.0',
      templateVersion: '2',
      files: [{ format: 'xlsx' }, { format: 'pdf' }],
    });
  });

  it.each([
    ['schema', (value: ReturnType<typeof validResponse>) => { value.schemaVersion = '1.0'; }],
    ['template', (value: ReturnType<typeof validResponse>) => { value.templateVersion = '1'; }],
    ['snapshot hash', (value: ReturnType<typeof validResponse>) => { value.snapshotHash = 'unsafe'; }],
    ['duplicate format', (value: ReturnType<typeof validResponse>) => { value.files[1]!.format = 'xlsx'; }],
    ['content type', (value: ReturnType<typeof validResponse>) => { value.files[0]!.contentType = 'text/plain'; }],
    ['size', (value: ReturnType<typeof validResponse>) => { value.files[0]!.size = 0; }],
    ['file hash', (value: ReturnType<typeof validResponse>) => { value.files[0]!.sha256 = 'BAD'; }],
    ['storage key', (value: ReturnType<typeof validResponse>) => { value.files[0]!.storageKey = ''; }],
    ['download URL', (value: ReturnType<typeof validResponse>) => { value.files[0]!.downloadUrl = 'file:///tmp/proposal.xlsx'; }],
    ['expiry', (value: ReturnType<typeof validResponse>) => { value.files[0]!.downloadUrlExpiresAt = 'not-a-date'; }],
  ])('rejects invalid %s metadata', (_label, mutate) => {
    const response = validResponse();
    mutate(response);

    expect(() => validate(response)).toThrowError(
      expect.objectContaining({ code: 'DOCUMENT_SERVICE_INVALID_RESPONSE' }),
    );
  });
});
