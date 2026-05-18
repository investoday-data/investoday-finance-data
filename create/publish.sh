#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
PACKAGE_DIR="${REPO_ROOT}/package/investoday-api"
SKILL_DIR="${REPO_ROOT}/skills"
OPENAPI_FILE="${REPO_ROOT}/create/openapi.json"

PACKAGE_NAME="@investoday/investoday-api"
NPM_REGISTRY="https://registry.npmjs.org/"
SKILL_SLUG="investoday-finance-data"
SKILL_NAME="InvestToday Finance Data"
SKILL_TAGS="stock,fund,etf,index,a-share,hk-stock,finance,financial-data,market-data,quote,macro-economics,quantitative,investment-research"

RUN_REMOTE_SYNC=true
CHANGELOG="Manual release"
RUN_TESTS=true
RUN_NPM_PUBLISH=true
RUN_GIT_PUSH=true
TEMP_NPMRC="${REPO_ROOT}/.npmrc.publish"

usage() {
  cat <<'EOF'
Usage:
  ./create/publish.sh [options]

Options:
  --remote            Fetch remote OpenAPI/tree and regenerate references before publishing (default)
  --local             Use local cached openapi.json/tree.json instead of fetching remote metadata
  --skip-tests        Skip Python and npm test steps
  --skip-npm          Skip npm publish and only publish the skill
  --skip-git          Skip git commit and push after publishing
  --changelog TEXT    Changelog used for ClawHub publish
  -h, --help          Show this help

When remote openapi.json changes, npm package and skill patch versions are bumped automatically.
After a successful publish, generated docs, version metadata, and release scripts are committed and pushed.

Examples:
  ./create/publish.sh
  ./create/publish.sh --local
  ./create/publish.sh --skip-npm
  ./create/publish.sh --skip-git
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
  if [[ -n "${CLAWHUB_TOKEN:-}${CLAWDHUB_TOKEN:-}" ]]; then
    log "Using ClawHub auth from token environment"
    return
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

  if [[ "${GITHUB_ACTIONS:-}" == "true" ]]; then
    log "Using npm trusted publishing from GitHub Actions OIDC"
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

file_hash() {
  if [[ ! -f "$1" ]]; then
    printf '__missing__\n'
    return
  fi

  python3 - "$1" <<'EOF'
import hashlib
import sys
from pathlib import Path

print(hashlib.sha256(Path(sys.argv[1]).read_bytes()).hexdigest())
EOF
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

bump_versions_if_openapi_changed() {
  local previous_hash current_hash
  previous_hash="$1"

  if [[ "${RUN_REMOTE_SYNC}" != "true" ]]; then
    log "OpenAPI remote sync disabled; version auto-bump skipped"
    return
  fi

  current_hash="$(file_hash "${OPENAPI_FILE}")"
  if [[ "${previous_hash}" == "${current_hash}" ]]; then
    log "OpenAPI unchanged; keeping current npm and skill versions"
    return
  fi

  log "OpenAPI changed; bumping npm package and skill patch versions"
  python3 - "${PACKAGE_DIR}/package.json" "${SKILL_DIR}/SKILL.md" <<'EOF'
import json
import re
import sys
from pathlib import Path

package_json_path = Path(sys.argv[1])
skill_md_path = Path(sys.argv[2])


def bump_patch(version: str) -> str:
    match = re.fullmatch(r"(\d+)\.(\d+)\.(\d+)", version.strip())
    if not match:
        raise SystemExit(f"Unsupported version format: {version}")
    major, minor, patch = match.groups()
    return f"{major}.{minor}.{int(patch) + 1}"


package_json = json.loads(package_json_path.read_text(encoding="utf-8"))
old_package_version = package_json["version"]
new_package_version = bump_patch(old_package_version)
package_json["version"] = new_package_version
package_json_path.write_text(
    json.dumps(package_json, ensure_ascii=False, indent=2) + "\n",
    encoding="utf-8",
)

skill_text = skill_md_path.read_text(encoding="utf-8")
version_pattern = re.compile(r"(?m)^version:\s*([0-9]+\.[0-9]+\.[0-9]+)\s*$")
match = version_pattern.search(skill_text)
if not match:
    raise SystemExit(f"Could not find plain semver version in {skill_md_path}")

old_skill_version = match.group(1)
new_skill_version = bump_patch(old_skill_version)
skill_text = version_pattern.sub(f"version: {new_skill_version}", skill_text, count=1)
skill_md_path.write_text(skill_text, encoding="utf-8")

print(f"  npm package: {old_package_version} -> {new_package_version}")
print(f"  skill: {old_skill_version} -> {new_skill_version}")
EOF
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
  if [[ "${RUN_NPM_PUBLISH}" != "true" ]]; then
    log "Skipping npm publish"
    return
  fi

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
  node "${REPO_ROOT}/create/clawhub_publish_with_timeout.js" "${SKILL_DIR}" \
    --slug "${SKILL_SLUG}" \
    --name "${SKILL_NAME}" \
    --version "${local_version}" \
    --tags "${SKILL_TAGS}" \
    --changelog "${CHANGELOG}"
}

commit_and_push_release() {
  if [[ "${RUN_GIT_PUSH}" != "true" ]]; then
    log "Skipping git commit and push"
    return
  fi

  local local_version branch
  local_version="$(trim "$(read_skill_version)")"

  log "Committing generated docs and version metadata"
  (
    cd "${REPO_ROOT}"
    git add \
      create/clawhub_publish_with_timeout.js \
      create/openapi.json \
      create/publish.sh \
      create/tree.json \
      package/investoday-api/data/openapi.json \
      package/investoday-api/data/tree.json \
      package/investoday-api/package.json \
      skills/SKILL.md \
      skills/docs/references-index.md \
      skills/docs/references-index.en.md \
      skills/references

    if git diff --cached --quiet; then
      log "No generated docs or version metadata changes to commit"
      return
    fi

    git commit -m "release: docs ${local_version}"

    branch="$(git rev-parse --abbrev-ref HEAD)"
    if [[ "${branch}" == "HEAD" ]]; then
      fail "Cannot push from detached HEAD"
    fi

    log "Pushing branch ${branch}"
    git push origin "${branch}"
  )
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --remote)
      RUN_REMOTE_SYNC=true
      shift
      ;;
    --local)
      RUN_REMOTE_SYNC=false
      shift
      ;;
    --skip-tests)
      RUN_TESTS=false
      shift
      ;;
    --skip-npm)
      RUN_NPM_PUBLISH=false
      shift
      ;;
    --skip-git)
      RUN_GIT_PUSH=false
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
require_bin git

openapi_hash_before="$(file_hash "${OPENAPI_FILE}")"
run_reference_sync
bump_versions_if_openapi_changed "${openapi_hash_before}"
run_verification
publish_npm
publish_clawhub
commit_and_push_release

log "Done"
