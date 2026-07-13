#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

if [[ -s "$HOME/.nvm/nvm.sh" ]]; then
  # shellcheck source=/dev/null
  . "$HOME/.nvm/nvm.sh"
fi

REMOTE_NAME="mikoton-target"
TWENTY_URL="http://192.168.100.11:3000"
EXPECTED_TWENTY_VERSIONS=("v2.20.0" "2.20.0")

CLEAN_DEPS=false
NO_INSTALL=false
NO_BUMP=false

for arg in "$@"; do
  case "$arg" in
    --clean)
      CLEAN_DEPS=true
      ;;
    --no-install)
      NO_INSTALL=true
      ;;
    --no-bump)
      NO_BUMP=true
      ;;
    *)
      echo "ERROR: Unknown argument: $arg" >&2
      echo "Usage: $0 [--clean] [--no-install] [--no-bump]" >&2
      exit 1
      ;;
  esac
done

BACKUP_DIR=""
DEPLOY_SUCCEEDED=false
ORIGINAL_VERSION=""
NEW_VERSION=""
COMMIT_SHA=""
RELEASE_TARBALL_PATH=""
RELEASE_TARBALL_NAME=""
SHA256_HASH=""
INSTALL_ATTEMPTED=false
INSTALL_SUCCEEDED=false
PUBLISH_SUCCEEDED=false

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    fail "Required command not found in WSL: $1"
  fi
}

load_dotenv() {
  local env_file="$PROJECT_DIR/.env"

  if [[ ! -f "$env_file" ]]; then
    return 0
  fi

  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"
    line="$(echo "$line" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"

    if [[ -z "$line" || "$line" == \#* ]]; then
      continue
    fi

    if [[ "$line" != *"="* ]]; then
      continue
    fi

    local name="${line%%=*}"
    local value="${line#*=}"
    name="$(echo "$name" | sed -e 's/[[:space:]]*$//')"
    value="$(echo "$value" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
    value="${value%\"}"
    value="${value#\"}"
    value="${value%\'}"
    value="${value#\'}"

    if [[ -n "$name" ]]; then
      export "$name=$value"
    fi
  done <"$env_file"
}

windows_health_check() {
  local win_curl=""

  for candidate in \
    "/mnt/c/Windows/System32/curl.exe" \
    "/mnt/c/Windows/Sysnative/curl.exe"; do
    if [[ -x "$candidate" ]]; then
      win_curl="$candidate"
      break
    fi
  done

  if [[ -z "$win_curl" ]]; then
    return 1
  fi

  "$win_curl" -fsS --connect-timeout 10 "${TWENTY_URL}/healthz" >/dev/null 2>&1
}

assert_wsl_can_reach_twenty() {
  echo "Checking WSL network access to ${TWENTY_URL}..."

  if TWENTY_URL="$TWENTY_URL" node "$SCRIPT_DIR/network-preflight.mjs" >/dev/null 2>&1; then
    echo "WSL network access: OK"
    return 0
  fi

  echo "ERROR: WSL cannot reach ${TWENTY_URL}." >&2

  if windows_health_check; then
    echo "Windows can reach ${TWENTY_URL}, but WSL cannot." >&2
    echo "This is a WSL2 NAT limitation for internal LAN hosts." >&2
    echo "Fix it once with:" >&2
    echo "  powershell -ExecutionPolicy Bypass -File scripts/setup-wsl-mirrored-network.ps1 -Apply" >&2
    echo "Then run deploy.bat again." >&2
  else
    echo "Windows also cannot reach ${TWENTY_URL}." >&2
    echo "Verify VPN/internal network access and that Twenty is running." >&2
  fi

  exit 1
}

restore_version() {
  if [[ "$DEPLOY_SUCCEEDED" == true ]]; then
    return 0
  fi

  if [[ -n "$BACKUP_DIR" && -f "$BACKUP_DIR/package.json" ]]; then
    cp "$BACKUP_DIR/package.json" "$PROJECT_DIR/package.json"
    echo "Restored package.json to version ${ORIGINAL_VERSION} after failed deploy." >&2
  fi
}

cleanup_deploy() {
  restore_version

  if [[ -n "$BACKUP_DIR" && -d "$BACKUP_DIR" ]]; then
    rm -rf "$BACKUP_DIR"
  fi
}

trap cleanup_deploy EXIT

assert_clean_git_tree() {
  local git_status

  if ! git_status="$(git status --porcelain 2>&1)"; then
    fail "git status failed"
  fi

  if [[ -n "$git_status" ]]; then
    echo "ERROR: Git working tree must be clean before deploy.bat." >&2
    echo "Commit or stash local changes first:" >&2
    echo "$git_status" >&2
    exit 1
  fi
}

check_twenty_health() {
  local health_json

  echo "Checking Twenty health at ${TWENTY_URL}..."
  if ! health_json="$(TWENTY_URL="$TWENTY_URL" node "$SCRIPT_DIR/network-preflight.mjs")"; then
    fail "Twenty health check failed for ${TWENTY_URL}"
  fi

  if ! grep -Fq '"status":"ok"' <<<"$health_json" && ! grep -Fq '"status": "ok"' <<<"$health_json"; then
    fail "Twenty health check returned unexpected response: $health_json"
  fi

  local server_version
  server_version="$(TWENTY_URL="$TWENTY_URL" node - <<'NODE'
const serverUrl = process.env.TWENTY_URL;

async function main() {
  const response = await fetch(`${serverUrl}/client-config`, {
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    throw new Error(`client-config failed with HTTP ${response.status}`);
  }

  const config = await response.json();
  const version =
    config.appVersion ??
    config.version ??
    config.serverVersion ??
    config.sentry?.release ??
    config.data?.version ??
    '';

  process.stdout.write(String(version));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
NODE
)"

  local version_ok=false
  for expected in "${EXPECTED_TWENTY_VERSIONS[@]}"; do
    if [[ "$server_version" == "$expected" ]]; then
      version_ok=true
      break
    fi
  done

  if [[ "$version_ok" != true ]]; then
    fail "Unsupported Twenty version '${server_version}'. Expected v2.20.0"
  fi

  echo "Twenty server version: ${server_version}"
}

ensure_remote_ready() {
  local status_output
  local status_exit=0

  echo
  echo "Checking Twenty remote status..."
  set +e
  status_output="$(corepack yarn twenty remote:status 2>&1)"
  status_exit=$?
  set -e

  echo "$status_output"

  if [[ $status_exit -ne 0 ]]; then
    fail "twenty remote:status failed. Configure remote '${REMOTE_NAME}' and authentication first."
  fi

  if grep -Fq "$REMOTE_NAME" <<<"$status_output"; then
    if grep -Eiq "${REMOTE_NAME}.*(invalid|expired|unauthenticated|not authenticated|missing auth)" <<<"$status_output"; then
      fail "Remote '${REMOTE_NAME}' authentication is invalid. Reconfigure credentials before deploying."
    fi

    if grep -Fq "$TWENTY_URL" <<<"$status_output"; then
      echo "Remote check: OK (${REMOTE_NAME} -> ${TWENTY_URL})"
      return 0
    fi

    echo "WARNING: Remote '${REMOTE_NAME}' is configured, but ${TWENTY_URL} was not found in remote:status output."
    echo "Continuing with configured remote '${REMOTE_NAME}'."
    return 0
  fi

  load_dotenv

  if [[ -z "${TWENTY_API_KEY:-}" ]]; then
    fail "Remote '${REMOTE_NAME}' is not configured. Set TWENTY_API_KEY in WSL environment or local .env, then configure the remote manually."
  fi

  echo "Remote '${REMOTE_NAME}' was not found. Configuring it now..."
  corepack yarn twenty remote:add --as "$REMOTE_NAME" --url "$TWENTY_URL" --api-key "$TWENTY_API_KEY"
  echo "Remote configured: ${REMOTE_NAME}"
}

find_latest_tarball() {
  find .twenty/output -type f -name '*.tgz' -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -n1 | cut -d' ' -f2-
}

write_release_manifest() {
  local manifest_path="$PROJECT_DIR/release-artifacts/release-${NEW_VERSION}.json"
  local published_at
  published_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

  node - \
    "$manifest_path" \
    "$PACKAGE_NAME" \
    "$NEW_VERSION" \
    "$COMMIT_SHA" \
    "$RELEASE_TARBALL_NAME" \
    "$SHA256_HASH" \
    "$REMOTE_NAME" \
    "$published_at" \
    "$INSTALL_ATTEMPTED" \
    "$INSTALL_SUCCEEDED" <<'NODE'
const fs = require('node:fs');

const [
  ,
  manifestPath,
  appName,
  version,
  commitSha,
  tarball,
  sha256,
  publishedTo,
  publishedAt,
  installAttempted,
  installSucceeded,
] = process.argv;

const manifest = {
  appName,
  version,
  commitSha,
  tarball,
  sha256,
  publishedTo,
  publishedAt,
  installAttempted: installAttempted === 'true',
  installSucceeded: installSucceeded === 'true',
};

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
NODE

  echo "Release manifest: $manifest_path"
}

echo "=== Mikoton Commercial Proposals: WSL private deploy ==="
echo "Project directory: $PROJECT_DIR"
echo

require_command git
require_command node
require_command corepack
require_command curl
require_command sha256sum
require_command find
require_command cp
require_command mkdir

assert_clean_git_tree
COMMIT_SHA="$(git rev-parse HEAD)"

ORIGINAL_VERSION="$(node -p "require('./package.json').version")"
BACKUP_DIR="$(mktemp -d)"
cp "$PROJECT_DIR/package.json" "$BACKUP_DIR/package.json"

load_dotenv
assert_wsl_can_reach_twenty
check_twenty_health
ensure_remote_ready

if [[ "$NO_BUMP" == true ]]; then
  NEW_VERSION="$ORIGINAL_VERSION"
  echo
  echo "Skipping version bump (--no-bump). Using version ${NEW_VERSION}."
else
  echo
  echo "Bumping patch version..."
  node "$SCRIPT_DIR/version-bump.mjs"
  NEW_VERSION="$(node -p "require('./package.json').version")"
fi

echo
echo "Deploying version ${NEW_VERSION} (previous: ${ORIGINAL_VERSION})"

BUILD_ARGS=()
if [[ "$CLEAN_DEPS" == true ]]; then
  BUILD_ARGS+=(--clean)
fi

bash "$SCRIPT_DIR/build-wsl.sh" "${BUILD_ARGS[@]}"

PACKAGE_NAME="$(node -p "require('./package.json').name")"
RELEASE_TARBALL_NAME="${PACKAGE_NAME}-${NEW_VERSION}.tgz"
RELEASE_TARBALL_PATH="$PROJECT_DIR/release-artifacts/$RELEASE_TARBALL_NAME"

if [[ ! -s "$RELEASE_TARBALL_PATH" ]]; then
  fail "Expected release tarball was not created: $RELEASE_TARBALL_PATH"
fi

SHA256_HASH="$(sha256sum "$RELEASE_TARBALL_PATH" | awk '{print $1}')"

echo
echo "Private publishing to ${REMOTE_NAME}..."
if corepack yarn twenty app:publish --private -r "$REMOTE_NAME" .; then
  PUBLISH_SUCCEEDED=true
else
  fail "twenty app:publish failed"
fi

POST_PUBLISH_TARBALL="$(find_latest_tarball)"
if [[ -n "$POST_PUBLISH_TARBALL" && -s "$POST_PUBLISH_TARBALL" ]]; then
  echo
  echo "Re-validating tarball produced by app:publish..."
  POST_PUBLISH_TARBALL_ABS="$(cd "$(dirname "$POST_PUBLISH_TARBALL")" && pwd)/$(basename "$POST_PUBLISH_TARBALL")"
  # shellcheck source=/dev/null
  source "$SCRIPT_DIR/validate-tarball.sh"
  validate_tarball "$POST_PUBLISH_TARBALL_ABS" "$PROJECT_DIR"
  cp "$POST_PUBLISH_TARBALL_ABS" "$RELEASE_TARBALL_PATH"
  SHA256_HASH="$(sha256sum "$RELEASE_TARBALL_PATH" | awk '{print $1}')"
fi

if [[ "$NO_INSTALL" == true ]]; then
  echo
  echo "Skipping install/upgrade (--no-install)."
  echo "Open Settings -> Applications in Twenty to install version ${NEW_VERSION} manually."
else
  echo
  echo "Installing or upgrading app on ${REMOTE_NAME}..."
  INSTALL_ATTEMPTED=true
  if corepack yarn twenty app:install -r "$REMOTE_NAME" .; then
    INSTALL_SUCCEEDED=true
  else
    fail "twenty app:install failed"
  fi
fi

write_release_manifest
DEPLOY_SUCCEEDED=true

WIN_TARBALL_PATH="$(wslpath -w "$RELEASE_TARBALL_PATH")"

echo
echo "DEPLOY SUCCESSFUL"
echo
echo "Previous version:"
echo "$ORIGINAL_VERSION"
echo
echo "Published version:"
echo "$NEW_VERSION"
echo
echo "Tarball:"
echo "$WIN_TARBALL_PATH"
echo
echo "SHA-256:"
echo "$SHA256_HASH"
echo
echo "Publish result:"
echo "$([[ "$PUBLISH_SUCCEEDED" == true ]] && echo SUCCESS || echo FAILED)"
echo
if [[ "$INSTALL_ATTEMPTED" == true ]]; then
  echo "Install/upgrade result:"
  echo "$([[ "$INSTALL_SUCCEEDED" == true ]] && echo SUCCESS || echo FAILED)"
else
  echo "Installation status:"
  echo "skipped (--no-install)"
fi

if [[ "$INSTALL_ATTEMPTED" == true && "$INSTALL_SUCCEEDED" != true ]]; then
  echo "Installation status: requires UI verification"
fi

if [[ "$NO_BUMP" != true ]]; then
  echo
  echo "Version was updated in package.json."
  echo "Commit this change when ready."
fi
