const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const TASK_ID = "investoday-finance-data-auto-update";
const MACOS_LABEL = "investoday-api-update-task";
const LEGACY_MACOS_LABEL = "net.investoday.finance-data.auto-update";
const WINDOWS_TASK_NAME = "investoday-api-update-task";

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'"'"'`)}'`;
}

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function getExecutionPath() {
  const current = process.env.PATH || "";
  const common = process.platform === "win32"
    ? []
    : ["/usr/local/bin", "/opt/homebrew/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin"];
  return [...new Set([...current.split(path.delimiter).filter(Boolean), ...common])].join(path.delimiter);
}

function resolveExecutable(name) {
  const extensions = process.platform === "win32" ? ["", ".cmd", ".exe", ".bat"] : [""];
  for (const dir of getExecutionPath().split(path.delimiter).filter(Boolean)) {
    for (const extension of extensions) {
      const candidate = path.join(dir, `${name}${extension}`);
      try {
        fs.accessSync(candidate, fs.constants.X_OK);
        return candidate;
      } catch {
        // Try next candidate.
      }
    }
  }
  return "";
}

function getCacheDir() {
  return path.join(os.homedir(), ".cache", "investoday", "finance-data");
}

function getLogPaths(options = {}) {
  const logDir = path.join(getCacheDir(), "logs");
  if (options.create !== false) {
    fs.mkdirSync(logDir, { recursive: true, mode: 0o700 });
  }
  return {
    stdout: path.join(logDir, "auto-update.log"),
    stderr: path.join(logDir, "auto-update.err.log"),
  };
}

function getCliInvocation() {
  const script = process.argv[1] || "investoday-api";
  if (script && fs.existsSync(script)) {
    return {
      program: process.execPath,
      args: [script, "update", "run"],
      command: `${shellQuote(process.execPath)} ${shellQuote(script)} update run`,
      windowsCommand: `\"${process.execPath}\" \"${script}\" update run`,
    };
  }

  const resolvedCli = resolveExecutable("investoday-api");
  if (!resolvedCli) {
    throw new Error("investoday-api executable was not found in PATH");
  }
  return {
    program: resolvedCli,
    args: ["update", "run"],
    command: `${shellQuote(resolvedCli)} update run`,
    windowsCommand: `\"${resolvedCli}\" update run`,
  };
}

function parseDailyCron(cron) {
  const parts = String(cron || "").trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error("local_task_cron must be a standard 5-field cron expression");
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  if (!/^\d+$/.test(minute) || !/^\d+$/.test(hour)) {
    throw new Error("local_task_cron must use numeric minute and hour in this version");
  }
  if (dayOfMonth !== "*" || month !== "*" || dayOfWeek !== "*") {
    throw new Error("local_task_cron only supports daily schedules like '0 3 * * *' in this version");
  }

  const parsedMinute = Number(minute);
  const parsedHour = Number(hour);
  if (parsedMinute < 0 || parsedMinute > 59 || parsedHour < 0 || parsedHour > 23) {
    throw new Error("local_task_cron hour or minute is out of range");
  }

  return { minute: parsedMinute, hour: parsedHour, expression: `${parsedMinute} ${parsedHour} * * *` };
}

function getNextRunAt(cron, now = new Date()) {
  const { minute, hour } = parseDailyCron(cron);
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

function expectedCronLine(cron, options = {}) {
  const { expression } = parseDailyCron(cron);
  const logs = getLogPaths({ create: options.createLogs !== false });
  return `${expression} PATH=${shellQuote(getExecutionPath())} ${getCliInvocation().command} >> ${shellQuote(logs.stdout)} 2>> ${shellQuote(logs.stderr)} # ${TASK_ID}`;
}

function registerMacOS(cron) {
  const { minute, hour } = parseDailyCron(cron);
  const logs = getLogPaths();
  const invocation = getCliInvocation();
  const agentsDir = path.join(os.homedir(), "Library", "LaunchAgents");
  fs.mkdirSync(agentsDir, { recursive: true, mode: 0o700 });
  const plistPath = path.join(agentsDir, `${MACOS_LABEL}.plist`);
  const plist = `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"\n  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0">\n<dict>\n  <key>Label</key>\n  <string>${xmlEscape(MACOS_LABEL)}</string>\n  <key>ProgramArguments</key>\n  <array>\n    <string>${xmlEscape(invocation.program)}</string>\n${invocation.args.map((arg) => `    <string>${xmlEscape(arg)}</string>`).join("\n")}\n  </array>\n  <key>EnvironmentVariables</key>\n  <dict>\n    <key>PATH</key>\n    <string>${xmlEscape(getExecutionPath())}</string>\n  </dict>\n  <key>StartCalendarInterval</key>\n  <dict>\n    <key>Hour</key>\n    <integer>${hour}</integer>\n    <key>Minute</key>\n    <integer>${minute}</integer>\n  </dict>\n  <key>StandardOutPath</key>\n  <string>${xmlEscape(logs.stdout)}</string>\n  <key>StandardErrorPath</key>\n  <string>${xmlEscape(logs.stderr)}</string>\n</dict>\n</plist>\n`;
  fs.writeFileSync(plistPath, plist, { mode: 0o600 });
  const domain = `gui/${process.getuid ? process.getuid() : ""}`;
  const legacyPlistPath = path.join(agentsDir, `${LEGACY_MACOS_LABEL}.plist`);
  spawnSync("launchctl", ["bootout", domain, legacyPlistPath], { encoding: "utf8" });
  if (fs.existsSync(legacyPlistPath)) {
    fs.rmSync(legacyPlistPath, { force: true });
  }
  spawnSync("launchctl", ["bootout", domain, plistPath], { encoding: "utf8" });
  const loaded = spawnSync("launchctl", ["bootstrap", domain, plistPath], { encoding: "utf8" });
  if (loaded.status !== 0) {
    throw new Error((loaded.stderr || loaded.stdout || "launchctl bootstrap failed").trim());
  }
  return { status: "已注册", path: plistPath };
}

function unregisterMacOS() {
  const plistPath = path.join(os.homedir(), "Library", "LaunchAgents", `${MACOS_LABEL}.plist`);
  const legacyPlistPath = path.join(os.homedir(), "Library", "LaunchAgents", `${LEGACY_MACOS_LABEL}.plist`);
  const domain = `gui/${process.getuid ? process.getuid() : ""}`;
  spawnSync("launchctl", ["bootout", domain, plistPath], { encoding: "utf8" });
  spawnSync("launchctl", ["bootout", domain, legacyPlistPath], { encoding: "utf8" });
  if (fs.existsSync(plistPath)) {
    fs.rmSync(plistPath, { force: true });
  }
  if (fs.existsSync(legacyPlistPath)) {
    fs.rmSync(legacyPlistPath, { force: true });
  }
}

function getMacOSStatus(cron) {
  const plistPath = path.join(os.homedir(), "Library", "LaunchAgents", `${MACOS_LABEL}.plist`);
  if (!fs.existsSync(plistPath)) {
    return { registrationStatus: "未注册", path: plistPath };
  }
  const text = fs.readFileSync(plistPath, "utf8");
  const { minute, hour } = parseDailyCron(cron);
  const logs = getLogPaths({ create: false });
  const invocation = getCliInvocation();
  const expectedParts = [
    `<string>${xmlEscape(MACOS_LABEL)}</string>`,
    `<string>${xmlEscape(invocation.program)}</string>`,
    ...invocation.args.map((arg) => `<string>${xmlEscape(arg)}</string>`),
    `<integer>${hour}</integer>`,
    `<integer>${minute}</integer>`,
    `<string>${xmlEscape(logs.stdout)}</string>`,
    `<string>${xmlEscape(logs.stderr)}</string>`,
  ];
  if (expectedParts.some((part) => !text.includes(part))) {
    return { registrationStatus: "配置漂移", path: plistPath };
  }
  return { registrationStatus: "已注册", path: plistPath };
}

function readCrontab() {
  const result = spawnSync("crontab", ["-l"], { encoding: "utf8" });
  if (result.status !== 0 && !/no crontab/i.test(result.stderr || "")) {
    throw new Error((result.stderr || result.stdout || "crontab -l failed").trim());
  }
  return result.status === 0 ? result.stdout : "";
}

function writeCrontab(text) {
  const result = spawnSync("crontab", ["-"], { input: text, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || "crontab install failed").trim());
  }
}

function registerLinux(cron) {
  const line = expectedCronLine(cron);
  const current = readCrontab();
  const kept = current.split(/\r?\n/).filter((item) => item.trim() && !item.includes(`# ${TASK_ID}`));
  kept.push(line);
  writeCrontab(`${kept.join("\n")}\n`);
  return { status: "已注册", path: "user crontab" };
}

function unregisterLinux() {
  const current = readCrontab();
  const kept = current.split(/\r?\n/).filter((item) => item.trim() && !item.includes(`# ${TASK_ID}`));
  writeCrontab(kept.length ? `${kept.join("\n")}\n` : "");
}

function getLinuxStatus(cron) {
  const current = readCrontab();
  const lines = current.split(/\r?\n/).filter((item) => item.includes(`# ${TASK_ID}`));
  if (!lines.length) {
    return { registrationStatus: "未注册", path: "user crontab" };
  }
  if (!lines.includes(expectedCronLine(cron, { createLogs: false }))) {
    return { registrationStatus: "配置漂移", path: "user crontab" };
  }
  return { registrationStatus: "已注册", path: "user crontab" };
}

function registerWindows(cron) {
  const { hour, minute } = parseDailyCron(cron);
  const startTime = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  const result = spawnSync("schtasks", ["/Create", "/TN", WINDOWS_TASK_NAME, "/SC", "DAILY", "/ST", startTime, "/TR", getCliInvocation().windowsCommand, "/F"], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || "schtasks create failed").trim());
  }
  return { status: "已注册", path: WINDOWS_TASK_NAME };
}

function unregisterWindows() {
  spawnSync("schtasks", ["/Delete", "/TN", WINDOWS_TASK_NAME, "/F"], { encoding: "utf8" });
}

function getWindowsStatus(cron) {
  const result = spawnSync("schtasks", ["/Query", "/TN", WINDOWS_TASK_NAME, "/XML"], { encoding: "utf8" });
  if (result.status !== 0) {
    return { registrationStatus: "未注册", path: WINDOWS_TASK_NAME };
  }
  const { hour, minute } = parseDailyCron(cron);
  const text = result.stdout || "";
  const invocation = getCliInvocation();
  const commandOk = text.includes(invocation.windowsCommand) || text.includes(invocation.program);
  const expectedTime = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
  const timeOk = text.includes(expectedTime);
  if (!commandOk || !timeOk) {
    return { registrationStatus: "配置漂移", path: WINDOWS_TASK_NAME };
  }
  return { registrationStatus: "已注册", path: WINDOWS_TASK_NAME };
}

function registerTask(cron) {
  if (process.platform === "darwin") {
    return registerMacOS(cron);
  }
  if (process.platform === "win32") {
    return registerWindows(cron);
  }
  return registerLinux(cron);
}

function unregisterTask() {
  if (process.platform === "darwin") {
    unregisterMacOS();
    return;
  }
  if (process.platform === "win32") {
    unregisterWindows();
    return;
  }
  unregisterLinux();
}

function getTaskStatus(cron) {
  try {
    if (process.platform === "darwin") {
      return getMacOSStatus(cron);
    }
    if (process.platform === "win32") {
      return getWindowsStatus(cron);
    }
    return getLinuxStatus(cron);
  } catch (error) {
    return { registrationStatus: "注册异常", error: error.message };
  }
}

module.exports = {
  MACOS_LABEL,
  LEGACY_MACOS_LABEL,
  TASK_ID,
  WINDOWS_TASK_NAME,
  getCacheDir,
  getCliInvocation,
  getExecutionPath,
  getLogPaths,
  getNextRunAt,
  getTaskStatus,
  parseDailyCron,
  registerTask,
  unregisterTask,
};
