from __future__ import annotations

import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from .generator import DocumentGenerationError, generate_documents


PROJECT_ROOT = Path(__file__).resolve().parents[2]
TEMPLATE_PATH = PROJECT_ROOT / "templates" / "mikoton-commercial-proposal-v1.xlsm"
MAPPING_PATH = PROJECT_ROOT / "templates" / "mikoton-commercial-proposal-v1.mapping.json"
OUTPUT_DIR = PROJECT_ROOT / "generated-documents"


class Handler(BaseHTTPRequestHandler):
    server_version = "MikotonDocumentService/0.1"

    def _json(self, status: int, body: dict) -> None:
        payload = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("content-type", "application/json; charset=utf-8")
        self.send_header("content-length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path == "/healthz":
            return self._json(200, {"status": "ok"})
        if path == "/readyz":
            ready = TEMPLATE_PATH.exists() and MAPPING_PATH.exists()
            return self._json(200 if ready else 503, {"status": "ready" if ready else "not_ready"})
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
            result = generate_documents(payload, TEMPLATE_PATH, MAPPING_PATH, OUTPUT_DIR)
            return self._json(200, result)
        except DocumentGenerationError as exc:
            return self._json(400, {"status": "failed", "error": {"code": exc.code, "message": str(exc)}})
        except Exception:
            return self._json(500, {"status": "failed", "error": {"code": "INTERNAL_ERROR", "message": "Internal error"}})


def main() -> None:
    host = os.environ.get("DOCUMENT_SERVICE_HOST", "127.0.0.1")
    port = int(os.environ.get("DOCUMENT_SERVICE_PORT", "8010"))
    ThreadingHTTPServer((host, port), Handler).serve_forever()


if __name__ == "__main__":
    main()

