#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const packagePath = path.join(process.cwd(), 'package.json');

if (!fs.existsSync(packagePath)) {
  console.error('ERROR: package.json was not found in the current directory.');
  process.exit(1);
}

const raw = fs.readFileSync(packagePath, 'utf8');
let pkg;

try {
  pkg = JSON.parse(raw);
} catch (error) {
  console.error('ERROR: package.json is not valid JSON.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const versionMatch = String(pkg.version ?? '').match(/^(\d+)\.(\d+)\.(\d+)$/);

if (!versionMatch) {
  console.error(`ERROR: package.json version must be MAJOR.MINOR.PATCH, got "${pkg.version ?? ''}".`);
  process.exit(1);
}

const oldVersion = pkg.version;
const major = Number(versionMatch[1]);
const minor = Number(versionMatch[2]);
const patch = Number(versionMatch[3]) + 1;
const newVersion = `${major}.${minor}.${patch}`;

const versionPattern = /("version"\s*:\s*")[^"]+(")/;

if (!versionPattern.test(raw)) {
  console.error('ERROR: Could not locate the "version" field in package.json.');
  process.exit(1);
}

const updated = raw.replace(versionPattern, `$1${newVersion}$2`);

if (!updated.includes(`"version": "${newVersion}"`) && !updated.includes(`"version":"${newVersion}"`)) {
  console.error('ERROR: Failed to update package.json version field.');
  process.exit(1);
}

fs.writeFileSync(packagePath, updated);

console.log(`Previous version: ${oldVersion}`);
console.log(`New version: ${newVersion}`);
