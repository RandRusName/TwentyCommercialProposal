from __future__ import annotations

import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from .generator import (
    DocumentGenerationError,
    config_from_environment,
    generate_documents,
    readiness,
)


PROJECT_ROOT = Path(__file__).resolve().parents[2]


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

        expected_secret = os.environ.get("DOCUMENT_SERVICE_SECRET", "")
        authorization = self.headers.get("authorization", "")
        if expected_secret and authorization != f"Bearer {expected_secret}":
            return self._json(401, {"status": "failed", "error": {"code": "UNAUTHORIZED", "message": "Unauthorized"}})

        length = int(self.headers.get("content-length", "0"))
        try:
            request = json.loads(self.rfile.read(length).decode("utf-8"))
            payload = request["payload"]
            idempotency_key = request.get("idempotencyKey")
            if not isinstance(idempotency_key, str) or idempotency_key.strip() == "":
                raise DocumentGenerationError("PAYLOAD_INVALID", "idempotencyKey is required")
            config = config_from_environment(PROJECT_ROOT)
            if config.pdf_engine != "libreoffice":
                raise DocumentGenerationError("PDF_EXPORT_FAILED", "Configured PDF engine is not supported")
            result = generate_documents(
                payload,
                config.template_path,
                config.mapping_path,
                config.temp_dir,
                storage=config.storage,
                idempotency_key=idempotency_key,
                libreoffice_binary=config.libreoffice_binary,
                timeout_seconds=config.timeout_seconds,
                signed_url_ttl_seconds=config.signed_url_ttl_seconds,
            )
            _safe_log(
                "generation_success",
                requestId=request.get("requestId"),
                proposalId=payload.get("proposal", {}).get("id") if isinstance(payload, dict) else None,
                generationId=result.get("generationId"),
                outputFormats=[file.get("format") for file in result.get("files", [])],
            )
            return self._json(200, result)
        except DocumentGenerationError as exc:
            _safe_log("generation_failed", code=exc.code)
            return self._json(400, {"status": "failed", "error": {"code": exc.code, "message": str(exc)}})
        except Exception:
            _safe_log("generation_failed", code="INTERNAL_ERROR")
            return self._json(500, {"status": "failed", "error": {"code": "INTERNAL_ERROR", "message": "Internal error"}})


def main() -> None:
    host = os.environ.get("DOCUMENT_SERVICE_HOST", "0.0.0.0")
    port = int(os.environ.get("DOCUMENT_SERVICE_PORT", "8010"))
    _safe_log("document_service_starting", host=host, port=port)
    ThreadingHTTPServer((host, port), Handler).serve_forever()


if __name__ == "__main__":
    main()

