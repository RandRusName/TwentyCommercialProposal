import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repositoryRoot = resolve(import.meta.dirname, '..', '..');
const tracked = execFileSync('git', ['ls-files', '-z'], {
  cwd: repositoryRoot,
  encoding: 'utf8',
}).split('\0').filter(Boolean);

const failures = [];
const patterns = [
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u],
  ['JWT-like token', /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/u],
  ['hardcoded bearer token', /Authorization\s*[:=]\s*["'`]Bearer\s+(?!<|\$|\{)[A-Za-z0-9._-]{24,}/iu],
];

for (const relativePath of tracked) {
  if (/(^|\/)\.env(?:\.|$)/u.test(relativePath) && !relativePath.endsWith('.env.example')) {
    failures.push(`${relativePath}: tracked environment file`);
    continue;
  }
  let contents;
  try {
    contents = readFileSync(resolve(repositoryRoot, relativePath), 'utf8');
  } catch {
    continue;
  }
  for (const [label, pattern] of patterns) {
    if (pattern.test(contents)) failures.push(`${relativePath}: ${label}`);
  }
}

if (failures.length > 0) {
  console.error('Secret scan failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log(`Secret scan passed for ${tracked.length} tracked files.`);
