#!/usr/bin/env node

const url = `${process.env.TWENTY_URL ?? 'http://192.168.100.11:3000'}/healthz`;

try {
  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
  const text = await response.text();

  if (!response.ok) {
    console.error(`ERROR: HTTP ${response.status} from ${url}`);
    process.exit(1);
  }

  if (!text.includes('"status":"ok"') && !text.includes('"status": "ok"')) {
    console.error(`ERROR: Unexpected health response from ${url}: ${text}`);
    process.exit(1);
  }

  process.stdout.write(text);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`ERROR: WSL cannot reach ${url}: ${message}`);
  process.exit(1);
}
