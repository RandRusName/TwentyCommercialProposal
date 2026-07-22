import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const projectDirectory = resolve(import.meta.dirname, '..');
const applyChanges = process.argv.includes('--apply');

try {
  const contents = readFileSync(resolve(projectDirectory, '.env'), 'utf8');
  for (const sourceLine of contents.split(/\r?\n/u)) {
    const line = sourceLine.trim();
    if (line === '' || line.startsWith('#') || !line.includes('=')) continue;
    const separator = line.indexOf('=');
    const name = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim().replace(/^(['"])(.*)\1$/u, '$2');
    if (process.env[name] === undefined) process.env[name] = value;
  }
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}

const apiUrl = process.env.TWENTY_API_URL?.replace(/\/$/u, '');
const apiKey = process.env.TWENTY_API_KEY;
if (!apiUrl || !apiKey) throw new Error('TWENTY_API_URL and TWENTY_API_KEY are required');

const graphql = async (query, variables = {}) => {
  const response = await fetch(`${apiUrl}/graphql`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const text = await response.text();
  const payload = text === '' ? null : JSON.parse(text);
  if (!response.ok || payload?.errors) {
    throw new Error(payload?.errors?.map(({ message }) => message).join('; ') ?? `GraphQL ${response.status}`);
  }
  return payload.data;
};

const records = [];
let after = null;
do {
  const data = await graphql(`
    query ProposalNumberBackfill($after: String) {
      commercialProposals(first: 200, after: $after) {
        edges { node { id number finalNumberKey } }
        pageInfo { endCursor hasNextPage }
      }
    }
  `, { after });
  const connection = data.commercialProposals;
  records.push(...connection.edges.map(({ node }) => node));
  after = connection.pageInfo.hasNextPage ? connection.pageInfo.endCursor : null;
} while (after !== null);

const finalNumber = /^КП-(?<sequence>\d{3}) от \d{2}\.\d{2}\.(?<year>\d{4})$/u;
const candidates = [];
const owners = new Map();
for (const record of records) {
  const match = finalNumber.exec(record.number ?? '');
  if (!match?.groups) continue;
  const key = `${match.groups.year}:${match.groups.sequence}`;
  const owner = owners.get(key);
  if (owner !== undefined && owner !== record.id) {
    throw new Error(`Duplicate final number key ${key} on records ${owner} and ${record.id}; no changes applied`);
  }
  owners.set(key, record.id);
  if (record.finalNumberKey === null || record.finalNumberKey === undefined) {
    candidates.push({ id: record.id, key });
  } else if (record.finalNumberKey !== key) {
    throw new Error(`Record ${record.id} has inconsistent finalNumberKey; no changes applied`);
  }
}

console.log(JSON.stringify({ mode: applyChanges ? 'apply' : 'dry-run', total: records.length, candidates: candidates.length }, null, 2));
if (!applyChanges) process.exit(0);

for (const candidate of candidates) {
  const data = await graphql(`
    mutation BackfillProposalNumberKey($id: UUID!, $key: String!) {
      updateCommercialProposal(id: $id, data: { finalNumberKey: $key }) { id finalNumberKey }
    }
  `, candidate);
  if (data.updateCommercialProposal?.finalNumberKey !== candidate.key) {
    throw new Error(`Verification failed for proposal ${candidate.id}`);
  }
}
console.log(`Updated and verified final number keys: ${candidates.length}`);
