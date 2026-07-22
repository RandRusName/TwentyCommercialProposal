import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';

const appRoot = resolve(import.meta.dirname, '..');
const shippingGlobs = [
  'src/front-components',
  'src/logic-functions',
  'src/services',
  'src/application-config.ts',
  'src/domain',
  'document-service/mikoton_document_service',
];

const tracked = execFileSync('git', ['ls-files', '-z'], {
  cwd: appRoot,
  encoding: 'utf8',
})
  .split('\0')
  .filter(Boolean);

const shippingFiles = tracked.filter((relativePath) =>
  shippingGlobs.some(
    (prefix) =>
      relativePath === prefix ||
      relativePath.startsWith(`${prefix}/`) ||
      relativePath.replace(/\\/g, '/').startsWith(prefix),
  ),
);

const patterns = [
  ['RFC1918 192.168.', /\b192\.168\.\d{1,3}\.\d{1,3}\b/u],
  ['RFC1918 10.', /\b10\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/u],
  ['RFC1918 172.16-31.', /\b172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}\b/u],
  ['localhost production fallback', /TARGET_TWENTY_API_URL|http:\/\/localhost:\d{2,5}(?![^\n]*(test|example|vitest|dev))/iu],
];

const failures = [];

for (const relativePath of shippingFiles) {
  const normalized = relativePath.replace(/\\/g, '/');
  if (normalized.includes('__tests__') || normalized.endsWith('.test.ts')) {
    continue;
  }
  let contents;
  try {
    contents = readFileSync(resolve(appRoot, relativePath), 'utf8');
  } catch {
    continue;
  }
  for (const [label, pattern] of patterns) {
    if (pattern.test(contents)) {
      failures.push(`${relative(appRoot, resolve(appRoot, relativePath))}: ${label}`);
    }
  }
}

if (failures.length > 0) {
  console.error('Private-network URL scan failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(
  `Private-network URL scan passed for ${shippingFiles.length} shipping runtime files.`,
);
