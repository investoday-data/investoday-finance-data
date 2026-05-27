#!/usr/bin/env python3
import hashlib
import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ZIP_PATH = ROOT / "investoday-finance-data.zip"
MANIFEST_PATH = ROOT / "investoday-api.manifest.json"
CLIENTS_PATH = ROOT / "configs" / "investoday-api.clients.json"
PACKAGE_JSON_PATH = ROOT / "package" / "investoday-api" / "package.json"
SKILL_MD_PATH = ROOT / "skills" / "SKILL.md"


def read_skill_version():
    skill_text = SKILL_MD_PATH.read_text()
    version_match = re.search(r"^version:\s*['\"]?([^'\"\n]+)['\"]?\s*$", skill_text, re.MULTILINE)
    if not version_match:
        raise SystemExit("ERROR: version field not found in skills/SKILL.md")
    return version_match.group(1).strip()


def main():
    package = json.loads(PACKAGE_JSON_PATH.read_text())
    clients = json.loads(CLIENTS_PATH.read_text())
    skill_version = read_skill_version()
    sha256 = hashlib.sha256(ZIP_PATH.read_bytes()).hexdigest()

    manifest = {
        "schemaVersion": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "updatePolicy": {
            "skillInstallPolicy": "existing-only",
            "local_task_cron": "0 3 * * *",
        },
        "nodePackage": {
            "name": "@investoday/investoday-api",
            "version": package["version"],
            "packageManager": "npm",
        },
        "skills": [
            {
                "name": "investoday-finance-data",
                "version": skill_version,
                "zipUrl": "https://storage.txyun.investoday.net/application/skill-store/packages/investoday-finance-data/investoday-finance-data.zip",
                "sha256": sha256,
            }
        ],
        "clients": clients,
    }

    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")

    manifest_sha256 = hashlib.sha256(MANIFEST_PATH.read_bytes()).hexdigest()
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary_path:
        with Path(summary_path).open("a") as summary:
            summary.write("## Investoday update manifest\n\n")
            summary.write(f"- nodePackage.version: `{manifest['nodePackage']['version']}`\n")
            summary.write(f"- skill.version: `{manifest['skills'][0]['version']}`\n")
            summary.write(f"- skill.zip.sha256: `{sha256}`\n")
            summary.write(f"- manifest.sha256: `{manifest_sha256}`\n")
            summary.write("- manifest.path: `investoday-api.manifest.json`\n")


if __name__ == "__main__":
    main()
