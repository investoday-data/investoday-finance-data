#!/usr/bin/env python3
import hashlib
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / "investoday-api.manifest.json"
PACKAGE_JSON_PATH = ROOT / "package" / "investoday-api" / "package.json"
SKILL_MD_PATH = ROOT / "skills" / "SKILL.md"
ZIP_PATH = ROOT / "investoday-finance-data.zip"


def read_skill_version():
    skill_text = SKILL_MD_PATH.read_text()
    version_match = re.search(r"^version:\s*['\"]?([^'\"\n]+)['\"]?\s*$", skill_text, re.MULTILINE)
    if not version_match:
        raise SystemExit("ERROR: version field not found in skills/SKILL.md")
    return version_match.group(1).strip()


def fail(message):
    raise SystemExit(f"ERROR: {message}")


def validate_clients(clients):
    if not isinstance(clients, list) or not clients:
        fail("clients config must be a non-empty array")

    client_ids = set()
    for client in clients:
        client_id = client.get("id")
        if not client_id:
            fail("client id is required")
        if client_id in client_ids:
            fail(f"duplicate client id: {client_id}")
        client_ids.add(client_id)

        if not client.get("name"):
            fail(f"client name is required: {client_id}")
        if not isinstance(client.get("targets"), list) or not client["targets"]:
            fail(f"client targets cannot be empty: {client_id}")

        for target in client["targets"]:
            if target.get("type") not in {"fixed", "discovery"}:
                fail(f"invalid target type: {target.get('type')}")
            if not isinstance(target.get("paths"), list) or not target["paths"]:
                fail("target paths cannot be empty")
            for target_path in target["paths"]:
                if not isinstance(target_path, str) or not target_path.startswith("$HOME/"):
                    fail(f"target path must start with $HOME/: {target_path}")


def main():
    manifest = json.loads(MANIFEST_PATH.read_text())
    package = json.loads(PACKAGE_JSON_PATH.read_text())
    skill_version = read_skill_version()

    if manifest.get("schemaVersion") != 1:
        fail("invalid schemaVersion")
    if manifest.get("updatePolicy", {}).get("skillInstallPolicy") != "existing-only":
        fail("invalid skillInstallPolicy")
    if manifest.get("updatePolicy", {}).get("local_task_cron") != "0 3 * * *":
        fail("invalid local_task_cron")

    node_package = manifest.get("nodePackage") or {}
    if node_package.get("name") != "@investoday/investoday-api":
        fail("invalid nodePackage.name")
    if node_package.get("packageManager") != "npm":
        fail("invalid nodePackage.packageManager")
    if node_package.get("version") != package["version"]:
        fail("node package version mismatch")

    skills = manifest.get("skills")
    if not isinstance(skills, list) or len(skills) != 1:
        fail("manifest must contain exactly one skill")
    skill = skills[0]
    if skill.get("name") != "investoday-finance-data":
        fail("invalid skill name")
    if skill.get("version") != skill_version:
        fail("skill version mismatch")
    if not skill.get("zipUrl", "").startswith("https://storage.txyun.investoday.net/application/skill-store/packages/"):
        fail("invalid skill zipUrl")
    if not re.fullmatch(r"[0-9a-f]{64}", skill.get("sha256", "")):
        fail("invalid skill zip sha256")
    actual_sha256 = hashlib.sha256(ZIP_PATH.read_bytes()).hexdigest()
    if skill["sha256"].lower() != actual_sha256:
        fail(f"skill zip sha256 mismatch: manifest={skill['sha256']} actual={actual_sha256}")

    validate_clients(manifest.get("clients"))
    print("manifest validation ok")


if __name__ == "__main__":
    main()
