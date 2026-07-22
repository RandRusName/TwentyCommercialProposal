# Monitoring

## Signals

- generation success/failure count and duration percentiles;
- `DOCUMENT_SERVICE_TIMEOUT`, storage, PDF export and attachment errors;
- generation idempotency and editor revision conflicts;
- `/readyz` failures and document-service restart count;
- temporary directory usage and cleanup failures;
- MinIO capacity, object errors and bucket availability;
- final-number duplicate conflicts and exhausted sequences;
- failed or expired download-link refresh attempts.

For this internal deployment, structured container logs plus existing host
monitoring are sufficient. Alert on sustained readiness failure, any storage or
attachment failure burst, repeated authentication failures, disk usage above
80%, and generation failure rate above 10% over 15 minutes.

Configure Docker log rotation (`max-size` and `max-file`). Temporary generation
directories may be removed after a completed request. Never delete manifests,
MinIO objects or Twenty attachments referenced by a proposal. Production file
retention follows proposal retention; orphan cleanup requires a report-only
pass and explicit operator approval.
