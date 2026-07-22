#!/usr/bin/env node

const DEFAULT_ROUTE_PATH = '/s/commercial-proposals/opportunity-context';
const PROBE_OPPORTUNITY_ID = '00000000-0000-4000-8000-000000000000';

const args = new Set(process.argv.slice(2));
const allowMissingRoute = args.has('--allow-missing-route');

const baseUrl = (
  process.env.TWENTY_API_URL ??
  process.env.TWENTY_URL
);
if (!baseUrl) {
  console.error('ERROR: TWENTY_API_URL (or TWENTY_URL) is required for logic function runtime preflight.');
  process.exit(1);
}
const normalizedBaseUrl = baseUrl.replace(/\/$/, '');
const apiKey = process.env.TWENTY_API_KEY;

const routeUrl = `${normalizedBaseUrl}${DEFAULT_ROUTE_PATH}`;

const printSafe = (message, details = undefined) => {
  if (details === undefined) {
    console.log(message);
    return;
  }

  console.log(`${message} ${JSON.stringify(details)}`);
};

if (!apiKey) {
  console.error('ERROR: TWENTY_API_KEY is required for logic function runtime preflight.');
  process.exit(1);
}

let response;
let responseText = '';

try {
  response = await fetch(routeUrl, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ opportunityId: PROBE_OPPORTUNITY_ID }),
    signal: AbortSignal.timeout(10000),
  });
  responseText = await response.text();
} catch (error) {
  console.error('ERROR: logic function runtime preflight network failure.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

let body = null;
if (responseText.trim() !== '') {
  try {
    body = JSON.parse(responseText);
  } catch {
    body = null;
  }
}

const safeDiagnostics = {
  routeUrl,
  responseStatus: response.status,
  responseStatusText: response.statusText,
  responseBodyPresent: responseText.trim() !== '',
  responseCode: body?.code ?? body?.error?.code ?? null,
};

if (
  body?.status === 'failed' &&
  body?.error?.code === 'OPPORTUNITY_NOT_FOUND'
) {
  printSafe('Logic function runtime preflight: OK.', safeDiagnostics);
  process.exit(0);
}

if (response.status === 404 && allowMissingRoute) {
  printSafe(
    'Logic function runtime preflight: route is not installed yet; skipping pre-install runtime assertion.',
    safeDiagnostics,
  );
  process.exit(0);
}

const messages = Array.isArray(body?.messages) ? body.messages.join(' ') : '';
const isDisabledRuntime =
  response.status === 403 &&
  body?.code === 'FORBIDDEN_EXCEPTION' &&
  messages.includes('Logic function execution failed');

if (isDisabledRuntime) {
  console.error('ERROR: Twenty logic function execution is disabled on the target server.');
  console.error('Fix the Twenty server environment and restart Twenty before deploying this app:');
  console.error('  LOGIC_FUNCTION_TYPE=LOCAL');
  console.error('or configure the Lambda runtime:');
  console.error('  LOGIC_FUNCTION_TYPE=LAMBDA');
  console.error('Safe diagnostics:');
  console.error(JSON.stringify(safeDiagnostics, null, 2));
  process.exit(1);
}

if (response.status === 401 || response.status === 403) {
  console.error('ERROR: app route preflight was rejected before a structured app response.');
  console.error('Check Twenty API key, app installation, and route authentication.');
  console.error('Safe diagnostics:');
  console.error(JSON.stringify(safeDiagnostics, null, 2));
  process.exit(1);
}

console.error('ERROR: unexpected logic function runtime preflight response.');
console.error('Expected structured OPPORTUNITY_NOT_FOUND from the app handler.');
console.error('Safe diagnostics:');
console.error(JSON.stringify(safeDiagnostics, null, 2));
process.exit(1);
