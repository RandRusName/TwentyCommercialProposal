#!/usr/bin/env bash
set -Eeuo pipefail

validate_tarball() {
  local tarball_abs="$1"
  local project_dir="${2:-}"

  if [[ -z "$tarball_abs" || ! -s "$tarball_abs" ]]; then
    echo "ERROR: Tarball is missing or has zero size: ${tarball_abs:-<empty>}" >&2
    return 1
  fi

  local tarball_list_file
  tarball_list_file="$(mktemp)"
  local tmp_dir=""
  local cleanup_needed=false

  cleanup_validate_temp() {
    trap - RETURN

    local list_file="${tarball_list_file:-}"
    local extracted_dir="${tmp_dir:-}"
    local should_cleanup="${cleanup_needed:-false}"

    if [[ -n "$list_file" ]]; then
      rm -f "$list_file"
    fi

    if [[ "$should_cleanup" == true && -n "$extracted_dir" && -d "$extracted_dir" ]]; then
      rm -rf "$extracted_dir"
    fi
  }

  trap cleanup_validate_temp RETURN

  tar -tzf "$tarball_abs" >"$tarball_list_file"

  echo "Verifying tarball contents..."
  if ! grep -Fq 'manifest.json' "$tarball_list_file"; then
    echo "ERROR: Tarball does not contain manifest.json" >&2
    return 1
  fi

  if ! grep -Fq 'front-components' "$tarball_list_file"; then
    echo "ERROR: Tarball does not contain front-components" >&2
    return 1
  fi

  if ! grep -Fq 'logic-functions' "$tarball_list_file"; then
    echo "ERROR: Tarball does not contain logic-functions" >&2
    return 1
  fi

  if grep -E '(^|/)\.env($|\.|/)' "$tarball_list_file" >/dev/null; then
    echo "ERROR: Tarball contains .env files" >&2
    return 1
  fi

  tmp_dir="$(mktemp -d)"
  cleanup_needed=true
  tar -xzf "$tarball_abs" -C "$tmp_dir"

  local manifest_path
  manifest_path="$(find "$tmp_dir" -type f -name 'manifest.json' | head -n1 || true)"
  if [[ -z "$manifest_path" ]]; then
    echo "ERROR: manifest.json was not found after extracting tarball" >&2
    return 1
  fi

  echo "Verifying manifest path separators and file references..."
  node - "$manifest_path" "$tarball_list_file" <<'NODE'
const fs = require('node:fs');

const manifestPath = process.argv[2];
const tarballListPath = process.argv[3];

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const tarballEntries = fs
  .readFileSync(tarballListPath, 'utf8')
  .split(/\r?\n/)
  .filter(Boolean);

const tarballSet = new Set(tarballEntries);

function collectPathReferences(value, key = '', results = []) {
  if (typeof value === 'string') {
    const isPathKey = key.endsWith('Path');
    const looksLikePackagePath =
      value.startsWith('src/') ||
      value.startsWith('src\\') ||
      value.startsWith('public/') ||
      value.startsWith('public\\') ||
      value.startsWith('generated/') ||
      value.startsWith('generated\\');

    if (isPathKey || looksLikePackagePath) {
      results.push({ key, value });
    }

    return results;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectPathReferences(item, key, results);
    }
    return results;
  }

  if (value && typeof value === 'object') {
    for (const [nestedKey, nestedValue] of Object.entries(value)) {
      collectPathReferences(nestedValue, nestedKey, results);
    }
  }

  return results;
}

function normalizeEntry(entry) {
  return entry.replace(/^\.\//, '').replace(/\/+$/g, '');
}

function entryExists(reference) {
  const normalized = normalizeEntry(reference);

  if (tarballSet.has(normalized)) {
    return true;
  }

  for (const entry of tarballEntries) {
    if (entry === normalized || entry.endsWith(`/${normalized}`)) {
      return true;
    }
  }

  return false;
}

const pathReferences = collectPathReferences(manifest);
const windowsPathReferences = pathReferences.filter(({ value }) => value.includes('\\'));

if (windowsPathReferences.length > 0) {
  console.error('ERROR: manifest contains Windows path separators.');
  for (const { key, value } of windowsPathReferences) {
    const label = key ? `${key}: ` : '';
    console.error(`  - ${label}${value}`);
  }
  process.exit(1);
}

const packagedPathReferences = pathReferences.filter(({ key, value }) => {
  if (key.startsWith('built') || key.endsWith('BuiltPath')) {
    return true;
  }

  return /\.(mjs|js|json|svg)$/.test(value);
});

const missingReferences = packagedPathReferences.filter(
  ({ value }) => !entryExists(value),
);

if (missingReferences.length > 0) {
  console.error('ERROR: manifest references files missing from tarball:');
  for (const { key, value } of missingReferences) {
    const label = key ? `${key}: ` : '';
    console.error(`  - ${label}${value}`);
  }
  process.exit(1);
}

const requiredUniqueIndexes = new Map([
  ['58fada7e-1d1d-499d-9c1f-c2c7b6f5e9ea', 'CommercialProposal.idempotencyKey'],
  ['ab410ad6-d6b5-41ef-bd6a-43e104671da0', 'CommercialProposal.finalNumberKey'],
]);
const manifestIndexes = Array.isArray(manifest.indexes) ? manifest.indexes : [];

for (const [universalIdentifier, label] of requiredUniqueIndexes) {
  const index = manifestIndexes.find(
    (candidate) => candidate.universalIdentifier === universalIdentifier,
  );

  if (!index || index.isUnique !== true) {
    console.error(
      `ERROR: manifest is missing required unique index ${label} (${universalIdentifier}).`,
    );
    process.exit(1);
  }
}

console.log(
  `Manifest validation: OK (${packagedPathReferences.length} packaged paths verified, forward slashes only, required unique indexes present)`,
);
NODE

  if [[ -n "$project_dir" ]]; then
    local source_logic_function="$project_dir/src/logic-functions/create-commercial-proposal-draft.logic-function.ts"
    if [[ -f "$source_logic_function" ]]; then
      echo "Verifying compiled logic function in tarball..."
      if ! grep -Fq 'create-commercial-proposal-draft.logic-function.mjs' "$tarball_list_file"; then
        echo "ERROR: Tarball does not contain create-commercial-proposal-draft.logic-function.mjs" >&2
        return 1
      fi
      if grep -F 'create-commercial-proposal-draft.logic-function.mjs' "$tarball_list_file" | grep -F '\\' >/dev/null; then
        echo "ERROR: Compiled logic function path in tarball uses Windows separators" >&2
        return 1
      fi
      echo "Logic function check: OK"
    fi
  fi

  return 0
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  if [[ $# -ne 1 ]]; then
    echo "Usage: $0 <tarball-path>" >&2
    exit 1
  fi

  PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  validate_tarball "$1" "$PROJECT_DIR"
fi
