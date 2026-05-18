#!/usr/bin/env node

const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");

const DEFAULT_REGISTRY = "https://clawhub.ai";
const DEFAULT_TIMEOUT_SECONDS = 120;
const TEXT_EXTENSIONS = new Set([
  "c",
  "cc",
  "cfg",
  "conf",
  "cpp",
  "cs",
  "css",
  "csv",
  "env",
  "go",
  "h",
  "hpp",
  "html",
  "ini",
  "java",
  "js",
  "json",
  "jsx",
  "kt",
  "lua",
  "m",
  "md",
  "mdx",
  "php",
  "pl",
  "py",
  "rb",
  "rs",
  "sh",
  "sql",
  "swift",
  "toml",
  "ts",
  "tsx",
  "txt",
  "xml",
  "yaml",
  "yml",
]);

function usage() {
  console.error(`Usage:
  node create/clawhub_publish_with_timeout.js <skill-dir> \\
    --slug <slug> --name <name> --version <version> \\
    --tags <comma-separated-tags> --changelog <text>

Environment:
  CLAWHUB_TOKEN                     Token override
  CLAWHUB_REGISTRY                  Registry override
  CLAWHUB_PUBLISH_TIMEOUT_SECONDS   Request timeout, default ${DEFAULT_TIMEOUT_SECONDS}`);
}

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === "--help" || value === "-h") {
      args.help = true;
      continue;
    }
    if (!value.startsWith("--")) {
      args._.push(value);
      continue;
    }

    const key = value.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      fail(`--${key} requires a value`);
    }
    args[key] = next;
    i += 1;
  }
  return args;
}

function isSemver(version) {
  return /^\d+\.\d+\.\d+$/.test(version);
}

function configCandidates() {
  const candidates = [];
  if (process.env.CLAWHUB_CONFIG_PATH) {
    candidates.push(process.env.CLAWHUB_CONFIG_PATH);
  }
  if (process.env.CLAWDHUB_CONFIG_PATH) {
    candidates.push(process.env.CLAWDHUB_CONFIG_PATH);
  }

  const home = os.homedir();
  candidates.push(
    path.join(home, "Library", "Application Support", "clawhub", "config.json"),
    path.join(home, "Library", "Application Support", "clawdhub", "config.json"),
    path.join(home, ".config", "clawhub", "config.json"),
    path.join(home, ".config", "clawdhub", "config.json"),
  );
  return [...new Set(candidates)];
}

async function readFirstJson(paths) {
  for (const file of paths) {
    try {
      return JSON.parse(await fs.readFile(file, "utf8"));
    } catch {
      // Try the next config location.
    }
  }
  return null;
}

async function resolveAuth() {
  const cfg = await readFirstJson(configCandidates());
  const token = process.env.CLAWHUB_TOKEN || process.env.CLAWDHUB_TOKEN || cfg?.token;
  const registry =
    process.env.CLAWHUB_REGISTRY ||
    process.env.CLAWDHUB_REGISTRY ||
    cfg?.registry ||
    DEFAULT_REGISTRY;

  if (!token) {
    fail("ClawHub token missing. Run `clawhub login` or export CLAWHUB_TOKEN.");
  }

  return { token, registry: registry.replace(/\/+$/, "") };
}

function normalizePath(filePath) {
  return filePath.split(path.sep).join("/");
}

async function walkTextFiles(root, dir = root, files = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") {
      continue;
    }

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkTextFiles(root, fullPath, files);
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }

    const relPath = normalizePath(path.relative(root, fullPath));
    const ext = relPath.split(".").pop()?.toLowerCase() || "";
    if (!TEXT_EXTENSIONS.has(ext)) {
      continue;
    }

    const bytes = await fs.readFile(fullPath);
    files.push({ relPath, bytes });
  }
  return files;
}

function buildTimeoutMs() {
  const raw = process.env.CLAWHUB_PUBLISH_TIMEOUT_SECONDS || String(DEFAULT_TIMEOUT_SECONDS);
  const seconds = Number(raw);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    fail(`Invalid CLAWHUB_PUBLISH_TIMEOUT_SECONDS: ${raw}`);
  }
  return Math.ceil(seconds * 1000);
}

async function postWithTimeout(url, init, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(new Error(`Request timed out after ${Math.ceil(timeoutMs / 1000)}s`)),
    timeoutMs,
  );
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const skillDirArg = args._[0];
  if (!skillDirArg || args.help || args.h) {
    usage();
    process.exit(args.help || args.h ? 0 : 1);
  }

  const slug = args.slug;
  const displayName = args.name;
  const version = args.version;
  const changelog = args.changelog || "";
  const tags = (args.tags || "latest")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  if (!slug) fail("--slug required");
  if (!displayName) fail("--name required");
  if (!version || !isSemver(version)) fail("--version must be valid semver");

  const skillDir = path.resolve(skillDirArg);
  const stat = await fs.stat(skillDir).catch(() => null);
  if (!stat?.isDirectory()) {
    fail(`Skill path must be a directory: ${skillDir}`);
  }

  const files = await walkTextFiles(skillDir);
  if (!files.some((file) => file.relPath.toLowerCase() === "skill.md")) {
    fail("SKILL.md required");
  }

  const { token, registry } = await resolveAuth();
  const timeoutMs = buildTimeoutMs();

  const form = new FormData();
  form.set(
    "payload",
    JSON.stringify({
      slug,
      displayName,
      version,
      changelog,
      tags,
      acceptLicenseTerms: true,
    }),
  );

  for (const file of files) {
    form.append("files", new Blob([file.bytes], { type: "text/plain" }), file.relPath);
  }

  const url = `${registry}/api/v1/skills`;
  console.log(
    `Publishing ${slug}@${version} to ${registry} with ${files.length} files, timeout=${Math.ceil(timeoutMs / 1000)}s`,
  );

  const response = await postWithTimeout(
    url,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: form,
    },
    timeoutMs,
  );

  const text = await response.text();
  if (!response.ok) {
    fail(text || `HTTP ${response.status}`);
  }

  const result = text ? JSON.parse(text) : {};
  const versionId = result.versionId || result.id || "<unknown>";
  console.log(`OK. Published ${slug}@${version} (${versionId})`);
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
