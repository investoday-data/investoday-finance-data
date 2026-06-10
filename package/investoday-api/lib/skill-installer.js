const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const BASE_SKILL_NAME = "investoday-finance-data";
const DEFAULT_SKILL_PACKAGE_BASE_URL = "https://storage.txyun.investoday.net/application/skill-store/packages";

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function normalizeSkillName(name) {
  const skillName = String(name || "").trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(skillName)) {
    throw new Error("skill 名称只能包含字母、数字、下划线和中划线，且不能包含路径分隔符");
  }
  return skillName;
}

function buildSkillPackageUrl(skillName, options = {}) {
  const baseUrl = String(options.baseUrl || DEFAULT_SKILL_PACKAGE_BASE_URL).replace(/\/+$/, "");
  const version = String(options.version || "latest").replace(/^\/+|\/+$/g, "");
  return `${baseUrl}/${encodeURIComponent(skillName)}/${encodeURIComponent(version)}/${encodeURIComponent(skillName)}.zip`;
}

function getTimestamp() {
  const pad = (value) => String(value).padStart(2, "0");
  const now = new Date();
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    "-",
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join("");
}

function resolveSkillsRoot(options = {}) {
  if (options.targetRoot) {
    return path.resolve(String(options.targetRoot));
  }

  throw new Error("必须通过 --target <skills-dir> 指定 skill 安装目录；该目录应由当前 Agent 识别后传入。");
}

async function downloadFile(url, destPath) {
  const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`下载失败: HTTP ${response.status}${body ? ` ${body.slice(0, 300)}` : ""}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(destPath, buffer, { mode: 0o600 });
  return buffer;
}

function extractZip(zipPath, destDir) {
  ensureDir(destDir);
  const result = process.platform === "win32"
    ? spawnSync("powershell", [
      "-NoProfile",
      "-Command",
      "Expand-Archive",
      "-LiteralPath",
      zipPath,
      "-DestinationPath",
      destDir,
      "-Force",
    ], { encoding: "utf8" })
    : spawnSync("unzip", ["-q", zipPath, "-d", destDir], { encoding: "utf8" });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "解压 skill zip 失败");
  }
}

function findExtractedSkillDir(extractDir, skillName) {
  const directSkillMd = path.join(extractDir, "SKILL.md");
  if (fs.existsSync(directSkillMd)) {
    return extractDir;
  }

  const namedDir = path.join(extractDir, skillName);
  if (fs.existsSync(path.join(namedDir, "SKILL.md"))) {
    return namedDir;
  }

  const matches = [];
  const visit = (dir, depth) => {
    if (depth > 2) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const candidate = path.join(dir, entry.name);
      if (fs.existsSync(path.join(candidate, "SKILL.md"))) {
        matches.push(candidate);
      } else {
        visit(candidate, depth + 1);
      }
    }
  };
  visit(extractDir, 0);

  if (matches.length === 1) {
    return matches[0];
  }
  throw new Error("解压后的 skill zip 未在预期位置包含唯一的 SKILL.md");
}

function nextBackupPath(targetPath) {
  const parent = path.dirname(targetPath);
  const baseName = path.basename(targetPath);
  const timestamp = getTimestamp();
  let candidate = path.join(parent, `${baseName}.backup.${timestamp}`);
  let index = 1;
  while (fs.existsSync(candidate)) {
    candidate = path.join(parent, `${baseName}.backup.${timestamp}.${index}`);
    index += 1;
  }
  return candidate;
}

function hasSkillMd(skillDir) {
  return fs.existsSync(path.join(skillDir, "SKILL.md"));
}

function readSkillVersion(skillDir) {
  const skillMd = path.join(skillDir, "SKILL.md");
  try {
    const text = fs.readFileSync(skillMd, "utf8");
    const match = text.match(/^version:\s*["']?([^"'\n]+)["']?\s*$/m);
    return match ? match[1].trim() : "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function compareVersions(a, b) {
  const left = String(a || "0").split(/[.-]/).map((item) => Number.parseInt(item, 10));
  const right = String(b || "0").split(/[.-]/).map((item) => Number.parseInt(item, 10));
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const lv = Number.isFinite(left[index]) ? left[index] : 0;
    const rv = Number.isFinite(right[index]) ? right[index] : 0;
    if (lv > rv) return 1;
    if (lv < rv) return -1;
  }
  return 0;
}

async function installSkillPackage(skillNameInput, options = {}) {
  const skillName = normalizeSkillName(skillNameInput);
  const targetRoot = resolveSkillsRoot(options);
  const targetPath = path.join(targetRoot, skillName);

  ensureDir(targetRoot);

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), `investoday-skill-${skillName}-`));
  const zipPath = path.join(tempRoot, `${skillName}.zip`);
  const extractDir = path.join(tempRoot, "extract");
  const url = options.zipUrl || buildSkillPackageUrl(skillName, options);
  let backupPath = null;

  try {
    await downloadFile(url, zipPath);
    extractZip(zipPath, extractDir);
    const extractedSkillDir = findExtractedSkillDir(extractDir, skillName);
    if (!hasSkillMd(extractedSkillDir)) {
      throw new Error("待安装 skill 缺少 SKILL.md");
    }

    const existed = fs.existsSync(targetPath);
    const existingNormal = existed && hasSkillMd(targetPath);
    const localVersion = existingNormal ? readSkillVersion(targetPath) : "0.0.0";
    const remoteVersion = readSkillVersion(extractedSkillDir);

    if (existingNormal && !options.force && compareVersions(localVersion, remoteVersion) >= 0) {
      return {
        name: skillName,
        status: "already-installed",
        path: targetPath,
        skillMd: true,
        localVersion,
        remoteVersion,
        url,
      };
    }

    if (existed) {
      backupPath = nextBackupPath(targetPath);
      fs.renameSync(targetPath, backupPath);
    }

    try {
      fs.cpSync(extractedSkillDir, targetPath, { recursive: true });
    } catch (error) {
      fs.rmSync(targetPath, { recursive: true, force: true });
      if (backupPath && fs.existsSync(backupPath)) {
        fs.renameSync(backupPath, targetPath);
      }
      throw error;
    }

    return {
      name: skillName,
      status: existed ? "updated" : "installed",
      path: targetPath,
      backupPath,
      skillMd: hasSkillMd(targetPath),
      localVersion,
      remoteVersion,
      url,
    };
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

module.exports = {
  BASE_SKILL_NAME,
  DEFAULT_SKILL_PACKAGE_BASE_URL,
  buildSkillPackageUrl,
  compareVersions,
  installSkillPackage,
  normalizeSkillName,
  readSkillVersion,
  resolveSkillsRoot,
};
