#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
PACKAGE_DIR="${REPO_ROOT}/package/investoday-api"
SKILL_DIR="${REPO_ROOT}/skills"

PACKAGE_NAME="@investoday/investoday-api"
NPM_REGISTRY="https://registry.npmjs.org/"
SKILL_SLUG="investoday-finance-data"
SKILL_NAME="InvestToday Finance Data"
SKILL_TAGS="stock,fund,etf,index,a-share,hk-stock,finance,financial-data,market-data,quote,macro-economics,quantitative,investment-research"

RUN_REMOTE_SYNC=false
CHANGELOG="Manual release"
RUN_TESTS=true
TEMP_NPMRC="${REPO_ROOT}/.npmrc.publish"

usage() {
  cat <<'EOF'
Usage:
  ./create/publish.sh [options]

Options:
  --remote            Fetch remote OpenAPI/tree and regenerate references before publishing
  --skip-tests        Skip Python and npm test steps
  --changelog TEXT    Changelog used for ClawHub publish
  -h, --help          Show this help

Examples:
  ./create/publish.sh
  ./create/publish.sh --remote --changelog "Update CLI capabilities and references"
EOF
}

log() {
  printf '\n==> %s\n' "$1"
}

fail() {
  printf 'ERROR: %s\n' "$1" >&2
  exit 1
}

cleanup() {
  rm -f "${TEMP_NPMRC}"
}

trap cleanup EXIT

require_bin() {
  command -v "$1" >/dev/null 2>&1 || fail "Required command not found: $1"
}

ensure_clawhub_auth() {
  if [[ -n "${CLAWHUB_TOKEN:-}" ]]; then
    log "Configuring ClawHub auth from CLAWHUB_TOKEN"
    mkdir -p "${HOME}/.config/clawhub"
    cat > "${HOME}/.config/clawhub/config.json" <<EOF
{"registry":"https://clawhub.ai","token":"${CLAWHUB_TOKEN}"}
EOF
  fi

  clawhub whoami >/dev/null
}

ensure_npm_auth() {
  if npm whoami --registry "${NPM_REGISTRY}" >/dev/null 2>&1; then
    return
  fi

  if [[ -n "${NPM_TOKEN:-}" ]]; then
    log "Configuring npm auth from NPM_TOKEN for ${NPM_REGISTRY}"
    export NPM_CONFIG_USERCONFIG="${TEMP_NPMRC}"
    cat > "${NPM_CONFIG_USERCONFIG}" <<EOF
registry=${NPM_REGISTRY}
//registry.npmjs.org/:_authToken=${NPM_TOKEN}
EOF
    npm whoami --registry "${NPM_REGISTRY}" >/dev/null 2>&1 || fail "npm authentication failed even after applying NPM_TOKEN"
    return
  fi

  fail "npm authentication is missing for ${NPM_REGISTRY}. Run 'npm login --registry ${NPM_REGISTRY}' first or export NPM_TOKEN."
}

trim() {
  printf '%s' "$1" | awk '{$1=$1;print}'
}

read_package_version() {
  node -p "require('${PACKAGE_DIR}/package.json').version"
}

read_skill_version() {
  awk '/^version:/ {print $2; exit}' "${SKILL_DIR}/SKILL.md"
}

check_clawhub_published_version() {
  clawhub inspect "${SKILL_SLUG}" 2>/dev/null | awk '/Latest:/ {print $2; exit}'
}

run_reference_sync() {
  if [[ "${RUN_REMOTE_SYNC}" == "true" ]]; then
    log "Regenerating references from remote metadata"
    python3 "${REPO_ROOT}/create/generate_references.py" --remote
  else
    log "Regenerating references from local metadata"
    python3 "${REPO_ROOT}/create/generate_references.py"
  fi
}

run_verification() {
  if [[ "${RUN_TESTS}" != "true" ]]; then
    log "Skipping tests"
    return
  fi

  log "Running generate_references tests"
  (
    cd "${REPO_ROOT}"
    python3 -m unittest discover -s tests -p 'test_*.py'
  )

  log "Running CLI tests"
  (
    cd "${PACKAGE_DIR}"
    npm test
    npm pack --dry-run >/dev/null
  )
}

publish_npm() {
  local local_version published_version
  local_version="$(trim "$(read_package_version)")"
  published_version="$(
    python3 - "${PACKAGE_NAME}" "${NPM_REGISTRY}" <<'EOF'
import json
import sys
import urllib.parse
import urllib.request

package_name = sys.argv[1]
registry = sys.argv[2].rstrip("/")
url = f"{registry}/{urllib.parse.quote(package_name, safe='')}/latest"

try:
    with urllib.request.urlopen(url, timeout=20) as response:
        payload = json.load(response)
    print(payload.get("version", ""))
except Exception:
    print("")
EOF
  )"
  published_version="$(trim "${published_version}")"

  log "npm package version: local=${local_version} published=${published_version:-<none>}"
  if [[ -n "${published_version}" && "${published_version}" == "${local_version}" ]]; then
    log "${PACKAGE_NAME}@${local_version} already published, skipping npm publish"
    return
  fi

  ensure_npm_auth

  log "Publishing ${PACKAGE_NAME}@${local_version} to npm"
  (
    cd "${PACKAGE_DIR}"
    npm publish --registry "${NPM_REGISTRY}" --access public
  )
}

publish_clawhub() {
  local local_version published_version
  local_version="$(trim "$(read_skill_version)")"
  published_version="$(trim "$(check_clawhub_published_version)")"

  log "ClawHub skill version: local=${local_version} published=${published_version:-<none>}"
  if [[ -n "${published_version}" && "${published_version}" == "${local_version}" ]]; then
    log "${SKILL_SLUG}@${local_version} already published, skipping ClawHub publish"
    return
  fi

  ensure_clawhub_auth

  log "Publishing ${SKILL_SLUG}@${local_version} to ClawHub"
  clawhub publish "${SKILL_DIR}" \
    --slug "${SKILL_SLUG}" \
    --name "${SKILL_NAME}" \
    --version "${local_version}" \
    --tags "${SKILL_TAGS}" \
    --changelog "${CHANGELOG}" \
    --no-input
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --remote)
      RUN_REMOTE_SYNC=true
      shift
      ;;
    --skip-tests)
      RUN_TESTS=false
      shift
      ;;
    --changelog)
      [[ $# -ge 2 ]] || fail "--changelog requires a value"
      CHANGELOG="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      fail "Unknown argument: $1"
      ;;
  esac
done

require_bin python3
require_bin node
require_bin npm
require_bin clawhub

run_reference_sync
run_verification
publish_npm
publish_clawhub

log "Done"
