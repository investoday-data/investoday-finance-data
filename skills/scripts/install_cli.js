#!/usr/bin/env node

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const COMMAND_NAME = "investoday-api";
const PATH_MARKER = "# Added by investoday-api installer";

function getDefaultBinDir({ platform = process.platform, homeDir = os.homedir() } = {}) {
  if (platform === "win32") {
    return `${homeDir}\\.local\\bin`;
  }
  return path.join(homeDir, ".local", "bin");
}

function buildUnixLauncher(callApiPath) {
  return `#!/usr/bin/env sh
# ${COMMAND_NAME} launcher
exec node "${callApiPath}" "$@"
`;
}

function buildWindowsLauncher(callApiPath) {
  const normalizedPath = callApiPath.replace(/\//g, "\\");
  return `@echo off\r
REM ${COMMAND_NAME} launcher\r
node "${normalizedPath}" %*\r
`;
}

function getUnixProfileCandidates({ shellPath = process.env.SHELL || "", homeDir = os.homedir() } = {}) {
  const candidates = [];
  if (shellPath.includes("zsh")) {
    candidates.push(".zshrc");
  }
  if (shellPath.includes("bash")) {
    candidates.push(".bashrc", ".bash_profile");
  }
  candidates.push(".profile");
  return [...new Set(candidates)].map((name) => path.join(homeDir, name));
}

function ensureUnixPath(binDir, { shellPath = process.env.SHELL || "", homeDir = os.homedir() } = {}) {
  const exportLine = `export PATH="${binDir}:$PATH"`;
  const snippet = `\n${PATH_MARKER}\n${exportLine}\n`;
  const candidates = getUnixProfileCandidates({ shellPath, homeDir });
  const target = candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0];
  const current = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : "";

  if (current.includes(exportLine) || current.includes(PATH_MARKER)) {
    return { updated: false, target };
  }

  const prefix = current && !current.endsWith("\n") ? "\n" : "";
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${current}${prefix}${snippet}`, "utf8");
  return { updated: true, target };
}

function ensureWindowsPath(binDir) {
  const currentUserPath = process.env.PATH || "";
  const entries = currentUserPath.split(";").map((entry) => entry.trim().toLowerCase());
  if (entries.includes(binDir.toLowerCase())) {
    return { updated: false, target: "User PATH" };
  }

  const script = `
$binDir = ${JSON.stringify(binDir)}
$current = [Environment]::GetEnvironmentVariable("Path", "User")
$parts = @()
if ($current) {
  $parts = $current.Split(";") | Where-Object { $_ -and $_.Trim() -ne "" }
}
if (-not ($parts | Where-Object { $_.Trim().ToLower() -eq $binDir.ToLower() })) {
  $newPath = if ($current -and $current.Trim() -ne "") { "$current;$binDir" } else { $binDir }
  [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
}
`;

  const result = spawnSync("powershell", ["-NoProfile", "-Command", script], {
    encoding: "utf8",
  });

  if (result.status !== 0) {
    const stderr = (result.stderr || result.stdout || "").trim();
    throw new Error(stderr || "Failed to update Windows user PATH");
  }

  return { updated: true, target: "User PATH" };
}

function installCli({ platform = process.platform, homeDir = os.homedir(), binDir } = {}) {
  const resolvedBinDir = path.resolve(binDir || getDefaultBinDir({ platform, homeDir }));
  const callApiPath = path.resolve(__dirname, "call_api.js");
  const launcherPath = path.join(
    resolvedBinDir,
    platform === "win32" ? `${COMMAND_NAME}.cmd` : COMMAND_NAME
  );

  fs.mkdirSync(resolvedBinDir, { recursive: true });
  const launcher = platform === "win32"
    ? buildWindowsLauncher(callApiPath)
    : buildUnixLauncher(callApiPath);
  fs.writeFileSync(launcherPath, launcher, "utf8");
  if (platform !== "win32") {
    fs.chmodSync(launcherPath, 0o755);
  }

  const pathResult = platform === "win32"
    ? ensureWindowsPath(resolvedBinDir)
    : ensureUnixPath(resolvedBinDir, { homeDir });

  return {
    launcherPath,
    binDir: resolvedBinDir,
    pathResult,
  };
}

function printHelp() {
  process.stdout.write(
    `${COMMAND_NAME} installer\n\n` +
    "Usage:\n" +
    "  node scripts/install_cli.js\n" +
    "  node scripts/install_cli.js --bin-dir /custom/bin\n" +
    "  node scripts/install_cli.js --print-bin-dir\n"
  );
}

function main(argv = process.argv.slice(2)) {
  if (argv.includes("--help") || argv.includes("-h")) {
    printHelp();
    return;
  }

  const binDirIndex = argv.indexOf("--bin-dir");
  const customBinDir = binDirIndex >= 0 ? argv[binDirIndex + 1] : undefined;
  if (binDirIndex >= 0 && !customBinDir) {
    throw new Error("--bin-dir requires a value");
  }

  if (argv.includes("--print-bin-dir")) {
    process.stdout.write(`${getDefaultBinDir()}\n`);
    return;
  }

  const result = installCli({ binDir: customBinDir });
  process.stdout.write(
    `Installed ${COMMAND_NAME} to ${result.launcherPath}\n` +
    `PATH entry: ${result.binDir}\n`
  );
  if (result.pathResult.updated) {
    process.stdout.write(`Updated ${result.pathResult.target}. Restart the shell to use ${COMMAND_NAME}.\n`);
  } else {
    process.stdout.write(`${result.pathResult.target} already configured.\n`);
  }
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`ERROR: ${error.message}\n`);
    process.exit(1);
  }
}

module.exports = {
  COMMAND_NAME,
  buildUnixLauncher,
  buildWindowsLauncher,
  ensureUnixPath,
  ensureWindowsPath,
  getDefaultBinDir,
  getUnixProfileCandidates,
  installCli,
  main,
};
