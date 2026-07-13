#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const packagePath = path.join(process.cwd(), 'package.json');

if (!fs.existsSync(packagePath)) {
  console.error('ERROR: package.json was not found in the current directory.');
  process.exit(1);
}

const args = process.argv.slice(2);
let aboveVersion = null;

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === '--above') {
    aboveVersion = args[index + 1] ?? null;
    index += 1;
    continue;
  }

  console.error(`ERROR: Unknown argument: ${arg}`);
  console.error('Usage: node scripts/version-bump.mjs [--above <version>]');
  process.exit(1);
}

const parseSemver = (value) => {
  const match = String(value ?? '').match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    return null;
  }

  return [Number(match[1]), Number(match[2]), Number(match[3])];
};

const compareSemver = (left, right) => {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) {
      return left[index] - right[index];
    }
  }

  return 0;
};

const bumpPatch = (semver) => `${semver[0]}.${semver[1]}.${semver[2] + 1}`;

const raw = fs.readFileSync(packagePath, 'utf8');
let pkg;

try {
  pkg = JSON.parse(raw);
} catch (error) {
  console.error('ERROR: package.json is not valid JSON.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const currentSemver = parseSemver(pkg.version);

if (!currentSemver) {
  console.error(`ERROR: package.json version must be MAJOR.MINOR.PATCH, got "${pkg.version ?? ''}".`);
  process.exit(1);
}

let baseSemver = currentSemver;

if (aboveVersion !== null) {
  const aboveSemver = parseSemver(aboveVersion);
  if (!aboveSemver) {
    console.error(`ERROR: --above version must be MAJOR.MINOR.PATCH, got "${aboveVersion}".`);
    process.exit(1);
  }

  if (compareSemver(aboveSemver, baseSemver) > 0) {
    baseSemver = aboveSemver;
  }
}

const oldVersion = pkg.version;
const newVersion = bumpPatch(baseSemver);

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
