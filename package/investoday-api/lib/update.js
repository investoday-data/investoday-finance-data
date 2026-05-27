const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { version: PACKAGE_VERSION } = require("../package.json");
const {
  API_KEY_ENV,
  readConfig,
  saveConfig,
} = require("./config");
const {
  getCacheDir,
  getExecutionPath,
  getNextRunAt,
  getTaskStatus,
  registerTask,
  unregisterTask,
} = require("./scheduler");

const DEFAULT_MANIFEST_URL = "https://storage.txyun.investoday.net/application/skill-store/configs/investoday-api.manifest.json";
const UPDATE_MANIFEST_URL_ENV = "INVESTODAY_API_UPDATE_MANIFEST_URL";
const DEFAULT_LOCAL_TASK_CRON = "0 3 * * *";
const LOCK_FILE = "update.lock";
const STATE_FILE = "state.json";
const NODE_PACKAGE_NAME = "@investoday/investoday-api";

function nowIso() {
  return new Date().toISOString();
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  return dir;
}

function getManifestUrl(env = process.env) {
  return String(env[UPDATE_MANIFEST_URL_ENV] || DEFAULT_MANIFEST_URL).trim();
}

function getStatePath() {
  return path.join(getCacheDir(), STATE_FILE);
}

function getCachedManifestPath() {
  return path.join(getCacheDir(), "manifest.json");
}

function getAutoUpdateConfig(env = process.env) {
  const config = readConfig(env) || {};
  return config.autoUpdate || {};
}

function mergeAutoUpdate(patch, env = process.env) {
  const config = readConfig(env) || {};
  const next = {
    ...config,
    autoUpdate: {
      ...(config.autoUpdate || {}),
      ...patch,
    },
  };
  saveConfig(next, env);
  return next.autoUpdate;
}

function setLastError(message, env = process.env) {
  mergeAutoUpdate({ lastError: message || null }, env);
}

function syncCronFromManifest(manifest, env = process.env) {
  const cron = manifest && manifest.updatePolicy && manifest.updatePolicy.local_task_cron
    ? String(manifest.updatePolicy.local_task_cron).trim()
    : DEFAULT_LOCAL_TASK_CRON;
  mergeAutoUpdate({ local_task_cron: cron }, env);
  return cron;
}

function sanitizeMessage(message) {
  const config = readConfig() || {};
  let text = String(message || "").replace(/\s+/g, " ").trim();
  const apiKey = String(config[API_KEY_ENV] || "").trim();
  if (apiKey) {
    text = text.replaceAll(apiKey, "***");
  }
  return text.slice(0, 500);
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

async function fetchJson(url) {
  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  } catch (error) {
    throw new Error(`manifest request failed: ${sanitizeMessage(error.message || error)}`);
  }
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`manifest request failed: HTTP ${response.status}${body ? ` ${body.slice(0, 300)}` : ""}`);
  }
  try {
    return await response.json();
  } catch (error) {
    throw new Error(`manifest is not valid JSON: ${sanitizeMessage(error.message || error)}`);
  }
}

function validateManifest(manifest) {
  if (!manifest || typeof manifest !== "object") {
    throw new Error("manifest must be an object");
  }
  if (!manifest.schemaVersion) {
    throw new Error("manifest.schemaVersion is required");
  }
  if (!manifest.updatePolicy || manifest.updatePolicy.skillInstallPolicy !== "existing-only") {
    throw new Error("manifest.updatePolicy.skillInstallPolicy must be existing-only");
  }
  if (!manifest.nodePackage || manifest.nodePackage.name !== NODE_PACKAGE_NAME || !manifest.nodePackage.version) {
    throw new Error("manifest.nodePackage is invalid");
  }
  if (!Array.isArray(manifest.skills)) {
    throw new Error("manifest.skills must be an array");
  }
  for (const skill of manifest.skills) {
    if (!skill.name || !skill.version || !skill.zipUrl || !skill.sha256) {
      throw new Error("manifest.skills entries require name, version, zipUrl, and sha256");
    }
  }
  if (!Array.isArray(manifest.clients)) {
    throw new Error("manifest.clients must be an array");
  }
  return manifest;
}

async function fetchManifest(env = process.env) {
  const manifest = validateManifest(await fetchJson(getManifestUrl(env)));
  ensureDir(getCacheDir());
  fs.writeFileSync(getCachedManifestPath(), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  return manifest;
}

function readCachedManifest() {
  const filePath = getCachedManifestPath();
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    return validateManifest(JSON.parse(fs.readFileSync(filePath, "utf8")));
  } catch {
    return null;
  }
}

function acquireLock() {
  ensureDir(getCacheDir());
  const lockPath = path.join(getCacheDir(), LOCK_FILE);
  try {
    const fd = fs.openSync(lockPath, "wx", 0o600);
    fs.writeFileSync(fd, `${process.pid}\n${nowIso()}\n`);
    fs.closeSync(fd);
    return () => fs.rmSync(lockPath, { force: true });
  } catch {
    throw new Error("another update run is already in progress");
  }
}

function writeState(state) {
  ensureDir(getCacheDir());
  fs.writeFileSync(getStatePath(), `${JSON.stringify(state || {}, null, 2)}\n`, { mode: 0o600 });
}

function readState() {
  const filePath = getStatePath();
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function getGlobalNodePackageVersion(packageName = NODE_PACKAGE_NAME) {
  const rootResult = spawnSync("npm", ["root", "-g"], { encoding: "utf8" });
  if (rootResult.status === 0) {
    const packagePath = path.join(rootResult.stdout.trim(), ...packageName.split("/"), "package.json");
    try {
      return JSON.parse(fs.readFileSync(packagePath, "utf8")).version || PACKAGE_VERSION;
    } catch {
      return PACKAGE_VERSION;
    }
  }
  return PACKAGE_VERSION;
}

function updateNodePackage(manifest) {
  const remoteVersion = manifest.nodePackage.version;
  const localVersion = getGlobalNodePackageVersion(manifest.nodePackage.name);
  if (compareVersions(localVersion, remoteVersion) >= 0) {
    return { name: manifest.nodePackage.name, localVersion, remoteVersion, status: "skipped" };
  }

  const result = spawnSync("npm", ["install", "-g", `${manifest.nodePackage.name}@latest`], {
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: getExecutionPath(),
    },
  });
  if (result.status !== 0) {
    return {
      name: manifest.nodePackage.name,
      localVersion,
      remoteVersion,
      status: "failed",
      error: sanitizeMessage(result.stderr || result.stdout || "npm install failed"),
    };
  }

  const installedVersion = getGlobalNodePackageVersion(manifest.nodePackage.name);
  if (compareVersions(installedVersion, remoteVersion) < 0) {
    return {
      name: manifest.nodePackage.name,
      localVersion,
      remoteVersion,
      installedVersion,
      status: "failed",
      error: `installed version ${installedVersion} is lower than manifest version ${remoteVersion}`,
    };
  }

  return { name: manifest.nodePackage.name, localVersion, remoteVersion, installedVersion, status: "updated" };
}

function expandHome(value) {
  return String(value || "").replace(/^\$HOME(?=$|[\\/])/, os.homedir());
}

function globToRegex(segment) {
  return new RegExp(`^${String(segment).replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`);
}

function expandDiscoveryPath(pattern) {
  const normalized = path.normalize(expandHome(pattern));
  const parsed = path.parse(normalized);
  const segments = normalized.slice(parsed.root.length).split(path.sep).filter(Boolean);
  let candidates = [parsed.root || path.sep];
  for (const segment of segments) {
    const next = [];
    if (segment.includes("*")) {
      const regex = globToRegex(segment);
      for (const base of candidates) {
        if (!fs.existsSync(base)) continue;
        for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
          if (entry.isDirectory() && regex.test(entry.name)) {
            next.push(path.join(base, entry.name));
          }
        }
      }
    } else {
      for (const base of candidates) {
        next.push(path.join(base, segment));
      }
    }
    candidates = next;
  }
  return candidates;
}

function discoverSkillTargets(manifest) {
  const targets = [];
  for (const client of manifest.clients || []) {
    for (const target of client.targets || []) {
      if (!Array.isArray(target.paths)) continue;
      if (target.type !== "fixed" && target.type !== "discovery") continue;
      const roots = target.paths.flatMap((item) => target.type === "discovery" ? expandDiscoveryPath(item) : [path.normalize(expandHome(item))]);
      for (const root of roots) {
        if (!fs.existsSync(root)) continue;
        for (const skill of manifest.skills) {
          const displayPath = path.join(root, skill.name);
          const skillMd = path.join(displayPath, "SKILL.md");
          if (!fs.existsSync(skillMd)) continue;
          const isSymlink = fs.lstatSync(displayPath).isSymbolicLink();
          const actualPath = fs.realpathSync(displayPath);
          targets.push({ clientId: client.id, skillName: skill.name, displayPath, actualPath, isSymlink, remote: skill });
        }
      }
    }
  }
  return targets;
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

async function downloadFile(url, destPath) {
  const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`download failed: HTTP ${response.status}${body ? ` ${body.slice(0, 300)}` : ""}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(destPath, buffer, { mode: 0o600 });
  return buffer;
}

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function extractZip(zipPath, destDir) {
  ensureDir(destDir);
  let result;
  if (process.platform === "win32") {
    result = spawnSync("powershell", ["-NoProfile", "-Command", "Expand-Archive", "-LiteralPath", zipPath, "-DestinationPath", destDir, "-Force"], { encoding: "utf8" });
  } else {
    result = spawnSync("unzip", ["-q", zipPath, "-d", destDir], { encoding: "utf8" });
  }
  if (result.status !== 0) {
    throw new Error(sanitizeMessage(result.stderr || result.stdout || "failed to extract skill zip"));
  }
}

function findExtractedSkillDir(extractDir) {
  if (fs.existsSync(path.join(extractDir, "SKILL.md"))) {
    return extractDir;
  }
  const entries = fs.readdirSync(extractDir, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  if (entries.length === 1) {
    const candidate = path.join(extractDir, entries[0].name);
    if (fs.existsSync(path.join(candidate, "SKILL.md"))) {
      return candidate;
    }
  }
  throw new Error("extracted skill zip does not contain SKILL.md at the expected location");
}

async function updateSkillTarget(target) {
  const localVersion = readSkillVersion(target.actualPath);
  const remoteVersion = target.remote.version;
  if (compareVersions(localVersion, remoteVersion) >= 0) {
    return { ...target, localVersion, remoteVersion, status: "skipped" };
  }

  const parent = path.dirname(target.actualPath);
  const baseName = path.basename(target.actualPath);
  const tempRoot = path.join(parent, `.investoday-update-${process.pid}-${Date.now()}`);
  const extractDir = path.join(tempRoot, "extract");
  const zipPath = path.join(tempRoot, `${target.skillName}.zip`);
  const backupPath = path.join(parent, `${baseName}.backup-${Date.now()}`);

  try {
    ensureDir(tempRoot);
    await downloadFile(target.remote.zipUrl, zipPath);
    const actualHash = sha256File(zipPath);
    if (actualHash.toLowerCase() !== String(target.remote.sha256).toLowerCase()) {
      throw new Error(`sha256 mismatch for ${target.skillName}: expected ${target.remote.sha256}, got ${actualHash}`);
    }
    extractZip(zipPath, extractDir);
    const extractedSkillDir = findExtractedSkillDir(extractDir);

    fs.renameSync(target.actualPath, backupPath);
    try {
      fs.renameSync(extractedSkillDir, target.actualPath);
      fs.rmSync(backupPath, { recursive: true, force: true });
    } catch (error) {
      if (fs.existsSync(target.actualPath)) {
        fs.rmSync(target.actualPath, { recursive: true, force: true });
      }
      fs.renameSync(backupPath, target.actualPath);
      throw error;
    }

    return { ...target, localVersion, remoteVersion, status: "updated" };
  } catch (error) {
    return { ...target, localVersion, remoteVersion, status: "failed", error: sanitizeMessage(error.message || error) };
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

async function updateSkills(manifest) {
  const results = [];
  for (const target of discoverSkillTargets(manifest)) {
    results.push(await updateSkillTarget(target));
  }
  return results;
}

async function runUpdate(env = process.env) {
  const autoUpdate = getAutoUpdateConfig(env);
  if (autoUpdate.enabled !== true) {
    return { ok: true, skipped: true, reason: "auto update disabled" };
  }

  const releaseLock = acquireLock();
  const lastRunAt = nowIso();
  mergeAutoUpdate({ lastRunAt, lastError: null }, env);
  try {
    const manifest = await fetchManifest(env);
    const cron = syncCronFromManifest(manifest, env);
    let schedulerRepair = null;
    try {
      const taskStatus = getTaskStatus(cron);
      schedulerRepair = { status: "skipped", registrationStatus: taskStatus.registrationStatus };
      if (taskStatus.registrationStatus === "配置漂移") {
        registerTask(cron);
        schedulerRepair = { status: "updated", registrationStatus: "已注册" };
      }
    } catch (error) {
      schedulerRepair = { status: "failed", error: sanitizeMessage(error.message || error) };
    }

    const nodePackage = updateNodePackage(manifest);
    const skills = await updateSkills(manifest);
    const failed = [nodePackage, ...skills].filter((item) => item.status === "failed");
    const warnings = schedulerRepair && schedulerRepair.status === "failed" ? [schedulerRepair.error] : [];
    const lastError = [...failed.map((item) => item.error).filter(Boolean), ...warnings].join("; ") || null;
    const state = {
      lastRunAt,
      lastSuccessAt: failed.length ? autoUpdate.lastSuccessAt || null : nowIso(),
      lastError,
      remote: {
        manifestGeneratedAt: manifest.generatedAt || null,
        nodePackageVersion: manifest.nodePackage.version,
        skills: manifest.skills.map((skill) => ({ name: skill.name, version: skill.version })),
      },
      local: {
        nodePackageVersion: getGlobalNodePackageVersion(manifest.nodePackage.name),
        skills: discoverSkillTargets(manifest).map((target) => ({
          name: target.skillName,
          version: readSkillVersion(target.actualPath),
          path: target.displayPath,
        })),
      },
      nodePackage,
      skills,
      schedulerRepair,
    };
    writeState(state);
    mergeAutoUpdate({ lastSuccessAt: failed.length ? autoUpdate.lastSuccessAt || null : state.lastSuccessAt, lastError: state.lastError }, env);
    return { ok: failed.length === 0, warnings, state };
  } catch (error) {
    const message = sanitizeMessage(error.message || error);
    mergeAutoUpdate({ lastError: message }, env);
    writeState({ lastRunAt, lastSuccessAt: autoUpdate.lastSuccessAt || null, lastError: message });
    return { ok: false, error: message };
  } finally {
    releaseLock();
  }
}

async function enableUpdate(env = process.env) {
  let cron = getAutoUpdateConfig(env).local_task_cron || DEFAULT_LOCAL_TASK_CRON;
  try {
    const manifest = await fetchManifest(env);
    cron = syncCronFromManifest(manifest, env);
  } catch {
    mergeAutoUpdate({ local_task_cron: cron }, env);
  }
  mergeAutoUpdate({ enabled: true, local_task_cron: cron }, env);
  registerTask(cron);
  return { ok: true, cron };
}

function disableUpdate(env = process.env) {
  mergeAutoUpdate({ enabled: false }, env);
  unregisterTask();
  return { ok: true };
}

function unregisterUpdate() {
  const result = unregisterTask();
  return { ok: true, result };
}

async function registerUpdate(env = process.env) {
  let cron = getAutoUpdateConfig(env).local_task_cron;
  if (!cron) {
    try {
      const manifest = await fetchManifest(env);
      cron = syncCronFromManifest(manifest, env);
    } catch {
      cron = DEFAULT_LOCAL_TASK_CRON;
      mergeAutoUpdate({ local_task_cron: cron }, env);
    }
  }
  const result = registerTask(cron);
  return { ok: true, cron, result };
}

async function getStatus(env = process.env) {
  const autoUpdate = getAutoUpdateConfig(env);
  let remoteAvailable = true;
  let manifest = null;
  let remoteError = null;
  try {
    manifest = await fetchManifest(env);
    syncCronFromManifest(manifest, env);
  } catch (error) {
    remoteAvailable = false;
    remoteError = sanitizeMessage(error.message || error);
    manifest = readCachedManifest();
  }
  const cron = getAutoUpdateConfig(env).local_task_cron || DEFAULT_LOCAL_TASK_CRON;
  const taskStatus = getTaskStatus(cron);
  const state = readState() || {};
  const skills = manifest ? discoverSkillTargets(manifest).map((target) => ({
    name: target.skillName,
    path: target.displayPath,
    localVersion: readSkillVersion(target.actualPath),
    remoteVersion: remoteAvailable ? target.remote.version : null,
  })) : [];
  return {
    enabled: autoUpdate.enabled === true,
    registrationStatus: taskStatus.registrationStatus,
    registrationError: taskStatus.error || null,
    lastRunAt: autoUpdate.lastRunAt || state.lastRunAt || null,
    lastSuccessAt: autoUpdate.lastSuccessAt || state.lastSuccessAt || null,
    lastError: autoUpdate.lastError || state.lastError || null,
    nextRunAt: autoUpdate.enabled === true ? getNextRunAt(cron).toLocaleString() : null,
    cron,
    remoteAvailable,
    remoteError,
    nodePackage: {
      name: NODE_PACKAGE_NAME,
      localVersion: getGlobalNodePackageVersion(NODE_PACKAGE_NAME),
      remoteVersion: remoteAvailable && manifest ? manifest.nodePackage.version : null,
    },
    skills,
  };
}

function printStatus(status, stdout = process.stdout) {
  const lines = [];
  lines.push(`定时任务状态: ${status.enabled ? "开启" : "关闭"}`);
  lines.push(`定时任务注册状态: ${status.registrationStatus}${status.registrationError ? ` (${status.registrationError})` : ""}`);
  lines.push(`最新一次更新时间: ${status.lastRunAt || "无"}`);
  lines.push(`最新一次更新成功时间: ${status.lastSuccessAt || "无"}`);
  lines.push(`最新一次更新错误信息: ${status.lastError || "无"}`);
  lines.push(`下一次更新时间: ${status.nextRunAt || "无"}`);
  lines.push(`远程配置状态: ${status.remoteAvailable ? "可用" : `不可用${status.remoteError ? ` (${status.remoteError})` : ""}`}`);
  lines.push("");
  lines.push("版本:");
  lines.push(`- ${status.nodePackage.name} 本地: ${status.nodePackage.localVersion || "未知"} 远程: ${status.nodePackage.remoteVersion || "不可用"}`);
  for (const skill of status.skills) {
    lines.push(`- ${skill.name} 本地: ${skill.localVersion || "未知"} 远程: ${skill.remoteVersion || "不可用"} 路径: ${skill.path}`);
  }
  stdout.write(`${lines.join("\n")}\n`);
}

async function runUpdateCommand(args, streams = {}) {
  const stdout = streams.stdout || process.stdout;
  const stderr = streams.stderr || process.stderr;
  const action = args[0] || "status";
  if (["--help", "-h", "help"].includes(action)) {
    stdout.write("Usage:\n  investoday-api update run\n  investoday-api update status\n  investoday-api update enable\n  investoday-api update disable\n  investoday-api update register\n  investoday-api update unregister\n");
    return { ok: true };
  }
  if (action === "run") {
    const result = await runUpdate();
    if (result.skipped) stdout.write(`Update skipped: ${result.reason}\n`);
    else if (result.ok) {
      stdout.write(result.warnings && result.warnings.length
        ? `Update completed with warnings: ${result.warnings.join("; ")}\n`
        : "Update completed successfully.\n");
    }
    else stderr.write(`Update failed: ${result.error || "see status for details"}\n`);
    return result;
  }
  if (action === "enable") {
    const result = await enableUpdate();
    stdout.write(`Auto update enabled. cron=${result.cron}\n`);
    return result;
  }
  if (action === "disable") {
    const result = disableUpdate();
    stdout.write("Auto update disabled.\n");
    return result;
  }
  if (action === "unregister") {
    try {
      const result = unregisterUpdate();
      stdout.write("Auto update task unregistered.\n");
      return result;
    } catch (error) {
      const message = sanitizeMessage(error.message || error);
      setLastError(message);
      stderr.write(`Unregister failed: ${message}\n`);
      return { ok: false, error: message };
    }
  }
  if (action === "register") {
    try {
      const result = await registerUpdate();
      stdout.write(`Auto update task registered. cron=${result.cron}\n`);
      return result;
    } catch (error) {
      const message = sanitizeMessage(error.message || error);
      setLastError(message);
      stderr.write(`Register failed: ${message}\n`);
      return { ok: false, error: message };
    }
  }
  if (action === "status") {
    const status = await getStatus();
    printStatus(status, stdout);
    return { ok: true, status };
  }
  throw new Error(`Unknown update action '${action}'. Use run, status, enable, disable, register, or unregister.`);
}

module.exports = {
  DEFAULT_LOCAL_TASK_CRON,
  DEFAULT_MANIFEST_URL,
  NODE_PACKAGE_NAME,
  UPDATE_MANIFEST_URL_ENV,
  compareVersions,
  discoverSkillTargets,
  fetchManifest,
  getAutoUpdateConfig,
  getManifestUrl,
  getStatus,
  readCachedManifest,
  runUpdate,
  runUpdateCommand,
  syncCronFromManifest,
  unregisterUpdate,
  updateNodePackage,
};
