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

echo
# shellcheck source=/dev/null
source "$SCRIPT_DIR/validate-tarball.sh"
validate_tarball "$TARBALL_ABS" "$PROJECT_DIR"

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
