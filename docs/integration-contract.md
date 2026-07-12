# Integration Contract: Twenty App to Document Service

## Purpose

The Twenty App should orchestrate commercial proposal generation. The external `document-service` should own template rendering, DOCX/PDF generation, conversion, and storage upload if needed.

## Invocation Options

Recommended: Twenty logic function calls `document-service` over HTTP.

Alternative: front component calls `document-service` directly. This is not preferred because it exposes service URLs/tokens to the browser and complicates permission checks.

## Logic Function Trigger

Define an HTTP route-triggered logic function, for example:

- path: `/commercial-proposals/generate`
- method: `POST`
- auth required: yes

The front component calls this route after the user confirms generation options.

## Request to Logic Function

```json
{
  "source": {
    "object": "opportunity",
    "recordId": "uuid"
  },
  "templateCode": "standard-commercial-proposal",
  "language": "ru-RU",
  "outputFormats": ["docx", "pdf"],
  "options": {
    "includeVat": true,
    "includeSignatureBlock": true
  },
  "idempotencyKey": "company-or-opportunity-id-template-timestamp-or-uuid"
}
```

## Logic Function Responsibilities

1. Validate the source object is `company` or `opportunity`.
2. Validate the user/app has permission to read the source record.
3. Read source data from Twenty.
4. Normalize data into the document-service payload.
5. Create or update `CommercialProposal` with status `generating`.
6. Call `document-service`.
7. Persist result metadata and file/link fields.
8. Set status to `generated` or `failed`.
9. Return concise result to the front component.

## Request to Document Service

```json
{
  "requestId": "uuid",
  "idempotencyKey": "string",
  "template": {
    "code": "standard-commercial-proposal",
    "version": "optional"
  },
  "output": {
    "formats": ["docx", "pdf"]
  },
  "proposal": {
    "number": "CP-2026-00042",
    "date": "2026-07-12",
    "language": "ru-RU",
    "currency": "RUB"
  },
  "company": {
    "id": "uuid",
    "name": "Mikoton",
    "website": "https://example.com"
  },
  "opportunity": {
    "id": "uuid",
    "name": "New implementation project",
    "amount": {
      "amountMicros": 120000000000,
      "currencyCode": "RUB"
    }
  },
  "lineItems": [],
  "signer": {},
  "metadata": {
    "twentyWorkspaceId": "uuid",
    "twentyRecordUrl": "url"
  }
}
```

## Response from Document Service

```json
{
  "requestId": "uuid",
  "status": "generated",
  "templateVersion": "2026.07.12",
  "files": [
    {
      "format": "docx",
      "fileName": "CP-2026-00042.docx",
      "contentType": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "size": 123456,
      "sha256": "hex",
      "url": "https://storage.example.com/..."
    },
    {
      "format": "pdf",
      "fileName": "CP-2026-00042.pdf",
      "contentType": "application/pdf",
      "size": 234567,
      "sha256": "hex",
      "url": "https://storage.example.com/..."
    }
  ],
  "warnings": []
}
```

## Errors

Document-service should return structured errors:

```json
{
  "requestId": "uuid",
  "status": "failed",
  "error": {
    "code": "TEMPLATE_NOT_FOUND",
    "message": "Template standard-commercial-proposal was not found",
    "details": {}
  }
}
```

Recommended error codes:

- `TEMPLATE_NOT_FOUND`
- `INVALID_INPUT`
- `RENDER_FAILED`
- `CONVERSION_FAILED`
- `STORAGE_FAILED`
- `TIMEOUT`
- `UNAUTHORIZED`

## Security

- Store document-service credentials as secret app/server variables.
- Use an idempotency key on every generation request.
- Do not send raw Twenty access tokens to document-service.
- Sanitize error messages before storing them in user-visible fields.
- Prefer short-lived signed URLs if external storage is used.

## File Storage Decision

Preferred final state:

- Upload generated files into Twenty storage and attach them through a `FILES` field.

Fallback:

- Store external signed/permanent links in `documentUrl` and keep checksums/metadata in `resultMetadata`.

The fallback should remain available until authenticated testing confirms the SDK/API file upload path for Apps in Twenty `v2.20.0`.
