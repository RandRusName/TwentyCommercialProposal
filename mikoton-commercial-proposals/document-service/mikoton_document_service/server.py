from __future__ import annotations

import json
import hmac
import os
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from .generator import (
    DocumentGenerationError,
    config_from_environment,
    generate_documents,
    readiness,
    resolve_template_paths,
)


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_MAX_REQUEST_BYTES = 2 * 1024 * 1024
MIN_SECRET_BYTES = 32


def _allow_insecure_local_dev() -> bool:
    return os.environ.get("ALLOW_INSECURE_LOCAL_DEV", "false").lower() == "true"


def _configured_secret() -> str | None:
    secret = os.environ.get("DOCUMENT_SERVICE_SECRET", "")
    if len(secret.encode("utf-8")) >= MIN_SECRET_BYTES:
        return secret
    return None


def _max_request_bytes() -> int:
    try:
        value = int(os.environ.get("DOCUMENT_MAX_REQUEST_BYTES", str(DEFAULT_MAX_REQUEST_BYTES)))
    except ValueError as error:
        raise DocumentGenerationError("SERVICE_NOT_READY", "Invalid request size configuration") from error
    if value < 1:
        raise DocumentGenerationError("SERVICE_NOT_READY", "Invalid request size configuration")
    return value


def _is_authorized(authorization: str, expected_secret: str) -> bool:
    return hmac.compare_digest(
        authorization.encode("utf-8"),
        f"Bearer {expected_secret}".encode("utf-8"),
    )


def _safe_log(message: str, **fields: object) -> None:
    safe_fields = {
        key: value
        for key, value in fields.items()
        if key.lower() not in {"authorization", "token", "secret", "api_key"}
    }
    print(json.dumps({"message": message, **safe_fields}, ensure_ascii=False), flush=True)


class Handler(BaseHTTPRequestHandler):
    server_version = "MikotonDocumentService/0.2"

    def _json(self, status: int, body: dict) -> None:
        payload = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("content-type", "application/json; charset=utf-8")
        self.send_header("content-length", str(len(payload)))
        self.send_header("cache-control", "no-store")
        self.send_header("x-content-type-options", "nosniff")
        self.send_header("x-frame-options", "DENY")
        self.send_header("referrer-policy", "no-referrer")
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, format: str, *args: object) -> None:
        _safe_log("http_request", request=self.path, client=self.client_address[0])

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path == "/healthz":
            return self._json(200, {"status": "ok"})
        if path == "/readyz":
            try:
                result = readiness(config_from_environment(PROJECT_ROOT))
                secret_ready = _configured_secret() is not None or _allow_insecure_local_dev()
                result["checks"]["authentication"] = secret_ready
                result["ready"] = bool(result["ready"] and secret_ready)
                return self._json(
                    200 if result["ready"] else 503,
                    {"status": "ready" if result["ready"] else "not_ready", **result},
                )
            except DocumentGenerationError as exc:
                return self._json(
                    503,
                    {
                        "status": "not_ready",
                        "error": {"code": exc.code, "message": str(exc)},
                    },
                )
        return self._json(404, {"status": "failed", "error": {"code": "NOT_FOUND", "message": "Not found"}})

    def do_POST(self) -> None:
        path = urlparse(self.path).path
        if path != "/v1/commercial-proposals/generate":
            return self._json(404, {"status": "failed", "error": {"code": "NOT_FOUND", "message": "Not found"}})

        started_at = time.monotonic()
        request_id = self.headers.get("x-request-id") or str(uuid.uuid4())
        expected_secret = _configured_secret()
        if expected_secret is None:
            if not _allow_insecure_local_dev():
                _safe_log("generation_rejected", requestId=request_id, errorCode="SERVICE_NOT_READY")
                return self._json(503, {"status": "failed", "error": {"code": "SERVICE_NOT_READY", "message": "Service is not ready"}})
            _safe_log("insecure_local_dev_auth_bypass", requestId=request_id)
        authorization = self.headers.get("authorization", "")
        if expected_secret is not None and not _is_authorized(authorization, expected_secret):
            return self._json(401, {"status": "failed", "error": {"code": "UNAUTHORIZED", "message": "Unauthorized"}})

        try:
            raw_length = self.headers.get("content-length")
            if raw_length is None:
                return self._json(411, {"status": "failed", "error": {"code": "PAYLOAD_INVALID", "message": "Content-Length is required"}})
            try:
                length = int(raw_length)
            except ValueError:
                return self._json(400, {"status": "failed", "error": {"code": "PAYLOAD_INVALID", "message": "Invalid Content-Length"}})
            if length < 0:
                return self._json(400, {"status": "failed", "error": {"code": "PAYLOAD_INVALID", "message": "Invalid Content-Length"}})
            if length > _max_request_bytes():
                return self._json(413, {"status": "failed", "error": {"code": "PAYLOAD_TOO_LARGE", "message": "Request body is too large"}})
            raw_body = self.rfile.read(length)
            if len(raw_body) != length:
                return self._json(400, {"status": "failed", "error": {"code": "PAYLOAD_INVALID", "message": "Incomplete request body"}})
            try:
                request = json.loads(raw_body.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError) as error:
                raise DocumentGenerationError("PAYLOAD_INVALID", "Request body must be valid JSON") from error
            if not isinstance(request, dict):
                raise DocumentGenerationError("PAYLOAD_INVALID", "Request body must be an object")
            payload = request.get("payload")
            if not isinstance(payload, dict):
                raise DocumentGenerationError("PAYLOAD_INVALID", "payload must be an object")
            idempotency_key = request.get("idempotencyKey")
            if not isinstance(idempotency_key, str) or idempotency_key.strip() == "":
                raise DocumentGenerationError("PAYLOAD_INVALID", "idempotencyKey is required")
            config = config_from_environment(PROJECT_ROOT)
            template_path, mapping_path = resolve_template_paths(payload, PROJECT_ROOT)
            if config.pdf_engine != "libreoffice":
                raise DocumentGenerationError("PDF_EXPORT_FAILED", "Configured PDF engine is not supported")
            result = generate_documents(
                payload,
                template_path,
                mapping_path,
                config.temp_dir,
                storage=config.storage,
                idempotency_key=idempotency_key,
                snapshot_hash=request.get("snapshotHash"),
                libreoffice_binary=config.libreoffice_binary,
                timeout_seconds=config.timeout_seconds,
                signed_url_ttl_seconds=config.signed_url_ttl_seconds,
            )
            _safe_log(
                "generation_success",
                requestId=request.get("requestId") or request_id,
                proposalId=payload.get("proposal", {}).get("id") if isinstance(payload, dict) else None,
                generationId=result.get("generationId"),
                outputFormats=[file.get("format") for file in result.get("files", [])],
                durationMs=round((time.monotonic() - started_at) * 1000),
                result="success",
            )
            return self._json(200, result)
        except DocumentGenerationError as exc:
            status = 409 if exc.code == "GENERATION_IDEMPOTENCY_CONFLICT" else 503 if exc.code in {"DOCUMENT_STORAGE_FAILED", "SERVICE_NOT_READY"} else 400
            _safe_log("generation_failed", requestId=request_id, errorCode=exc.code, durationMs=round((time.monotonic() - started_at) * 1000), result="failed")
            return self._json(status, {"status": "failed", "error": {"code": exc.code, "message": str(exc)}})
        except Exception:
            _safe_log("generation_failed", requestId=request_id, errorCode="INTERNAL_ERROR", durationMs=round((time.monotonic() - started_at) * 1000), result="failed")
            return self._json(500, {"status": "failed", "error": {"code": "INTERNAL_ERROR", "message": "Internal error"}})


def main() -> None:
    host = os.environ.get("DOCUMENT_SERVICE_HOST", "0.0.0.0")
    port = int(os.environ.get("DOCUMENT_SERVICE_PORT", "8010"))
    if _configured_secret() is None and not _allow_insecure_local_dev():
        raise SystemExit("DOCUMENT_SERVICE_SECRET must contain at least 32 bytes")
    if _allow_insecure_local_dev() and host not in {"127.0.0.1", "::1", "localhost"}:
        raise SystemExit("Insecure local development mode may only bind to loopback")
    _safe_log("document_service_starting", host=host, port=port)
    ThreadingHTTPServer((host, port), Handler).serve_forever()


if __name__ == "__main__":
    main()
