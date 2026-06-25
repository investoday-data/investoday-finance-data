const { getMetadata, resolveApi, searchApis } = require("./metadata");
const {
  BASE_SKILL_NAME,
  DEFAULT_SKILL_PACKAGE_BASE_URL,
  installSkillPackage,
} = require("./skill-installer");
const {
  CONFIG_DIR_ENV,
  API_BASE_URL_ENV,
  DEFAULT_API_BASE_URL,
  getConfigDir,
  getCredentialsPath,
  readConfig,
  readCredentials,
  removeApiBaseUrl,
  removeCredentials,
  resolveApiBaseUrl,
  resolveApiKey,
  saveApiBaseUrl,
  saveCredentials,
} = require("./config");
const { version: PACKAGE_VERSION } = require("../package.json");
const {
  fetchManifest,
  getManifestUrl,
  inferManifestTargetPath,
  listManifestTargetPaths,
  resolveManifestTargetPath,
  runUpdateCommand,
} = require("./update");

const BASE_URL = DEFAULT_API_BASE_URL;
const REQUEST_TIMEOUT = 30_000;
const API_KEY_MANAGE_URL = "https://data-api.investoday.net/user/api-key";

function exitWithError(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function redactSecrets(text, extraSecrets = []) {
  let redacted = String(text || "");
  const secrets = [
    ...extraSecrets,
    resolveApiKey().apiKey,
  ]
    .map((secret) => String(secret || "").trim())
    .filter(Boolean);

  for (const secret of new Set(secrets)) {
    redacted = redacted.replaceAll(secret, "***");
  }

  return redacted;
}

function loadApiKey() {
  const { apiKey } = resolveApiKey();
  if (apiKey) {
    return apiKey;
  }

  exitWithError(
    "错误：运行环境配置失败，请使用终端 Bash 运行 `investoday-api init` 完成配置。"
  );
}

function resolveEndpointApiKey() {
  return loadApiKey();
}

function printHelp() {
  process.stdout.write(
    "investoday-api\n\n" +
    "用法:\n" +
    "  investoday-api init\n" +
    "  investoday-api config status|path|remove|set-base-url|reset-base-url\n" +
    "  investoday-api update run|status|enable|disable|register|unregister\n" +
    "  investoday-api skill list [--page <n>] [--page-size <n>] [--json]\n" +
    "  investoday-api skill search <keyword> [--page <n>] [--page-size <n>] [--json]\n" +
    "  investoday-api skill target list [--json]\n" +
    "  investoday-api skill install <skill-name> [--target <skills-dir>] [--target-code <agent>] [--force] [--json]\n" +
    "  investoday-api <endpoint> [key=value ...] [--method GET|POST] [--body-json '<json>']\n" +
    "  investoday-api list [group-or-subgroup]\n" +
    "  investoday-api search-api query=<query> [tool_ids=<tool_id,...>] [--text]\n" +
    "  investoday-api --version\n" +
    "  investoday-api --help\n\n" +
    "命令:\n" +
    "  init       初始化本地 API Key 配置\n" +
    "  config     查看、定位或删除本地配置\n" +
    "  update     管理 investoday-api 和 skill 的后台自动更新\n" +
    "  skill      浏览、搜索或安装 Skill Store 中的 skill\n" +
    "  list       浏览接口分组、子分组或接口\n" +
    "  search-api 搜索接口并返回请求参数、响应字段和示例命令\n\n" +
    "示例:\n" +
    "  investoday-api init\n" +
    "  investoday-api config status\n" +
    "  investoday-api skill list\n" +
    "  investoday-api skill search 股票\n" +
    "  investoday-api skill target list\n" +
    "  investoday-api skill install investoday-finance-data --target \"<skills-dir>\"\n" +
    "  investoday-api list\n" +
    "  investoday-api list 沪深京数据\n" +
    "  investoday-api list 沪深京数据/公司行为/基本信息\n" +
    "  investoday-api search-api query=股票,基本面分析\n" +
    "  investoday-api search-api tool_ids=list_stock_violation_penalt,list_stock_report_schema\n" +
    "  investoday-api search-api query=股票 --text\n" +
    "  investoday-api search key=贵州茅台 type=11\n" +
    "  investoday-api stock/basic-info stockCode=600519\n" +
    "  investoday-api fund/daily-quotes --method POST fundCode=000001 beginDate=2024-01-01 endDate=2024-12-31\n" +
    "  investoday-api industry-quote/realtime-v2 --method POST industryLevel=1 industryType=SW sortColumn=changeRatio order=desc pageSize=10 --body-json '{\"industryCodes\":[]}'\n"
  );
}

function printVersion() {
  process.stdout.write(`${PACKAGE_VERSION}\n`);
}

function hasArg(args, name) {
  return args.includes(name);
}

function getOptionValue(args, name) {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === name) {
      const value = args[index + 1];
      if (value === undefined || String(value).startsWith("--")) {
        exitWithError(`错误：${name} 需要提供值。`);
      }
      return { present: true, value };
    }
    if (arg.startsWith(`${name}=`)) {
      return { present: true, value: arg.slice(name.length + 1) };
    }
  }
  return { present: false, value: "" };
}

function printInitHelp() {
  process.stdout.write(
    "用法:\n" +
    "  investoday-api init\n" +
    "  investoday-api init --api-key <API_KEY> --auto-update --skip-verify\n\n" +
    "默认流程:\n" +
    "  配置今日投资 API Key。\n" +
    `  请访问 ${API_KEY_MANAGE_URL} 获取 API Key。\n\n` +
    "选项:\n" +
    "  --api-key <key>   非交互式传入 API Key，适合一次性初始化\n" +
    "  --skip-verify     跳过 API Key 校验，直接保存\n" +
    "  --auto-update     不询问，直接启用后台自动更新\n" +
    "  --no-auto-update  不询问，直接关闭后台自动更新\n\n" +
    `本地配置文件: ${getCredentialsPath()}\n`
  );
}

function askInput(query) {
  const readline = require("node:readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stderr,
  });

  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function resolveInitApiKeys(args) {
  const apiKeyArg = getOptionValue(args, "--api-key");
  if (apiKeyArg.present) {
    const normalizedApiKey = String(apiKeyArg.value || "").trim();
    if (!normalizedApiKey) {
      exitWithError("错误：API Key 不能为空。");
    }
    return { apiKey: normalizedApiKey };
  }

  if (!process.stdin.isTTY || !process.stderr.isTTY) {
    exitWithError("错误：当前环境不支持交互式输入，请在终端中运行 `investoday-api init`。");
  }

  const existingResourceApiKey = resolveApiKey().apiKey;
  process.stderr.write(
    "\n┌ 今日投资 API 初始化\n" +
    "│\n" +
    `◇ 请访问 ${API_KEY_MANAGE_URL} 获取 API Key\n` +
    "│\n"
  );
  const apiKey = await askInput(
    "◆ 今日投资 API Key\n" +
    (existingResourceApiKey
      ? "已检测到本地 API Key，直接回车将保留现有配置。\n请输入新的 API Key（可选）: "
      : "请输入 API Key（必填）: ")
  );
  const normalizedApiKey = String(apiKey || "").trim();
  if (!normalizedApiKey && !existingResourceApiKey) {
    exitWithError("错误：API Key 不能为空。");
  }
  return {
    apiKey: normalizedApiKey || existingResourceApiKey,
  };
}

async function verifyApiKey(apiKey) {
  const url = buildUrl("trade-calender/cn/is-trade-date", { tDate: "2025-12-22" });
  let response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: { apiKey },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    });
  } catch (error) {
    let message = String(error.message || error);
    if (apiKey && message.includes(apiKey)) {
      message = message.replaceAll(apiKey, "***");
    }
    const errorName = String(error.name || "");
    const errorCode = String(error.code || error.cause && error.cause.code || "");
    const errorType = errorName === "TimeoutError" || errorName === "AbortError" || errorCode.includes("TIMEOUT")
      ? "network_timeout"
      : "network_unreachable";
    return {
      ok: false,
      errorType,
      serverConnected: false,
      message: errorType === "network_timeout"
        ? "连接今日投资数据服务超时，请检查网络或代理后重试。"
        : `无法连接今日投资数据服务，请检查网络、DNS、TLS 或代理后重试。${message ? ` ${message}` : ""}`.slice(0, 500),
    };
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    let serverMessage = body.slice(0, 500);
    try {
      const payload = JSON.parse(body);
      serverMessage = payload.message || payload.error || serverMessage;
    } catch {
      // keep plain text body
    }
    if (apiKey && serverMessage.includes(apiKey)) {
      serverMessage = serverMessage.replaceAll(apiKey, "***");
    }
    return {
      ok: false,
      errorType: response.status >= 500 ? "server_error" : "invalid_api_key",
      serverConnected: true,
      message: serverMessage || `HTTP ${response.status}`,
    };
  }

  const result = await response.json().catch(() => null);
  if (!result) {
    return {
      ok: false,
      errorType: "unexpected_response",
      serverConnected: true,
      message: "服务返回异常：响应不是合法 JSON。",
    };
  }
  if (!result || result.code !== 0) {
    let message = result && result.message ? result.message : "API Key 无效或无接口权限。";
    if (apiKey && message.includes(apiKey)) {
      message = message.replaceAll(apiKey, "***");
    }
    return {
      ok: false,
      errorType: "invalid_api_key",
      serverConnected: true,
      message,
    };
  }
  return { ok: true, errorType: null, serverConnected: true, message: result.message || "success" };
}

async function resolveAutoUpdateChoice(args) {
  const enableArg = hasArg(args, "--auto-update");
  const disableArg = hasArg(args, "--no-auto-update");
  if (enableArg && disableArg) {
    exitWithError("错误：--auto-update 和 --no-auto-update 不能同时使用。");
  }
  if (enableArg) {
    return true;
  }
  if (disableArg) {
    return false;
  }

  const answer = await askInput(
    "\n是否启用自动更新？\n" +
    "启用后将后台定时更新 investoday-api 及 skill，以保障您能及时获取到我们最新的 API。\n" +
    "默认：是\n" +
    "[Y/n]: "
  );
  const normalized = String(answer || "").trim().toLowerCase();
  return normalized !== "n" && normalized !== "no";
}

async function runInitCommand(args) {
  if (hasArg(args, "--help") || hasArg(args, "-h")) {
    printInitHelp();
    return;
  }

  const allowed = new Set(["--skip-verify", "--auto-update", "--no-auto-update"]);
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!allowed.has(arg)) {
      if (arg === "--api-key") {
        const value = args[index + 1];
        if (value === undefined || String(value).startsWith("--")) {
          exitWithError("错误：--api-key 需要提供值。");
        }
        index += 1;
        continue;
      }
      if (arg.startsWith("--api-key=")) {
        continue;
      }
      exitWithError(`错误：未知 init 参数 '${arg}'。`);
    }
  }
  if (hasArg(args, "--auto-update") && hasArg(args, "--no-auto-update")) {
    exitWithError("错误：--auto-update 和 --no-auto-update 不能同时使用。");
  }

  const { apiKey } = await resolveInitApiKeys(args);
  if (!hasArg(args, "--skip-verify")) {
    process.stderr.write("\n正在验证 API Key...\n");
    const verification = await verifyApiKey(apiKey);
    if (!verification.ok) {
      exitWithError(
        `今日投资 API Key 验证失败。\n` +
        `错误类型：${verification.errorType}\n` +
        `错误信息：${verification.message}\n` +
        `请登录 ${API_KEY_MANAGE_URL} 确认您的 API Key 是否正确。`
      );
    }
  }

  try {
    saveCredentials(apiKey, process.env);
  } catch (error) {
    exitWithError(`错误：保存 API Key 配置失败：${error.message}`);
  }

  process.stdout.write("\n今日投资 API Key 配置成功\n");

  const autoUpdateEnabled = await resolveAutoUpdateChoice(args);
  if (autoUpdateEnabled) {
    const enableResult = await runUpdateCommand(["enable"], { stdout: process.stdout, stderr: process.stderr });
    if (enableResult && enableResult.ok) {
      const runResult = await runUpdateCommand(["run"], { stdout: process.stdout, stderr: process.stderr });
      if (runResult && runResult.ok === false) {
        process.stderr.write("自动更新首次执行失败，可稍后运行 `investoday-api update status` 查看详情。\n");
      }
    }
  } else {
    await runUpdateCommand(["disable"], { stdout: process.stdout, stderr: process.stderr });
  }

  process.stdout.write("\n初始化完成 ✅\n");
}

function runConfigCommand(args) {
  const action = args[0] || "status";
  if (action === "--help" || action === "-h" || action === "help") {
    process.stdout.write(
      "用法:\n" +
      "  investoday-api config status\n" +
      "  investoday-api config path\n" +
      "  investoday-api config remove\n" +
      "  investoday-api config set-base-url <url>\n" +
      "  investoday-api config reset-base-url\n\n" +
      `Base URL environment override: ${API_BASE_URL_ENV}\n` +
      `Default Base URL: ${BASE_URL}\n\n` +
      `配置目录环境变量覆盖: \n`
    );
    return;
  }

  if (action === "path") {
    process.stdout.write(`${getCredentialsPath()}\n`);
    return;
  }

  if (action === "remove") {
    removeCredentials();
    process.stdout.write("今日投资本地配置已删除。\n");
    return;
  }

  if (action === "set-base-url") {
    const baseUrl = String(args[1] || "").trim();
    if (!baseUrl) {
      exitWithError("Error: config set-base-url requires a URL.");
    }
    if (args.length > 2) {
      exitWithError("Error: config set-base-url accepts exactly one URL.");
    }
    try {
      saveApiBaseUrl(baseUrl);
    } catch (error) {
      exitWithError(`Error: ${error.message}`);
    }
    process.stdout.write(`${resolveApiBaseUrl().baseUrl}\n`);
    return;
  }

  if (action === "reset-base-url") {
    removeApiBaseUrl();
    process.stdout.write(`${resolveApiBaseUrl().baseUrl}\n`);
    return;
  }

  if (action === "status") {
    const localCredentials = readCredentials();
    const resourceApiKey = resolveApiKey();
    const localConfig = readConfig() || {};
    const apiBaseUrl = resolveApiBaseUrl();
    const localConfigured = Boolean(localCredentials);
    process.stdout.write(
      JSON.stringify({
        status: resourceApiKey.source === "missing" ? "missing" : "configured",
        localConfig: localConfigured ? "configured" : "missing",
        activeSource: resourceApiKey.source,
        apiKey: {
          configured: resourceApiKey.source !== "missing",
          source: resourceApiKey.source,
          localConfig: localCredentials && localCredentials.apiKey ? "configured" : "missing",
        },
        baseUrl: {
          value: apiBaseUrl.baseUrl,
          source: apiBaseUrl.source,
          env: API_BASE_URL_ENV,
          localConfig: localConfig[API_BASE_URL_ENV] ? "configured" : "missing",
        },
        configDir: getConfigDir(),
        configFile: getCredentialsPath(),
      }, null, 2) + "\n"
    );
    return;
  }

  exitWithError(`错误：未知 config 操作 '${action}'，可用操作：status、path、remove。`);
}

function normalizeExampleParameterKey(name) {
  return String(name || "").replace(/Codes$/, "Code").replace(/Ids$/, "Id").replace(/List$/, "");
}

function selectExampleParameters(parameters) {
  const requiredParams = parameters.filter((parameter) => parameter.required);
  if (requiredParams.length) {
    return requiredParams;
  }

  const selected = [];
  const ignoredNames = new Set(["pageNum", "pageSize"]);

  for (const parameter of parameters) {
    if (ignoredNames.has(parameter.name)) {
      continue;
    }
    if (parameter.example === "" || parameter.example === undefined || parameter.example === null) {
      continue;
    }

    const normalizedName = normalizeExampleParameterKey(parameter.name);
    if (selected.some((item) => normalizeExampleParameterKey(item.name) === normalizedName)) {
      continue;
    }

    selected.push(parameter);
    if (selected.length >= 3) {
      break;
    }
  }

  return selected;
}

function formatExample(pathValue, method, parameters) {
  const queryParameters = (parameters || []).filter((parameter) => parameter.in !== "body");
  const bodyParameters = (parameters || []).filter((parameter) => parameter.in === "body");
  const exampleQueryParams = selectExampleParameters(queryParameters);
  const exampleBodyParams = selectExampleParameters(bodyParameters);
  const parts = [`investoday-api ${pathValue}`];
  if (method === "POST") {
    parts.push("--method POST");
  }

  for (const parameter of exampleQueryParams) {
    const example = parameter.example;
    if (parameter.type === "array") {
      const items = Array.isArray(example)
        ? example
        : [String(example || `<${parameter.name}>`).replace(/^\[|\]$/g, "").split(",")[0].trim().replace(/^['"]|['"]$/g, "")];
      for (const item of items.slice(0, 2)) {
        parts.push(`${parameter.name}=${item || `<${parameter.name}>`}`);
      }
    } else {
      parts.push(`${parameter.name}=${example !== "" && example !== undefined && example !== null ? example : `<${parameter.name}>`}`);
    }
  }

  if (method === "POST" && bodyParameters.length) {
    const body = {};
    const bodyParams = exampleBodyParams.length ? exampleBodyParams : bodyParameters.slice(0, 3);
    for (const parameter of bodyParams) {
      body[parameter.name] = exampleValueForParameter(parameter);
    }
    parts.push("--body-json", shellQuote(JSON.stringify(body)));
  }

  return parts.join(" ");
}

function exampleValueForParameter(parameter) {
  const example = parameter.example;
  if (example !== "" && example !== undefined && example !== null) {
    return example;
  }
  if (parameter.type === "array") {
    return [];
  }
  if (parameter.type === "integer" || parameter.type === "number") {
    return 0;
  }
  if (parameter.type === "boolean") {
    return false;
  }
  return `<${parameter.name}>`;
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

function compactText(value, maxLength = 140) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) {
    return "";
  }
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 1)}...`;
}

function printApiSuggestions(matches) {
  process.stderr.write("Multiple endpoints matched your query:\n");
  for (const match of matches.slice(0, 10)) {
    process.stderr.write(
      `- ${match.apiName} | ${match.path} | ${match.method} | ${match.groupPath.join(" / ")}\n`
    );
  }
  if (matches.length > 10) {
    process.stderr.write(`... and ${matches.length - 10} more\n`);
  }
}

function countEndpoints(node) {
  if (!node) {
    return 0;
  }

  let total = node.entries.length;
  for (const child of Object.values(node.children || {})) {
    total += countEndpoints(child);
  }
  return total;
}

function getGroupNode(groupTree, pathSegments) {
  let level = groupTree;
  let node = null;

  for (const part of pathSegments) {
    if (!part) {
      continue;
    }
    node = level[part];
    if (!node) {
      return null;
    }
    level = node.children;
  }

  return node;
}

function collectNamedGroupMatches(groupTree, label, parentPath = [], matches = []) {
  for (const [name, node] of Object.entries(groupTree || {})) {
    const currentPath = [...parentPath, name];
    if (name === label) {
      matches.push({ path: currentPath, node });
    }
    collectNamedGroupMatches(node.children, label, currentPath, matches);
  }

  return matches;
}

function renderEntries(headerPath, entries) {
  const lines = [`${headerPath.join(" / ")}:`];
  for (const entry of entries) {
    lines.push(`- ${entry.apiName} | ${entry.path} | ${entry.method} | tool_id=${entry.toolId}`);
    if (entry.description || entry.summary) {
      lines.push(`  desc: ${compactText(entry.description || entry.summary)}`);
    }
  }
  return lines;
}

function renderGroupNode(pathSegments, node) {
  const childEntries = Object.entries(node.children || {});
  if (!childEntries.length) {
    return renderEntries(pathSegments, node.entries);
  }

  const lines = [`${pathSegments.join(" / ")}:`];
  for (const [childName, childNode] of childEntries) {
    const subgroupCount = Object.keys(childNode.children || {}).length;
    const endpointCount = countEndpoints(childNode);
    if (subgroupCount > 0) {
      lines.push(`- ${childName} (${subgroupCount} subgroups, ${endpointCount} endpoints)`);
    } else {
      lines.push(`- ${childName} (${endpointCount} endpoints)`);
    }
  }

  if (node.entries.length) {
    lines.push("", "Endpoints:");
    lines.push(...renderEntries(pathSegments, node.entries).slice(1));
  }

  lines.push("", `Tip: investoday-api list ${pathSegments.join("/")}/<subgroup>`);
  return lines;
}

function renderGroupMatches(label, matches) {
  const lines = [`Matching groups for '${label}':`];
  for (const match of matches) {
    lines.push(`- ${match.path.join(" / ")} (${countEndpoints(match.node)} endpoints)`);
  }
  return lines;
}

function listTopGroups() {
  const { groupTree } = getMetadata();
  const lines = ["Top-level groups:"];

  for (const [topGroup, node] of Object.entries(groupTree)) {
    lines.push(`- ${topGroup} (${Object.keys(node.children).length} subgroups, ${countEndpoints(node)} endpoints)`);
  }

  lines.push("", "Tip: investoday-api list <group> or investoday-api list <group/subgroup/...>");
  process.stdout.write(`${lines.join("\n")}\n`);
}

function listGroup(query) {
  const normalizedQuery = query.trim();
  const { groupTree, records } = getMetadata();
  const directPath = normalizedQuery.split("/").map((part) => part.trim()).filter(Boolean);

  const directNode = getGroupNode(groupTree, directPath);
  if (directNode) {
    process.stdout.write(`${renderGroupNode(directPath, directNode).join("\n")}\n`);
    return;
  }

  const namedGroupMatches = collectNamedGroupMatches(groupTree, normalizedQuery);
  if (namedGroupMatches.length === 1) {
    const match = namedGroupMatches[0];
    process.stdout.write(`${renderGroupNode(match.path, match.node).join("\n")}\n`);
    return;
  }
  if (namedGroupMatches.length > 1) {
    process.stdout.write(`${renderGroupMatches(normalizedQuery, namedGroupMatches).join("\n")}\n`);
    return;
  }

  const { matches: fuzzyMatches } = searchApis({ query: [normalizedQuery] }, 20);

  if (!fuzzyMatches.length) {
    exitWithError(`错误：未找到匹配的分组或接口 '${normalizedQuery}'`);
  }

  const lines = [`Matches for '${normalizedQuery}':`];
  for (const match of fuzzyMatches.slice(0, 20)) {
    lines.push(`- ${match.apiName} | ${match.path} | ${match.method} | ${match.groupPath.join(" / ")}`);
    if (match.description || match.summary) {
      lines.push(`  desc: ${compactText(match.description || match.summary)}`);
    }
  }
  if (fuzzyMatches.length > 20) {
    lines.push(`... and ${fuzzyMatches.length - 20} more`);
  }
  process.stdout.write(`${lines.join("\n")}\n`);
}

function runListCommand(args) {
  if (!args.length) {
    listTopGroups();
    return;
  }

  listGroup(args.join(" "));
}

function summarizeNames(items, emptyLabel) {
  if (!items || !items.length) {
    return emptyLabel;
  }

  const names = items
    .map((item) => {
      const name = item.name ? String(item.name).trim() : "";
      const desc = item.desc ? String(item.desc).replace(/\s+/g, " ").trim() : "";
      if (!name) {
        return "";
      }
      if (!desc) {
        return name;
      }
      return `${name}(${desc})`;
    })
    .filter(Boolean);

  if (!names.length) {
    return emptyLabel;
  }
  if (names.length <= 6) {
    return names.join(", ");
  }
  return `${names.slice(0, 6).join(", ")} ... (+${names.length - 6})`;
}

function parseStructuredArgs(args) {
  const params = {};

  for (const arg of args) {
    const equalIndex = arg.indexOf("=");
    if (equalIndex <= 0) {
      continue;
    }
    const key = arg.slice(0, equalIndex);
    const value = arg.slice(equalIndex + 1);

    if (Object.prototype.hasOwnProperty.call(params, key)) {
      const existing = params[key];
      params[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
    } else {
      params[key] = value;
    }
  }

  return params;
}

function normalizeSearchCriteria(args) {
  const textMode = args.includes("--text");
  const filteredArgs = args.filter((arg) => arg !== "--text");
  const structuredArgs = filteredArgs.filter((arg) => arg.includes("="));
  const positionalArgs = filteredArgs.filter((arg) => !arg.includes("="));
  if (positionalArgs.length) {
    exitWithError("错误：search-api 只接受结构化入参，例如 query=... 和 tool_ids=...。");
  }
  const params = parseStructuredArgs(structuredArgs);

  const queryInputs = ["query", "q"]
    .filter((key) => params[key] !== undefined)
    .flatMap((key) => (Array.isArray(params[key]) ? params[key] : [params[key]]));
  if (queryInputs.length > 1) {
    exitWithError("错误：search-api 只允许一个 query=...，多个关键词请在 query=... 内用英文逗号分隔。");
  }

  const rawQueryValues = [];
  for (const key of ["query", "q"]) {
    if (params[key] !== undefined) {
      const value = params[key];
      rawQueryValues.push(...(Array.isArray(value) ? value : [value]));
    }
  }

  const rawToolIdValues = [];
  for (const key of ["tool_ids", "tool_id", "toolIds"]) {
    if (params[key] !== undefined) {
      const value = params[key];
      rawToolIdValues.push(...(Array.isArray(value) ? value : [value]));
    }
  }

  const query = rawQueryValues
    .flatMap((value) => String(value || "").split(","))
    .map((value) => value.trim())
    .filter(Boolean);
  const toolIds = rawToolIdValues
    .flatMap((value) => String(value || "").split(","))
    .map((value) => value.trim())
    .filter(Boolean);

  return {
    textMode,
    criteria: { query, toolIds },
  };
}

function formatSearchLabel(criteria) {
  const queryLabel = criteria.query.length ? `query='${criteria.query.join(" | ")}'` : null;
  const toolIdLabel = criteria.toolIds.length ? `tool_ids=${criteria.toolIds.join(",")}` : null;
  return [queryLabel, toolIdLabel].filter(Boolean).join(" ");
}

function runSearchApiCommand(args) {
  const { textMode, criteria } = normalizeSearchCriteria(args);
  const { matches, error } = searchApis(criteria, 10);
  if (error) {
    exitWithError(`错误：${error}`);
  }
  if (!matches.length) {
    exitWithError(`错误：未找到匹配接口 ${formatSearchLabel(criteria) || "当前查询条件"}`);
  }

  if (!textMode) {
    const payload = {
      query: criteria.query.join(" "),
      toolIds: criteria.toolIds,
      matches: matches.map((match) => ({
        apiName: match.apiName,
        path: match.path,
        method: match.method,
        reference: match.reference,
        toolId: match.toolId,
        description: match.description,
        requestParams: match.parameters,
        responseFields: match.responseFields,
        exampleCommand: formatExample(match.path, match.method, match.parameters),
      })),
    };
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return;
  }

  const lines = [`Matches for ${formatSearchLabel(criteria) || "当前查询条件"}:`];
  for (const match of matches) {
    lines.push(`- ${match.apiName} | ${match.path} | ${match.method} | ${match.groupPath.join(" / ")}`);
    if (match.description || match.summary) {
      lines.push(`  desc: ${compactText(match.description || match.summary)}`);
    }
    lines.push(`  request params: ${summarizeNames(match.parameters, "none")}`);
    lines.push(`  response fields: ${summarizeNames(match.responseFields, "none")}`);
    lines.push(`  example: ${formatExample(match.path, match.method, match.parameters)}`);
  }

  process.stdout.write(`${lines.join("\n")}\n`);
}

function parseArgs(argv) {
  if (!argv.length) {
    exitWithError(
      "用法：investoday-api <endpoint> [key=value ...] [--method GET|POST]\n" +
      "示例：investoday-api stock/basic-info stockCode=600519"
    );
  }

  const apiPath = argv[0].replace(/^\/+/, "");
  let method = "GET";
  let methodSpecified = false;
  const params = {};
  let bodyJson = null;

  let index = 1;
  while (index < argv.length) {
    const arg = argv[index];
    if (arg === "--method") {
      index += 1;
      if (index >= argv.length) {
        exitWithError("错误：--method 只支持 GET 或 POST。");
      }

      method = argv[index].toUpperCase();
      methodSpecified = true;
      if (method !== "GET" && method !== "POST") {
        exitWithError(`错误：不支持的 HTTP 方法 '${method}'，目前只支持 GET 和 POST`);
      }
    } else if (arg === "--body-json" || arg.startsWith("--body-json=")) {
      let rawBody = "";
      if (arg === "--body-json") {
        index += 1;
        if (index >= argv.length) {
          exitWithError("错误：--body-json 需要提供 JSON 对象字符串。");
        }
        rawBody = argv[index];
      } else {
        rawBody = arg.slice("--body-json=".length);
      }

      try {
        bodyJson = JSON.parse(rawBody);
      } catch {
        exitWithError("错误：--body-json 不是合法 JSON。");
      }
      if (!bodyJson || typeof bodyJson !== "object" || Array.isArray(bodyJson)) {
        exitWithError("错误：--body-json 只支持 JSON 对象。");
      }
    } else if (!arg.includes("=")) {
      exitWithError(`错误：参数 '${arg}' 格式无效，应使用 key=value`);
    } else {
      const equalIndex = arg.indexOf("=");
      const key = arg.slice(0, equalIndex);
      const value = arg.slice(equalIndex + 1);

      if (!key) {
        exitWithError(`错误：参数 '${arg}' 格式无效，key 不能为空`);
      }

      if (Object.prototype.hasOwnProperty.call(params, key)) {
        const existing = params[key];
        params[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
      } else {
        params[key] = value;
      }
    }

    index += 1;
  }

  return { apiPath, method, methodSpecified, params, bodyJson };
}

function selectRequestMethod(apiPath, method, methodSpecified) {
  if (methodSpecified) {
    return method;
  }

  const endpoint = resolveRequestEndpoint(apiPath);
  if (endpoint) {
    return endpoint.method || method;
  }

  return method;
}

function resolveRequestEndpoint(apiPath, method = "") {
  const normalizedMethod = String(method || "").toUpperCase();
  if (normalizedMethod) {
    const { pathMap } = getMetadata();
    const methodDetail = pathMap[`${apiPath}#${normalizedMethod}`];
    if (methodDetail) {
      return methodDetail;
    }
  }

  const { matches } = resolveApi(apiPath);
  if (matches.length === 1 && matches[0].path === apiPath) {
    return matches[0];
  }

  return null;
}

function buildUrl(apiPath, params, options = {}) {
  const baseUrl = String(options.baseUrl || resolveApiBaseUrl().baseUrl).replace(/\/+$/g, "");
  let url = `${baseUrl}/${apiPath}`;
  if (!Object.keys(params).length) {
    return url;
  }

  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      value.forEach((item) => searchParams.append(key, item));
    } else {
      searchParams.append(key, value);
    }
  }

  return `${url}?${searchParams.toString()}`;
}

function coerceBodyValue(value, parameter) {
  if (Array.isArray(value)) {
    return value;
  }

  const rawValue = String(value);
  const type = parameter?.type || "";
  if ((type === "array" || type === "object") && /^[\[{]/.test(rawValue.trim())) {
    try {
      return JSON.parse(rawValue);
    } catch {
      return value;
    }
  }
  return value;
}

function splitPostParams(params, endpoint, bodyJson = null) {
  const queryParams = {};
  const bodyParams = bodyJson ? { ...bodyJson } : {};
  const parameters = endpoint?.parameters || [];
  const bodyNames = new Set(parameters.filter((parameter) => parameter.in === "body").map((parameter) => parameter.name));
  const queryNames = new Set(parameters.filter((parameter) => parameter.in !== "body").map((parameter) => parameter.name));
  const parameterByName = new Map(parameters.map((parameter) => [parameter.name, parameter]));

  if (!bodyNames.size && !queryNames.size) {
    return {
      queryParams,
      bodyParams: bodyJson ? { ...bodyJson, ...params } : params,
    };
  }

  for (const [key, value] of Object.entries(params || {})) {
    if (bodyNames.has(key) && !queryNames.has(key)) {
      bodyParams[key] = coerceBodyValue(value, parameterByName.get(key));
    } else {
      queryParams[key] = value;
    }
  }

  return { queryParams, bodyParams };
}

function printSkillHelp() {
  process.stdout.write(
    "用法:\n" +
    "  investoday-api skill list [--page <n>] [--page-size <n>] [--json]\n" +
    "  investoday-api skill search <keyword> [--page <n>] [--page-size <n>] [--json]\n" +
    "  investoday-api skill target list [--json]\n" +
    "  investoday-api skill install <skill-name> [--target <skills-dir>] [--target-code <agent>] [--force] [--json]\n\n" +
    "选项:\n" +
    "  --page <n>          页码，默认 1\n" +
    "  --page-size <n>     每页条数，默认 20\n" +
    "  --sort <value>      排序方式，默认 score\n" +
    "  --skill-type <n>    Skill 类型，默认 1\n" +
    "  --category <slug>   分类 slug 过滤\n" +
    "  --tag <tag>         标签过滤\n" +
    "  --target <dir>      用户指定的 skills 根目录，优先级最高\n" +
    "  --target-code <code>未指定 --target 时，从 manifest 按 agent code 解析 skills 根目录\n" +
    "  --force             已存在时备份并覆盖\n" +
    "  --base-url <url>    指定 skill zip 包基础地址\n" +
    "  --version <value>   指定安装版本，默认 latest\n" +
    "  --json              输出接口返回的 JSON 结构\n\n" +
    "示例:\n" +
    "  investoday-api skill list\n" +
    "  investoday-api skill search 股票\n" +
    "  investoday-api skill target list\n" +
    "  investoday-api skill install investoday-finance-data --target \"C:\\Users\\me\\.codex\\skills\"\n" +
    "  investoday-api skill install investoday-finance-data --target-code <agent-code>\n"
  );
}

function readInlineOrNextValue(args, index, name) {
  const arg = args[index];
  if (arg.startsWith(`${name}=`)) {
    return { value: arg.slice(name.length + 1), nextIndex: index };
  }

  const value = args[index + 1];
  if (value === undefined || String(value).startsWith("--")) {
    exitWithError(`错误：${name} 需要提供值。`);
  }
  return { value, nextIndex: index + 1 };
}

function setSkillParam(params, key, value) {
  const aliases = {
    page: "page",
    pageSize: "pageSize",
    "page-size": "pageSize",
    sort: "sort",
    skillType: "skillType",
    "skill-type": "skillType",
    category: "category",
    categoryType: "categoryType",
    "category-type": "categoryType",
    tag: "tag",
    keyword: "keyword",
  };
  const resolvedKey = aliases[key];
  if (!resolvedKey) {
    return false;
  }
  params[resolvedKey] = value;
  return true;
}

function isSkillApiKeyOption(key) {
  return key === "apiKey" || key === "api-key";
}

function parseSkillStoreArgs(args, options = {}) {
  const params = {
    skillType: "1",
    sort: "score",
    page: "1",
    pageSize: "20",
  };
  const positional = [];
  let json = false;
  let help = false;
  let apiKey = "";
  let apiKeyProvided = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--help" || arg === "-h" || arg === "help") {
      help = true;
      continue;
    }

    if (arg.startsWith("--")) {
      const optionName = arg.includes("=") ? arg.slice(2, arg.indexOf("=")) : arg.slice(2);
      const { value, nextIndex } = readInlineOrNextValue(args, index, `--${optionName}`);
      if (isSkillApiKeyOption(optionName)) {
        apiKey = value;
        apiKeyProvided = true;
        index = nextIndex;
        continue;
      }
      if (!setSkillParam(params, optionName, value)) {
        exitWithError(`错误：未知 skill 选项 --${optionName}`);
      }
      index = nextIndex;
      continue;
    }

    if (arg.includes("=")) {
      const [key, ...rest] = arg.split("=");
      if (isSkillApiKeyOption(key)) {
        apiKey = rest.join("=");
        apiKeyProvided = true;
        continue;
      }
      if (setSkillParam(params, key, rest.join("="))) {
        continue;
      }
    }

    positional.push(arg);
  }

  if (options.keywordRequired && !params.keyword) {
    params.keyword = positional.join(" ").trim();
  }

  return { params, positional, json, help, apiKey, apiKeyProvided };
}

function normalizeSkillStorePayload(result) {
  const pageSource = result && Array.isArray(result.data)
    ? result
    : result && result.data && Array.isArray(result.data.data)
      ? result.data
      : result || {};
  return {
    data: Array.isArray(pageSource.data) ? pageSource.data : [],
    totalCount: pageSource.totalCount ?? 0,
    pages: pageSource.pages ?? 0,
    page: pageSource.page ?? 1,
    pageSize: pageSource.pageSize ?? 20,
    hasNextPage: Boolean(pageSource.hasNextPage),
    nextPage: pageSource.nextPage ?? null,
    lastPage: Boolean(pageSource.lastPage),
  };
}

function summarizeSkillText(value, maxLength = 80) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 3)}...`;
}

function printSkillStoreText(payload, params) {
  const label = params.keyword ? `Skills matching '${params.keyword}'` : "Skills";
  const total = payload.totalCount ?? payload.data.length;
  process.stdout.write(`${label} (page ${payload.page}/${payload.pages || 1}, total ${total}):\n`);

  if (!payload.data.length) {
    process.stdout.write("  No skills found.\n");
    return;
  }

  for (const skill of payload.data) {
    const displayName = skill.displayName || skill.name || "(unnamed)";
    const name = skill.name && skill.displayName !== skill.name ? ` (${skill.name})` : "";
    const version = skill.defaultVersion ? ` v${skill.defaultVersion}` : "";
    process.stdout.write(`- ${displayName}${name}${version}\n`);
    const details = [
      skill.categoryName ? `category: ${skill.categoryName}` : "",
      skill.publisherName ? `publisher: ${skill.publisherName}` : "",
      skill.downloadCount !== undefined ? `downloads: ${skill.downloadCount}` : "",
      skill.viewCount !== undefined ? `views: ${skill.viewCount}` : "",
    ].filter(Boolean);
    if (details.length) {
      process.stdout.write(`  ${details.join(" | ")}\n`);
    }
    const summary = skill.summary || skill.description;
    if (summary) {
      process.stdout.write(`  desc: ${summarizeSkillText(summary)}\n`);
    }
  }
}

async function fetchSkillStoreSkills(params, apiKeyOverride = "", apiKeyProvided = false) {
  const apiKey = String(apiKeyProvided ? apiKeyOverride : resolveApiKey().apiKey || "").trim();
  if (!apiKey) {
    exitWithError("错误：未检测到 API Key，请先运行 `investoday-api init` 完成初始化，或通过 --api-key <key> 临时传入。");
  }

  const url = buildUrl("skill-store/store/skills", { ...params, apiKey });

  let response;
  try {
    response = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    });
  } catch (error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      exitWithError(`错误：请求超时，耗时超过 ${REQUEST_TIMEOUT / 1000}s: ${url}`);
    }

    const message = redactSecrets(String(error.message || error), [apiKey]);
    exitWithError(`错误：请求失败： ${message}`);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    exitWithError(redactSecrets(`错误：HTTP ${response.status}: ${url}\n${body.slice(0, 500)}`, [apiKey]));
  }

  let result;
  try {
    result = await response.json();
  } catch {
    const body = await response.text().catch(() => "");
    exitWithError(`错误：响应不是合法 JSON\n${body.slice(0, 500)}`);
  }

  if (result.code !== undefined && result.code !== 0 && result.code !== "Success") {
    exitWithError(redactSecrets(`错误：API 返回错误 [${result.code}]: ${result.message || "未知错误"}`, [apiKey]));
  }

  return normalizeSkillStorePayload(result);
}

function parseSkillInstallArgs(args) {
  const options = {
    baseUrl: DEFAULT_SKILL_PACKAGE_BASE_URL,
    version: "latest",
    force: false,
    json: false,
  };
  const positional = [];
  let help = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--help" || arg === "-h") {
      help = true;
      continue;
    }
    if (arg === "--json") {
      options.json = true;
      continue;
    }
    if (arg === "--force") {
      options.force = true;
      continue;
    }
    if (arg.startsWith("--")) {
      const optionName = arg.includes("=") ? arg.slice(2, arg.indexOf("=")) : arg.slice(2);
      const { value, nextIndex } = readInlineOrNextValue(args, index, `--${optionName}`);
      if (optionName === "target") {
        options.targetRoot = value;
      } else if (optionName === "target-code") {
        options.targetCode = value;
      } else if (optionName === "base-url") {
        options.baseUrl = value;
      } else if (optionName === "version") {
        options.version = value;
      } else {
        exitWithError(`错误：未知 skill install 选项 --${optionName}`);
      }
      index = nextIndex;
      continue;
    }
    positional.push(arg);
  }

  return { skillName: positional[0] || "", extra: positional.slice(1), options, help };
}

function parseSkillTargetListArgs(args) {
  let json = false;
  let help = false;
  const extra = [];
  for (const arg of args) {
    if (arg === "--json") {
      json = true;
    } else if (arg === "--help" || arg === "-h" || arg === "help") {
      help = true;
    } else {
      extra.push(arg);
    }
  }
  return { json, help, extra };
}

function buildSkillTargetListPayload(manifest) {
  const rows = listManifestTargetPaths(manifest);
  const clients = [];
  const clientById = new Map();
  for (const row of rows) {
    const key = row.clientId || row.clientName;
    if (!clientById.has(key)) {
      const client = {
        id: row.clientId,
        name: row.clientName,
        targets: [],
      };
      clientById.set(key, client);
      clients.push(client);
    }
    const client = clientById.get(key);
    let target = client.targets.find((item) => item.type === row.targetType);
    if (!target) {
      target = row.targetType === "fixed"
        ? { type: row.targetType, paths: {}, resolvedPaths: {} }
        : { type: row.targetType, paths: [], resolvedPaths: [] };
      client.targets.push(target);
    }
    if (row.targetType === "fixed") {
      target.paths[row.targetCode] = row.path;
      target.resolvedPaths[row.targetCode] = row.resolvedPath;
    } else {
      target.paths.push(row.path);
      target.resolvedPaths.push(row.resolvedPath);
    }
  }

  return {
    manifestUrl: getManifestUrl(),
    clients,
    targets: rows,
  };
}

function printSkillTargetListText(payload) {
  process.stdout.write(`Skill targets (${payload.targets.length}) from ${payload.manifestUrl}:\n`);
  if (!payload.targets.length) {
    process.stdout.write("  No target paths found.\n");
    return;
  }

  for (const client of payload.clients) {
    process.stdout.write(`- ${client.name}${client.id && client.id !== client.name ? ` (${client.id})` : ""}\n`);
    for (const target of client.targets) {
      if (target.type === "fixed") {
        for (const [targetCode, targetPath] of Object.entries(target.paths)) {
          process.stdout.write(`  ${targetCode}: ${target.resolvedPaths[targetCode]} (${targetPath})\n`);
        }
      } else {
        target.paths.forEach((targetPath, index) => {
          process.stdout.write(`  discovery[${index}]: ${target.resolvedPaths[index]} (${targetPath})\n`);
        });
      }
    }
  }
}

async function runSkillTargetCommand(args) {
  const action = args[0] || "list";
  if (action === "--help" || action === "-h" || action === "help") {
    printSkillHelp();
    return;
  }
  if (action !== "list") {
    exitWithError(`错误：未知 skill target 命令 '${action}'。可运行 investoday-api skill --help 查看用法。`);
  }

  const { json, help, extra } = parseSkillTargetListArgs(args.slice(1));
  if (help) {
    printSkillHelp();
    return;
  }
  if (extra.length) {
    exitWithError(`错误：skill target list 无法识别: ${extra.join(" ")}`);
  }

  const manifest = await fetchManifest();
  const payload = buildSkillTargetListPayload(manifest);
  if (json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  } else {
    printSkillTargetListText(payload);
  }
}

async function resolveSkillInstallOptions(options) {
  if (options.targetRoot) {
    return options;
  }

  let manifest = null;
  try {
    manifest = await fetchManifest();
    if (options.targetCode) {
      const target = resolveManifestTargetPath(manifest, options.targetCode);
      if (target) {
        return {
          ...options,
          targetRoot: target.resolvedPath,
          resolvedTarget: target,
        };
      }
    }

    const inferredTarget = inferManifestTargetPath(manifest);
    if (inferredTarget) {
      return {
        ...options,
        targetRoot: inferredTarget.resolvedPath,
        resolvedTarget: inferredTarget,
      };
    }
  } catch (error) {
    throw error;
  }

  return options;
}

function formatSkillInstallStatus(status) {
  const labels = {
    "already-installed": "已就绪",
    installed: "已安装",
    updated: "已更新",
    failed: "失败",
  };
  return labels[status] || status || "未知";
}

function printSkillInstallText(result) {
  process.stdout.write("环境准备:\n");
  if (result.baseSkill) {
    process.stdout.write(`- ${result.baseSkill.name}: ${formatSkillInstallStatus(result.baseSkill.status)}\n`);
    process.stdout.write(`- 路径: ${result.baseSkill.path}\n`);
    if (result.baseSkill.localVersion || result.baseSkill.remoteVersion) {
      process.stdout.write(`- 版本: local=${result.baseSkill.localVersion || "unknown"}, latest=${result.baseSkill.remoteVersion || "unknown"}\n`);
    }
  }
  process.stdout.write("\n");

  process.stdout.write("目标 skill:\n");
  if (result.targetSkill) {
    process.stdout.write(`- ${result.targetSkill.name}: ${formatSkillInstallStatus(result.targetSkill.status)}\n`);
    process.stdout.write(`- 路径: ${result.targetSkill.path}\n`);
    if (result.targetSkill.localVersion || result.targetSkill.remoteVersion) {
      process.stdout.write(`- 版本: local=${result.targetSkill.localVersion || "unknown"}, latest=${result.targetSkill.remoteVersion || "unknown"}\n`);
    }
  } else {
    process.stdout.write(`- ${result.requestedSkill}: 未执行\n`);
  }

  process.stdout.write("\n阻塞原因:\n");
  process.stdout.write(`- ${result.blockedReason || "无"}\n`);
}

async function runSkillInstallCommand(args) {
  const { skillName, extra, options: parsedOptions, help } = parseSkillInstallArgs(args);
  if (help) {
    printSkillHelp();
    return;
  }
  if (!skillName) {
    exitWithError("错误：skill install 需要提供 skill 名称。");
  }
  if (extra.length) {
    exitWithError(`错误：skill install 只接受一个 skill 名称，无法识别: ${extra.join(" ")}`);
  }
  const result = {
    requestedSkill: skillName,
    baseSkill: null,
    targetSkill: null,
    blockedReason: "",
  };
  let options = parsedOptions;

  try {
    options = await resolveSkillInstallOptions(parsedOptions);
    if (skillName === BASE_SKILL_NAME) {
      result.targetSkill = await installSkillPackage(skillName, options);
    } else {
      result.baseSkill = await installSkillPackage(BASE_SKILL_NAME, options);
    }

    if (!result.targetSkill) {
      result.targetSkill = await installSkillPackage(skillName, options);
    }
    if (options.json) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      printSkillInstallText(result);
    }
  } catch (error) {
    result.blockedReason = redactSecrets(error.message || error);
    if (options.json) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      printSkillInstallText(result);
    }
    process.exit(1);
  }
}

async function runSkillCommand(args) {
  const action = args[0] || "help";
  if (action === "--help" || action === "-h" || action === "help") {
    printSkillHelp();
    return;
  }

  if (action === "list") {
    const { params, json, help, apiKey, apiKeyProvided } = parseSkillStoreArgs(args.slice(1));
    if (help) {
      printSkillHelp();
      return;
    }
    const payload = await fetchSkillStoreSkills(params, apiKey, apiKeyProvided);
    if (json) {
      process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    } else {
      printSkillStoreText(payload, params);
    }
    return;
  }

  if (action === "search") {
    const { params, json, help, apiKey, apiKeyProvided } = parseSkillStoreArgs(args.slice(1), { keywordRequired: true });
    if (help) {
      printSkillHelp();
      return;
    }
    if (!params.keyword) {
      exitWithError("错误：skill search 需要提供搜索关键词。");
    }
    const payload = await fetchSkillStoreSkills(params, apiKey, apiKeyProvided);
    if (json) {
      process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    } else {
      printSkillStoreText(payload, params);
    }
    return;
  }

  if (action === "install") {
    await runSkillInstallCommand(args.slice(1));
    return;
  }

  if (action === "target") {
    await runSkillTargetCommand(args.slice(1));
    return;
  }

  exitWithError(`错误：未知 skill 命令 '${action}'。可运行 investoday-api skill --help 查看用法。`);
}

async function callApi(apiPath, method, params, apiKey, options = {}) {
  const headers = { apiKey };
  const requestOptions = {
    method,
    headers,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT),
  };

  let url = buildUrl(apiPath, {});
  if (method === "POST") {
    const { queryParams, bodyParams } = splitPostParams(params, options.endpoint, options.bodyJson);
    url = buildUrl(apiPath, queryParams);
    headers["Content-Type"] = "application/json";
    requestOptions.body = JSON.stringify(bodyParams);
  } else {
    if (options.bodyJson) {
      exitWithError("错误：--body-json 只能用于 POST 请求。");
    }
    url = buildUrl(apiPath, params);
  }

  let response;
  try {
    response = await fetch(url, requestOptions);
  } catch (error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      exitWithError(`错误：请求超时，耗时超过 ${REQUEST_TIMEOUT / 1000}s: ${url}`);
    }

    const message = redactSecrets(String(error.message || error), [apiKey]);
    exitWithError(`错误：请求失败： ${message}`);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    exitWithError(redactSecrets(`错误：HTTP ${response.status}: ${url}\n${body.slice(0, 500)}`, [apiKey]));
  }

  let result;
  try {
    result = await response.json();
  } catch {
    const body = await response.text().catch(() => "");
    exitWithError(`错误：响应不是合法 JSON\n${body.slice(0, 500)}`);
  }

  if (result.code !== 0) {
    exitWithError(redactSecrets(`错误：API 返回错误 [${result.code}]: ${result.message || "未知错误"}`, [apiKey]));
  }

  if (result.data === undefined || result.data === null) {
    exitWithError("错误：API 响应中没有 data 字段。");
  }

  process.stdout.write(`${JSON.stringify(result.data, null, 2)}\n`);
}

async function main(argv = process.argv.slice(2)) {
  if (!argv.length || argv[0] === "--help" || argv[0] === "-h" || argv[0] === "help") {
    printHelp();
    return;
  }

  if (argv[0] === "--version" || argv[0] === "-v" || argv[0] === "version") {
    printVersion();
    return;
  }

  if (argv[0] === "init") {
    await runInitCommand(argv.slice(1));
    return;
  }

  if (argv[0] === "config") {
    runConfigCommand(argv.slice(1));
    return;
  }

  if (argv[0] === "update") {
    const result = await runUpdateCommand(argv.slice(1), { stdout: process.stdout, stderr: process.stderr });
    if (result && result.ok === false) {
      process.exitCode = 1;
    }
    return;
  }

  if (argv[0] === "skill") {
    await runSkillCommand(argv.slice(1));
    return;
  }

  if (argv[0] === "list") {
    runListCommand(argv.slice(1));
    return;
  }

  if (argv[0] === "schema" || argv[0] === "example") {
    exitWithError("错误：schema 和 example 命令已移除，请改用 `investoday-api search-api query=<关键词>`。");
    return;
  }

  if (argv[0] === "search-api") {
    runSearchApiCommand(argv.slice(1));
    return;
  }

  const { apiPath, method, methodSpecified, params, bodyJson } = parseArgs(argv);
  const endpoint = resolveRequestEndpoint(apiPath, methodSpecified ? method : "");
  const resolvedMethod = methodSpecified ? method : (endpoint?.method || method);
  const apiKey = resolveEndpointApiKey(endpoint);
  await callApi(apiPath, resolvedMethod, params, apiKey, { endpoint, bodyJson });
}

module.exports = {
  BASE_URL,
  REQUEST_TIMEOUT,
  buildUrl,
  callApi,
  formatExample,
  loadApiKey,
  main,
  parseArgs,
  printHelp,
  printVersion,
  splitPostParams,
  resolveEndpointApiKey,
  resolveRequestEndpoint,
  runConfigCommand,
  runInitCommand,
  runSkillInstallCommand,
  runSkillCommand,
  runSearchApiCommand,
  runListCommand,
  selectRequestMethod,
  verifyApiKey,
};

if (require.main === module) {
  main().catch((error) => {
    const message = error && error.message ? error.message : String(error);
    exitWithError(`错误：${message}`);
  });
}
