# Monitoring

## Signals

- generation success/failure count and duration percentiles;
- `COMMERCIAL_PROPOSAL_GENERATION_IN_PROGRESS` (HTTP 409) rate — concurrent
  same-proposal attempts, including parallel same `operationId`, or unexpired
  claim contention;
- `COMMERCIAL_PROPOSAL_GENERATION_OWNERSHIP_LOST` (HTTP 409) — stale lease
  takeover; loser must not write `FAILED` or attach files;
- generation claim lease expiry / stale-lock recovery (10-minute lease;
  claim replaced with a new `ownerToken`);
- lease renewal failures before/after document-service or before attachments;
- `DOCUMENT_SERVICE_TIMEOUT`, storage, PDF export and attachment errors;
- generation idempotency and editor revision conflicts;
- `/readyz` failures and document-service restart count;
- temporary directory usage and cleanup failures;
- MinIO capacity, object errors and bucket availability;
- worker storage credential misconfiguration (`SERVICE_NOT_READY` when
  `DOCUMENT_STORAGE_*` keys are missing);
- final-number duplicate conflicts and exhausted sequences;
- failed or expired download-link refresh attempts;
- catalog cursor `INVALID_INPUT` spikes (filterFingerprint / skip / after);
- categories route `PARTIAL` completeness (safety limit).

For this internal deployment, structured container logs plus existing host
monitoring are sufficient. Alert on sustained readiness failure, any storage or
attachment failure burst, repeated authentication failures, disk usage above
80%, and generation failure rate above 10% over 15 minutes. Sustained spikes of
`IN_PROGRESS` after lease expiry, or unexpected `OWNERSHIP_LOST` bursts, warrant
investigation (stuck clients, overlapping operators, or clock skew).

Configure Docker log rotation (`max-size` and `max-file`). Temporary generation
directories may be removed after a completed request. Never delete manifests,
MinIO objects or Twenty attachments referenced by a proposal. Production file
retention follows proposal retention; orphan cleanup requires a report-only
pass and explicit operator approval.

Target monitoring baselines for App `0.1.49` are **NOT DONE** until operator
acceptance records them — see `phase-5-5-production-acceptance.md`.
