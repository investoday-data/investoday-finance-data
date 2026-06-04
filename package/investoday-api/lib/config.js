const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const CONFIG_DIR_ENV = "INVESTODAY_API_CONFIG_DIR";
const API_KEY_ENV = "INVESTODAY_API_KEY";
const LEGACY_SUB_API_KEY_ENV = "SUB_INVESTODAY_API_KEY";
const CONFIG_FILE = "investoday-api.config.json";
const LEGACY_CREDENTIALS_FILE = "credentials.enc";
const LEGACY_KEY_FILE = ".encryption_key";

function getConfigDir(env = process.env) {
  if (env[CONFIG_DIR_ENV]) {
    return path.resolve(env[CONFIG_DIR_ENV]);
  }

  return path.join(os.homedir(), ".config", "investoday");
}

function getCredentialsPath(env = process.env) {
  return path.join(getConfigDir(env), CONFIG_FILE);
}

function getLegacyCredentialsPath(env = process.env) {
  return path.join(getConfigDir(env), LEGACY_CREDENTIALS_FILE);
}

function getLegacyKeyPath(env = process.env) {
  return path.join(getConfigDir(env), LEGACY_KEY_FILE);
}

function ensureConfigDir(env = process.env) {
  const dir = getConfigDir(env);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  if (process.platform !== "win32") {
    fs.chmodSync(dir, 0o700);
  }
  return dir;
}

function atomicWriteFile(filePath, contents, mode = 0o600) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tempPath, contents, { mode });
  if (process.platform !== "win32") {
    fs.chmodSync(tempPath, mode);
  }
  fs.renameSync(tempPath, filePath);
}

function saveConfig(config, env = process.env) {
  atomicWriteFile(getCredentialsPath(env), `${JSON.stringify(config || {}, null, 2)}\n`);
}

function removeLegacyCredentials(env = process.env) {
  for (const filePath of [getLegacyCredentialsPath(env), getLegacyKeyPath(env)]) {
    if (fs.existsSync(filePath)) {
      fs.rmSync(filePath, { force: true });
    }
  }
}

function saveCredentials(apiKey, env = process.env) {
  const trimmedKey = String(apiKey || "").trim();
  if (!trimmedKey) {
    throw new Error("API key cannot be empty");
  }

  const existing = readConfig(env);
  const payload = {
    ...(existing || {}),
    [API_KEY_ENV]: trimmedKey,
  };
  delete payload[LEGACY_SUB_API_KEY_ENV];
  saveConfig(payload, env);
  removeLegacyCredentials(env);
}

function readConfig(env = process.env) {
  const configPath = getCredentialsPath(env);
  if (!fs.existsSync(configPath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch {
    return null;
  }
}

function readCredentials(env = process.env) {
  const config = readConfig(env);
  if (!config) {
    return null;
  }

  const apiKey = String(config[API_KEY_ENV] || "").trim();
  if (!apiKey) {
    return null;
  }

  return { apiKey };
}

function removeCredentials(env = process.env) {
  const configPath = getCredentialsPath(env);
  if (fs.existsSync(configPath)) {
    fs.rmSync(configPath, { force: true });
  }
  removeLegacyCredentials(env);
}

function resolveApiKey(env = process.env) {
  const envKey = String(env[API_KEY_ENV] || "").trim();
  if (envKey) {
    return { apiKey: envKey, source: "compat" };
  }

  const credentials = readCredentials(env);
  if (credentials && credentials.apiKey) {
    return { apiKey: String(credentials.apiKey).trim(), source: "config" };
  }

  return { apiKey: "", source: "missing" };
}

module.exports = {
  API_KEY_ENV,
  CONFIG_FILE,
  CONFIG_DIR_ENV,
  CREDENTIALS_FILE: CONFIG_FILE,
  LEGACY_CREDENTIALS_FILE,
  LEGACY_KEY_FILE,
  getConfigDir,
  getCredentialsPath,
  getLegacyCredentialsPath,
  getLegacyKeyPath,
  removeLegacyCredentials,
  readConfig,
  readCredentials,
  removeCredentials,
  resolveApiKey,
  saveConfig,
  saveCredentials,
};
