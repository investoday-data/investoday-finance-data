const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const CONFIG_DIR_ENV = "INVESTODAY_API_CONFIG_DIR";
const API_KEY_ENV = "INVESTODAY_API_KEY";
const CREDENTIALS_FILE = "credentials.enc";
const KEY_FILE = ".encryption_key";
const CIPHER_ALGORITHM = "aes-256-gcm";

function getConfigDir(env = process.env) {
  if (env[CONFIG_DIR_ENV]) {
    return path.resolve(env[CONFIG_DIR_ENV]);
  }

  return path.join(os.homedir(), ".config", "investoday");
}

function getCredentialsPath(env = process.env) {
  return path.join(getConfigDir(env), CREDENTIALS_FILE);
}

function getEncryptionKeyPath(env = process.env) {
  return path.join(getConfigDir(env), KEY_FILE);
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

function loadOrCreateEncryptionKey(env = process.env) {
  ensureConfigDir(env);
  const keyPath = getEncryptionKeyPath(env);
  if (fs.existsSync(keyPath)) {
    const encoded = fs.readFileSync(keyPath, "utf8").trim();
    const key = Buffer.from(encoded, "base64");
    if (key.length !== 32) {
      throw new Error(`Invalid encryption key at ${keyPath}`);
    }
    return key;
  }

  const key = crypto.randomBytes(32);
  atomicWriteFile(keyPath, key.toString("base64"));
  return key;
}

function loadEncryptionKey(env = process.env) {
  const keyPath = getEncryptionKeyPath(env);
  if (!fs.existsSync(keyPath)) {
    return null;
  }

  const encoded = fs.readFileSync(keyPath, "utf8").trim();
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) {
    return null;
  }
  return key;
}

function encryptJson(value, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(CIPHER_ALGORITHM, key, iv);
  const plaintext = Buffer.from(JSON.stringify(value), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    version: 1,
    algorithm: CIPHER_ALGORITHM,
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: encrypted.toString("base64"),
  };
}

function decryptJson(payload, key) {
  if (!payload || payload.algorithm !== CIPHER_ALGORITHM) {
    throw new Error("Unsupported credentials format");
  }

  const decipher = crypto.createDecipheriv(
    CIPHER_ALGORITHM,
    key,
    Buffer.from(payload.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.data, "base64")),
    decipher.final(),
  ]);
  return JSON.parse(decrypted.toString("utf8"));
}

function saveCredentials(apiKey, env = process.env) {
  const trimmedKey = String(apiKey || "").trim();
  if (!trimmedKey) {
    throw new Error("API key cannot be empty");
  }

  const key = loadOrCreateEncryptionKey(env);
  const payload = encryptJson({
    apiKey: trimmedKey,
    createdAt: new Date().toISOString(),
  }, key);
  atomicWriteFile(getCredentialsPath(env), `${JSON.stringify(payload, null, 2)}\n`);
}

function readCredentials(env = process.env) {
  const credentialsPath = getCredentialsPath(env);
  const key = loadEncryptionKey(env);
  if (!key || !fs.existsSync(credentialsPath)) {
    return null;
  }

  try {
    const payload = JSON.parse(fs.readFileSync(credentialsPath, "utf8"));
    return decryptJson(payload, key);
  } catch {
    return null;
  }
}

function removeCredentials(env = process.env) {
  for (const filePath of [getCredentialsPath(env), getEncryptionKeyPath(env)]) {
    if (fs.existsSync(filePath)) {
      fs.rmSync(filePath, { force: true });
    }
  }
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
  CONFIG_DIR_ENV,
  CREDENTIALS_FILE,
  KEY_FILE,
  getConfigDir,
  getCredentialsPath,
  getEncryptionKeyPath,
  readCredentials,
  removeCredentials,
  resolveApiKey,
  saveCredentials,
};
