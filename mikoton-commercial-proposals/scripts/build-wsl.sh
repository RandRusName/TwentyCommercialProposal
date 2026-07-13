#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

if [[ -s "$HOME/.nvm/nvm.sh" ]]; then
  # shellcheck source=/dev/null
  . "$HOME/.nvm/nvm.sh"
fi

CLEAN_DEPS=false
for arg in "$@"; do
  case "$arg" in
    --clean)
      CLEAN_DEPS=true
      ;;
    *)
      echo "ERROR: Unknown argument: $arg"
      echo "Usage: $0 [--clean]"
      exit 1
      ;;
  esac
done

TMP_DIR=""
cleanup() {
  if [[ -n "$TMP_DIR" && -d "$TMP_DIR" ]]; then
    rm -rf "$TMP_DIR"
  fi
}
trap cleanup EXIT

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    fail "Required command not found in WSL: $1"
  fi
}

version_ge() {
  local current="${1#v}"
  local required="${2#v}"
  if [[ "$current" == "$required" ]]; then
    return 0
  fi
  local winner
  winner="$(printf '%s\n%s\n' "$required" "$current" | sort -V | tail -n1)"
  [[ "$winner" == "$current" ]]
}

echo "=== Mikoton Commercial Proposals: WSL build ==="
echo "Project directory: $PROJECT_DIR"
echo

require_command node
require_command corepack
require_command tar
require_command sha256sum
require_command find
require_command grep
require_command mktemp
require_command cp
require_command mkdir
require_command rm

NODE_VERSION="$(node --version)"
NODE_VERSION_NUMBER="${NODE_VERSION#v}"
REQUIRED_NODE_VERSION="24.5.0"

echo "Node.js version: $NODE_VERSION"
if ! version_ge "$NODE_VERSION_NUMBER" "$REQUIRED_NODE_VERSION"; then
  echo "ERROR: Node.js $NODE_VERSION found, but >= v$REQUIRED_NODE_VERSION is required." >&2
  echo "Install Node.js 24 inside WSL using nvm." >&2
  exit 1
fi

echo "Cleaning generated build artifacts..."
rm -rf .twenty/output
rm -rf release-artifacts

if [[ "$CLEAN_DEPS" == true ]]; then
  echo "Removing node_modules (--clean)..."
  rm -rf node_modules
fi

if [[ "$CLEAN_DEPS" != true && -d node_modules ]]; then
  if ! node -e "require('sharp')" >/dev/null 2>&1; then
    fail "node_modules were installed for Windows and cannot be used inside WSL. Run build.bat --clean to reinstall dependencies in WSL."
  fi
fi

echo
echo "Installing dependencies..."
corepack yarn install --immutable

echo
echo "Running lint..."
corepack yarn lint

echo
echo "Running typecheck..."
corepack yarn typecheck

echo
echo "Running unit tests..."
corepack yarn test:unit

echo
echo "Building Twenty App tarball..."
corepack yarn twenty dev:build --tarball .

TARBALL="$(find .twenty/output -type f -name '*.tgz' -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -n1 | cut -d' ' -f2-)"
if [[ -z "$TARBALL" ]]; then
  fail "No .tgz tarball found under .twenty/output"
fi

if [[ ! -s "$TARBALL" ]]; then
  fail "Tarball is missing or has zero size: $TARBALL"
fi

TARBALL_ABS="$(cd "$(dirname "$TARBALL")" && pwd)/$(basename "$TARBALL")"
TARBALL_LIST_FILE="$(mktemp)"
tar -tzf "$TARBALL_ABS" >"$TARBALL_LIST_FILE"

echo
echo "Verifying tarball contents..."
if ! grep -Fq 'manifest.json' "$TARBALL_LIST_FILE"; then
  fail "Tarball does not contain manifest.json"
fi

if ! grep -Fq 'front-components' "$TARBALL_LIST_FILE"; then
  fail "Tarball does not contain front-components"
fi

if ! grep -Fq 'logic-functions' "$TARBALL_LIST_FILE"; then
  fail "Tarball does not contain logic-functions"
fi

if grep -E '(^|/)\.env($|\.|/)' "$TARBALL_LIST_FILE" >/dev/null; then
  fail "Tarball contains .env files"
fi

TMP_DIR="$(mktemp -d)"
tar -xzf "$TARBALL_ABS" -C "$TMP_DIR"

MANIFEST_PATH="$(find "$TMP_DIR" -type f -name 'manifest.json' | head -n1 || true)"
if [[ -z "$MANIFEST_PATH" ]]; then
  fail "manifest.json was not found after extracting tarball"
fi

echo
echo "Verifying manifest path separators and file references..."
MANIFEST_CHECK_OUTPUT="$(
  node - "$MANIFEST_PATH" "$TARBALL_LIST_FILE" <<'NODE'
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

console.log(
  `Manifest validation: OK (${packagedPathReferences.length} packaged paths verified, forward slashes only)`,
);
NODE
)"

echo "$MANIFEST_CHECK_OUTPUT"

SOURCE_LOGIC_FUNCTION="src/logic-functions/create-commercial-proposal-draft.logic-function.ts"
if [[ -f "$SOURCE_LOGIC_FUNCTION" ]]; then
  echo
  echo "Verifying compiled logic function in tarball..."
  if ! grep -Fq 'create-commercial-proposal-draft.logic-function.mjs' "$TARBALL_LIST_FILE"; then
    fail "Tarball does not contain create-commercial-proposal-draft.logic-function.mjs"
  fi
  if grep -F 'create-commercial-proposal-draft.logic-function.mjs' "$TARBALL_LIST_FILE" | grep -F '\\' >/dev/null; then
    fail "Compiled logic function path in tarball uses Windows separators"
  fi
  echo "Logic function check: OK"
fi

PACKAGE_NAME="$(node -p "require('./package.json').name")"
PACKAGE_VERSION="$(node -p "require('./package.json').version")"
RELEASE_ARTIFACT_DIR="$PROJECT_DIR/release-artifacts"
RELEASE_TARBALL_NAME="${PACKAGE_NAME}-${PACKAGE_VERSION}.tgz"
RELEASE_TARBALL_PATH="$RELEASE_ARTIFACT_DIR/$RELEASE_TARBALL_NAME"

mkdir -p "$RELEASE_ARTIFACT_DIR"
cp "$TARBALL_ABS" "$RELEASE_TARBALL_PATH"

TARBALL_SIZE_BYTES="$(stat -c '%s' "$RELEASE_TARBALL_PATH")"
SHA256_LINE="$(sha256sum "$RELEASE_TARBALL_PATH")"
SHA256_HASH="${SHA256_LINE%% *}"

WIN_TARBALL_PATH="$(wslpath -w "$RELEASE_TARBALL_PATH")"

echo
echo "BUILD SUCCESSFUL"
echo
echo "Tarball:"
echo "$WIN_TARBALL_PATH"
echo
echo "WSL path:"
echo "$RELEASE_TARBALL_PATH"
echo
echo "Size:"
echo "$TARBALL_SIZE_BYTES bytes"
echo
echo "SHA-256:"
echo "$SHA256_HASH"
