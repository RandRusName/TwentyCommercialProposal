import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const projectDirectory = resolve(import.meta.dirname, '..');
const applyChanges = process.argv.includes('--apply');

const loadDotEnv = () => {
  try {
    const contents = readFileSync(resolve(projectDirectory, '.env'), 'utf8');
    for (const sourceLine of contents.split(/\r?\n/u)) {
      const line = sourceLine.trim();
      if (line === '' || line.startsWith('#') || !line.includes('=')) continue;
      const separator = line.indexOf('=');
      const name = line.slice(0, separator).trim();
      const value = line
        .slice(separator + 1)
        .trim()
        .replace(/^(['"])(.*)\1$/u, '$2');
      if (process.env[name] === undefined) process.env[name] = value;
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
};

loadDotEnv();

const apiUrl = process.env.TWENTY_API_URL?.replace(/\/$/u, '');
const apiKey = process.env.TWENTY_API_KEY;

if (apiUrl === undefined || apiKey === undefined || apiKey === '') {
  throw new Error('TWENTY_API_URL and TWENTY_API_KEY must be set in the environment or .env');
}

const graphql = async (query, variables = {}) => {
  const response = await fetch(`${apiUrl}/graphql`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });
  const responseText = await response.text();
  const payload = responseText === '' ? null : JSON.parse(responseText);
  if (!response.ok || payload?.errors !== undefined) {
    const details = payload?.errors
      ?.map((item) => item.message)
      .join('; ');
    throw new Error(details ?? `GraphQL request failed with ${response.status}`);
  }
  return payload.data;
};

const data = await graphql(`
  query CatalogNativePriceBackfill {
    catalogItems(first: 500) {
      edges {
        node {
          id
          name
          defaultPrice
          currencyCode
          price {
            amountMicros
            currencyCode
          }
        }
      }
    }
  }
`);

const records = (data.catalogItems?.edges ?? []).map((edge) => edge.node);
const candidates = records.filter((record) => {
  if (record.price?.amountMicros !== null && record.price?.amountMicros !== undefined) return false;
  return (
    typeof record.defaultPrice === 'number' &&
    Number.isFinite(record.defaultPrice) &&
    typeof record.currencyCode === 'string' &&
    /^[A-Z]{3}$/u.test(record.currencyCode)
  );
});

console.log(`Catalog records: ${records.length}`);
console.log(`Native price backfill candidates: ${candidates.length}`);

if (!applyChanges) {
  console.log('Dry run only. Re-run with --apply to update candidates.');
  process.exit(0);
}

for (const record of candidates) {
  const amountMicros = Math.round(record.defaultPrice * 1_000_000);
  const result = await graphql(
    `
      mutation UpdateCatalogNativePrice(
        $id: UUID!
        $price: CurrencyAmountInput!
      ) {
        updateCatalogItem(id: $id, data: { price: $price }) {
          id
          price {
            amountMicros
            currencyCode
          }
        }
      }
    `,
    {
      id: record.id,
      price: {
        amountMicros,
        currencyCode: record.currencyCode,
      },
    },
  );
  const updated = result.updateCatalogItem;
  if (
    updated.price?.amountMicros !== amountMicros ||
    updated.price?.currencyCode !== record.currencyCode
  ) {
    throw new Error(`Native price verification failed for catalog item ${record.id}`);
  }
}

console.log(`Updated and verified native prices: ${candidates.length}`);
