const { getMetadata, resolveApi, searchApis } = require("./metadata");
const {
  CONFIG_DIR_ENV,
  getConfigDir,
  getCredentialsPath,
  readCredentials,
  removeCredentials,
  resolveApiKey,
  saveCredentials,
} = require("./config");
const { version: PACKAGE_VERSION } = require("../package.json");

const BASE_URL = "https://data-api.investoday.net/data";
const REQUEST_TIMEOUT = 30_000;
const API_KEY_MANAGE_URL = "https://data-api.investoday.net/user/api-key";

function exitWithError(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function loadApiKey() {
  const { apiKey } = resolveApiKey();
  if (apiKey) {
    return apiKey;
  }

  exitWithError(
    "ERROR: 运行环境配置失败，请使用终端Bash运行`investoday-api init`配置。"
  );
}

function printHelp() {
  process.stdout.write(
    "investoday-api\n\n" +
    "Usage:\n" +
    "  investoday-api init\n" +
    "  investoday-api config status|path|remove\n" +
    "  investoday-api <endpoint> [key=value ...] [--method GET|POST]\n" +
    "  investoday-api list [group-or-subgroup]\n" +
    "  investoday-api search-api query=<query> [tool_ids=<tool_id,...>] [--text]\n" +
    "  investoday-api --version\n" +
    "  investoday-api --help\n\n" +
    "Commands:\n" +
    "  init     Initialize local InvestToday API key configuration\n" +
    "  config   Show, locate, or remove the local encrypted credentials\n" +
    "  list     List available groups, subgroups, or endpoints from bundled metadata\n" +
    "  search-api Search endpoints and return method, params, response fields, and example command\n\n" +
    "Examples:\n" +
    "  investoday-api init\n" +
    "  investoday-api config status\n" +
    "  investoday-api list\n" +
    "  investoday-api list 沪深京数据\n" +
    "  investoday-api list 沪深京数据/公司行为/基本信息\n" +
    "  investoday-api search-api query=股票,基本面分析\n" +
    "  investoday-api search-api tool_ids=list_stock_violation_penalt,list_stock_report_schema\n" +
    "  investoday-api search-api query=股票 --text\n" +
    "  investoday-api search key=贵州茅台 type=11\n" +
    "  investoday-api stock/basic-info stockCode=600519\n" +
    "  investoday-api fund/daily-quotes --method POST fundCode=000001 beginDate=2024-01-01 endDate=2024-12-31\n"
  );
}

function printVersion() {
  process.stdout.write(`${PACKAGE_VERSION}\n`);
}

function hasArg(args, name) {
  return args.includes(name);
}

function printInitHelp() {
  process.stdout.write(
    "Usage:\n" +
    "  investoday-api init\n\n" +
    "Default flow:\n" +
    "  Prompt for InvestToday API Key, verify it, then save it to local encrypted config.\n\n" +
    "Options:\n" +
    "  --skip-verify  Save without validating the API key first\n\n" +
    `Local config: ${getCredentialsPath()}\n`
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

async function resolveInitApiKey(args) {
  if (!process.stdin.isTTY || !process.stderr.isTTY) {
    exitWithError("ERROR: Interactive input is unavailable. Run 'investoday-api init' in an interactive terminal.");
  }

  const apiKey = await askInput("InvestToday API Key: ");
  if (!String(apiKey || "").trim()) {
    exitWithError("ERROR: API key cannot be empty.");
  }
  return apiKey.trim();
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
    throw new Error(`verification request failed: ${message}`);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`HTTP ${response.status}${body ? `: ${body.slice(0, 500)}` : ""}`);
  }

  const result = await response.json().catch(() => null);
  if (!result || result.code !== 0) {
    throw new Error(result && result.message ? result.message : "invalid response");
  }
}

async function runInitCommand(args) {
  if (hasArg(args, "--help") || hasArg(args, "-h")) {
    printInitHelp();
    return;
  }

  const allowed = new Set(["--skip-verify"]);
  for (const arg of args) {
    if (!allowed.has(arg)) {
      exitWithError(`ERROR: Unknown init option '${arg}'`);
    }
  }

  const apiKey = await resolveInitApiKey(args);
  if (!hasArg(args, "--skip-verify")) {
    process.stderr.write("Verifying InvestToday API key...\n");
    try {
      await verifyApiKey(apiKey);
    } catch (error) {
      exitWithError(
        `InvestToday API Key verification failed.\n` +
        `Error: ${error.message}\n` +
        `请登录 ${API_KEY_MANAGE_URL} 确认您的apiKey正确。`
      );
    }
  }

  try {
    saveCredentials(apiKey);
  } catch (error) {
    exitWithError(`ERROR: Failed to save credentials: ${error.message}`);
  }

  process.stdout.write(
    "InvestToday API key 配置成功\n\n" +
    "初始化完成 ✅\n"
  );
}

function runConfigCommand(args) {
  const action = args[0] || "status";
  if (action === "--help" || action === "-h" || action === "help") {
    process.stdout.write(
      "Usage:\n" +
      "  investoday-api config status\n" +
      "  investoday-api config path\n" +
      "  investoday-api config remove\n\n" +
      `Config dir env override: ${CONFIG_DIR_ENV}\n`
    );
    return;
  }

  if (action === "path") {
    process.stdout.write(`${getCredentialsPath()}\n`);
    return;
  }

  if (action === "remove") {
    removeCredentials();
    process.stdout.write("InvestToday local credentials removed.\n");
    return;
  }

  if (action === "status") {
    const localConfigured = Boolean(readCredentials());
    const activeSource = resolveApiKey().source;
    process.stdout.write(
      JSON.stringify({
        status: activeSource === "missing" ? "missing" : "configured",
        localConfig: localConfigured ? "configured" : "missing",
        activeSource,
        configDir: getConfigDir(),
        credentialsFile: getCredentialsPath(),
      }, null, 2) + "\n"
    );
    return;
  }

  exitWithError(`ERROR: Unknown config action '${action}'. Use status, path, or remove.`);
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
  const exampleParams = selectExampleParameters(parameters);
  const parts = [`investoday-api ${pathValue}`];
  if (method === "POST") {
    parts.push("--method POST");
  }

  for (const parameter of exampleParams) {
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

  return parts.join(" ");
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
    exitWithError(`ERROR: No group or endpoint matched '${normalizedQuery}'`);
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
    exitWithError("ERROR: search-api only accepts structured inputs such as query=... and tool_ids=....");
  }
  const params = parseStructuredArgs(structuredArgs);

  const queryInputs = ["query", "q"]
    .filter((key) => params[key] !== undefined)
    .flatMap((key) => (Array.isArray(params[key]) ? params[key] : [params[key]]));
  if (queryInputs.length > 1) {
    exitWithError("ERROR: search-api only accepts one query=... value. Use commas inside query=... for multiple keywords.");
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
    exitWithError(`ERROR: ${error}`);
  }
  if (!matches.length) {
    exitWithError(`ERROR: No endpoints matched ${formatSearchLabel(criteria) || "the provided criteria"}`);
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

  const lines = [`Matches for ${formatSearchLabel(criteria) || "the provided criteria"}:`];
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
      "Usage: investoday-api <endpoint> [key=value ...] [--method GET|POST]\n" +
      "Example: investoday-api stock/basic-info stockCode=600519"
    );
  }

  const apiPath = argv[0].replace(/^\/+/, "");
  let method = "GET";
  let methodSpecified = false;
  const params = {};

  let index = 1;
  while (index < argv.length) {
    const arg = argv[index];
    if (arg === "--method") {
      index += 1;
      if (index >= argv.length) {
        exitWithError("ERROR: --method requires GET or POST");
      }

      method = argv[index].toUpperCase();
      methodSpecified = true;
      if (method !== "GET" && method !== "POST") {
        exitWithError(`ERROR: Unsupported HTTP method '${method}', only GET and POST are supported`);
      }
    } else if (!arg.includes("=")) {
      exitWithError(`ERROR: Invalid argument '${arg}', expected key=value`);
    } else {
      const equalIndex = arg.indexOf("=");
      const key = arg.slice(0, equalIndex);
      const value = arg.slice(equalIndex + 1);

      if (!key) {
        exitWithError(`ERROR: Invalid argument '${arg}', key cannot be empty`);
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

  return { apiPath, method, methodSpecified, params };
}

function selectRequestMethod(apiPath, method, methodSpecified) {
  if (methodSpecified) {
    return method;
  }

  const { matches } = resolveApi(apiPath);
  if (matches.length === 1 && matches[0].path === apiPath) {
    return matches[0].method || method;
  }

  return method;
}

function buildUrl(apiPath, params) {
  let url = `${BASE_URL}/${apiPath}`;
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

async function callApi(apiPath, method, params, apiKey) {
  const headers = { apiKey };
  const requestOptions = {
    method,
    headers,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT),
  };

  let url = `${BASE_URL}/${apiPath}`;
  if (method === "POST") {
    headers["Content-Type"] = "application/json";
    requestOptions.body = JSON.stringify(params);
  } else {
    url = buildUrl(apiPath, params);
  }

  let response;
  try {
    response = await fetch(url, requestOptions);
  } catch (error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      exitWithError(`ERROR: Request timed out after ${REQUEST_TIMEOUT / 1000}s: ${url}`);
    }

    let message = String(error.message || error);
    if (apiKey && message.includes(apiKey)) {
      message = message.replaceAll(apiKey, "***");
    }
    exitWithError(`ERROR: Request failed: ${message}`);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    exitWithError(`ERROR: HTTP ${response.status}: ${url}\n${body.slice(0, 500)}`);
  }

  let result;
  try {
    result = await response.json();
  } catch {
    const body = await response.text().catch(() => "");
    exitWithError(`ERROR: Response is not valid JSON\n${body.slice(0, 500)}`);
  }

  if (result.code !== 0) {
    exitWithError(`ERROR: API returned error [${result.code}]: ${result.message || "Unknown error"}`);
  }

  if (result.data === undefined || result.data === null) {
    exitWithError("ERROR: API response does not contain a data field");
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

  if (argv[0] === "list") {
    runListCommand(argv.slice(1));
    return;
  }

  if (argv[0] === "schema" || argv[0] === "example") {
    exitWithError("ERROR: The schema and example commands were removed. Use 'investoday-api search-api <query>' instead.");
    return;
  }

  if (argv[0] === "search-api") {
    runSearchApiCommand(argv.slice(1));
    return;
  }

  const { apiPath, method, methodSpecified, params } = parseArgs(argv);
  const resolvedMethod = selectRequestMethod(apiPath, method, methodSpecified);
  const apiKey = loadApiKey();
  await callApi(apiPath, resolvedMethod, params, apiKey);
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
  runConfigCommand,
  runInitCommand,
  runSearchApiCommand,
  runListCommand,
  selectRequestMethod,
  verifyApiKey,
};

if (require.main === module) {
  main().catch((error) => {
    const message = error && error.message ? error.message : String(error);
    exitWithError(`ERROR: ${message}`);
  });
}
