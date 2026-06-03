const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const {
  main,
  parseArgs,
  resolveEndpointApiKey,
  selectRequestMethod,
  shouldUseSubscriptionApiKey,
  splitPostParams,
  verifyApiKey,
} = require("../lib/call-api");
const { getMetadata } = require("../lib/metadata");
const { parseDailyCron } = require("../lib/scheduler");
const {
  DEFAULT_MANIFEST_URL,
  UPDATE_MANIFEST_URL_ENV,
  compareVersions,
  getManifestUrl,
  getStatus,
  runUpdate,
} = require("../lib/update");
const {
  API_KEY_ENV,
  SUB_API_KEY_ENV,
  CONFIG_DIR_ENV,
  getCredentialsPath,
  getLegacyCredentialsPath,
  getLegacyKeyPath,
  readCredentials,
  removeCredentials,
  resolveApiKey,
  resolveSubscriptionApiKey,
  saveCredentials,
} = require("../lib/config");
const { version } = require("../package.json");

const cliPath = path.join(__dirname, "..", "bin", "investoday-api.js");

function runCli(args, options = {}) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    encoding: "utf8",
    input: options.input,
    env: {
      ...process.env,
      ...options.env,
    },
  });
}

function withTempConfigDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "investoday-api-test-"));
  const previousConfigDir = process.env[CONFIG_DIR_ENV];
  const previousApiKey = process.env[API_KEY_ENV];
  const previousSubApiKey = process.env[SUB_API_KEY_ENV];

  process.env[CONFIG_DIR_ENV] = dir;
  delete process.env[API_KEY_ENV];
  delete process.env[SUB_API_KEY_ENV];

  try {
    return fn(dir);
  } finally {
    if (previousConfigDir === undefined) {
      delete process.env[CONFIG_DIR_ENV];
    } else {
      process.env[CONFIG_DIR_ENV] = previousConfigDir;
    }

    if (previousApiKey === undefined) {
      delete process.env[API_KEY_ENV];
    } else {
      process.env[API_KEY_ENV] = previousApiKey;
    }
    if (previousSubApiKey === undefined) {
      delete process.env[SUB_API_KEY_ENV];
    } else {
      process.env[SUB_API_KEY_ENV] = previousSubApiKey;
    }
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

async function withTempConfigDirAsync(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "investoday-api-test-"));
  const previousConfigDir = process.env[CONFIG_DIR_ENV];
  const previousApiKey = process.env[API_KEY_ENV];
  const previousSubApiKey = process.env[SUB_API_KEY_ENV];

  process.env[CONFIG_DIR_ENV] = dir;
  delete process.env[API_KEY_ENV];
  delete process.env[SUB_API_KEY_ENV];

  try {
    return await fn(dir);
  } finally {
    if (previousConfigDir === undefined) {
      delete process.env[CONFIG_DIR_ENV];
    } else {
      process.env[CONFIG_DIR_ENV] = previousConfigDir;
    }

    if (previousApiKey === undefined) {
      delete process.env[API_KEY_ENV];
    } else {
      process.env[API_KEY_ENV] = previousApiKey;
    }
    if (previousSubApiKey === undefined) {
      delete process.env[SUB_API_KEY_ENV];
    } else {
      process.env[SUB_API_KEY_ENV] = previousSubApiKey;
    }
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function writeConfigFile(dir, config) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    getCredentialsPath({ [CONFIG_DIR_ENV]: dir }),
    `${JSON.stringify(config, null, 2)}\n`
  );
}

test("--help prints usage", () => {
  const result = runCli(["--help"]);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /用法:/);
  assert.match(result.stdout, /investoday-api init/);
  assert.match(result.stdout, /investoday-api config status/);
  assert.match(result.stdout, /investoday-api update run\|status\|enable\|disable\|register\|unregister/);
  assert.match(result.stdout, /investoday-api list/);
  assert.match(result.stdout, /investoday-api list 沪深京数据\/公司行为\/基本信息/);
  assert.match(result.stdout, /investoday-api search-api query=股票,基本面分析/);
  assert.match(result.stdout, /investoday-api search-api tool_ids=list_stock_violation_penalt,list_stock_report_schema/);
  assert.match(result.stdout, /investoday-api search key=贵州茅台 type=11/);
  assert.match(result.stdout, /investoday-api fund\/daily-quotes --method POST fundCode=000001/);
  assert.doesNotMatch(result.stdout, /schema stock\/basic-info/);
  assert.doesNotMatch(result.stdout, /example stock\/violation-penalties/);
});

test("--version prints package version", () => {
  const result = runCli(["--version"]);
  const shortResult = runCli(["-v"]);

  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), version);
  assert.equal(shortResult.status, 0);
  assert.equal(shortResult.stdout.trim(), version);
});

test("credentials are saved in local JSON config", () => {
  withTempConfigDir((dir) => {
    saveCredentials("test-api-key", { [CONFIG_DIR_ENV]: dir }, "test-sub-api-key");

    const credentialsPath = getCredentialsPath({ [CONFIG_DIR_ENV]: dir });
    assert.ok(fs.existsSync(credentialsPath));
    assert.match(credentialsPath, /investoday-api\.config\.json$/);
    const rawConfig = fs.readFileSync(credentialsPath, "utf8");
    assert.match(rawConfig, /test-api-key/);
    assert.match(rawConfig, /test-sub-api-key/);

    const credentials = readCredentials({ [CONFIG_DIR_ENV]: dir });
    assert.equal(credentials.apiKey, "test-api-key");
    assert.equal(credentials.subscriptionApiKey, "test-sub-api-key");
  });
});

test("subscription credentials can be skipped", () => {
  withTempConfigDir((dir) => {
    saveCredentials("test-api-key", { [CONFIG_DIR_ENV]: dir }, "");

    const credentials = readCredentials({ [CONFIG_DIR_ENV]: dir });
    assert.equal(credentials.apiKey, "test-api-key");
    assert.equal(credentials.subscriptionApiKey, undefined);
  });
});

test("skipping subscription credentials preserves an existing subscription key", () => {
  withTempConfigDir((dir) => {
    saveCredentials("old-resource-key", { [CONFIG_DIR_ENV]: dir }, "existing-sub-key");
    saveCredentials("new-resource-key", { [CONFIG_DIR_ENV]: dir }, "");

    const credentials = readCredentials({ [CONFIG_DIR_ENV]: dir });
    assert.equal(credentials.apiKey, "new-resource-key");
    assert.equal(credentials.subscriptionApiKey, "existing-sub-key");
  });
});

test("saving only resource credentials preserves existing subscription key for compatibility", () => {
  withTempConfigDir((dir) => {
    saveCredentials("old-resource-key", { [CONFIG_DIR_ENV]: dir }, "existing-sub-key");
    saveCredentials("new-resource-key", { [CONFIG_DIR_ENV]: dir });

    const credentials = readCredentials({ [CONFIG_DIR_ENV]: dir });
    assert.equal(credentials.apiKey, "new-resource-key");
    assert.equal(credentials.subscriptionApiKey, "existing-sub-key");
  });
});

test("saving credentials removes legacy encrypted credential files", () => {
  withTempConfigDir((dir) => {
    const legacyCredentialsPath = getLegacyCredentialsPath({ [CONFIG_DIR_ENV]: dir });
    const legacyKeyPath = getLegacyKeyPath({ [CONFIG_DIR_ENV]: dir });
    fs.writeFileSync(legacyCredentialsPath, "legacy");
    fs.writeFileSync(legacyKeyPath, "legacy-key");

    saveCredentials("test-api-key", { [CONFIG_DIR_ENV]: dir });

    assert.equal(fs.existsSync(legacyCredentialsPath), false);
    assert.equal(fs.existsSync(legacyKeyPath), false);
  });
});

test("local config is used as fallback after environment variable", () => {
  withTempConfigDir((dir) => {
    saveCredentials("local-key", { [CONFIG_DIR_ENV]: dir }, "local-sub-key");

    assert.deepEqual(resolveApiKey({ [CONFIG_DIR_ENV]: dir }), {
      apiKey: "local-key",
      source: "config",
    });
    assert.deepEqual(resolveApiKey({
      [CONFIG_DIR_ENV]: dir,
      [API_KEY_ENV]: "env-key",
    }), {
      apiKey: "env-key",
      source: "compat",
    });
    assert.deepEqual(resolveSubscriptionApiKey({ [CONFIG_DIR_ENV]: dir }), {
      apiKey: "local-sub-key",
      source: "config",
    });
    assert.deepEqual(resolveSubscriptionApiKey({
      [CONFIG_DIR_ENV]: dir,
      [SUB_API_KEY_ENV]: "env-sub-key",
    }), {
      apiKey: "env-sub-key",
      source: "compat",
    });
  });
});

test("config status, path, and remove are available", () => {
  withTempConfigDir((dir) => {
    saveCredentials("local-key", { [CONFIG_DIR_ENV]: dir }, "local-sub-key");

    const statusResult = runCli(["config", "status"], {
      env: {
        [CONFIG_DIR_ENV]: dir,
        [API_KEY_ENV]: "",
        [SUB_API_KEY_ENV]: "",
      },
    });
    assert.equal(statusResult.status, 0);
    const payload = JSON.parse(statusResult.stdout);
    assert.equal(payload.status, "configured");
    assert.equal(payload.localConfig, "configured");
    assert.equal(payload.activeSource, "config");
    assert.deepEqual(payload.apiKeys.resource, {
      configured: true,
      source: "config",
      localConfig: "configured",
    });
    assert.deepEqual(payload.apiKeys.subscription, {
      configured: true,
      source: "config",
      localConfig: "configured",
    });
    assert.doesNotMatch(statusResult.stdout, /local-key/);
    assert.doesNotMatch(statusResult.stdout, /local-sub-key/);
    assert.match(payload.configFile, /investoday-api\.config\.json$/);

    const pathResult = runCli(["config", "path"], {
      env: { [CONFIG_DIR_ENV]: dir },
    });
    assert.equal(pathResult.status, 0);
    assert.equal(pathResult.stdout.trim(), getCredentialsPath({ [CONFIG_DIR_ENV]: dir }));

    const removeResult = runCli(["config", "remove"], {
      env: { [CONFIG_DIR_ENV]: dir },
    });
    assert.equal(removeResult.status, 0);
    assert.equal(readCredentials({ [CONFIG_DIR_ENV]: dir }), null);
    removeCredentials({ [CONFIG_DIR_ENV]: dir });
  });
});

test("config status shows subscription environment variable without leaking keys", () => {
  withTempConfigDir((dir) => {
    saveCredentials("local-key", { [CONFIG_DIR_ENV]: dir });

    const statusResult = runCli(["config", "status"], {
      env: {
        [CONFIG_DIR_ENV]: dir,
        [API_KEY_ENV]: "",
        [SUB_API_KEY_ENV]: "env-sub-key",
      },
    });

    assert.equal(statusResult.status, 0);
    const payload = JSON.parse(statusResult.stdout);
    assert.deepEqual(payload.apiKeys.resource, {
      configured: true,
      source: "config",
      localConfig: "configured",
    });
    assert.deepEqual(payload.apiKeys.subscription, {
      configured: true,
      source: "compat",
      localConfig: "missing",
    });
    assert.doesNotMatch(statusResult.stdout, /local-key/);
    assert.doesNotMatch(statusResult.stdout, /env-sub-key/);
  });
});

test("init verification uses the trade calendar API without exposing the key", async () => {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      json: async () => ({ code: 0, message: "success" }),
    };
  };

  try {
    const result = await verifyApiKey("secret-key");
    assert.equal(result.ok, true);
  } finally {
    global.fetch = originalFetch;
  }

  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/trade-calender\/cn\/is-trade-date\?tDate=2025-12-22$/);
  assert.equal(calls[0].options.method, "GET");
  assert.equal(calls[0].options.headers.apiKey, "secret-key");
  assert.equal(calls[0].options.body, undefined);
});

test("verifyApiKey returns structured API error message", async () => {
  await withTempConfigDir(async (dir) => {
    const originalFetch = global.fetch;
    global.fetch = async () => ({
      ok: true,
      json: async () => ({ code: 40001, message: "invalid api key" }),
    });

    try {
      const result = await verifyApiKey("bad-key");
      assert.deepEqual(result, {
        ok: false,
        errorType: "invalid_api_key",
        serverConnected: true,
        message: "invalid api key",
      });
    } finally {
      global.fetch = originalFetch;
    }

    assert.equal(readCredentials({ [CONFIG_DIR_ENV]: dir }), null);
  });
});

test("init requires an interactive terminal", () => {
  withTempConfigDir((dir) => {
    const result = runCli(["init"], {
      env: {
        [CONFIG_DIR_ENV]: dir,
        [API_KEY_ENV]: "",
      },
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /当前环境不支持交互式输入/);
    assert.equal(readCredentials({ [CONFIG_DIR_ENV]: dir }), null);
  });
});

test("list prints top-level groups", () => {
  const result = runCli(["list"]);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Top-level groups:/);
  assert.match(result.stdout, /沪深京数据/);
});

test("list supports multi-level group paths", () => {
  const result = runCli(["list", "沪深京数据/公司行为/基本信息"]);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /沪深京数据 \/ 公司行为 \/ 基本信息:/);
  assert.match(result.stdout, /上市公司违规处罚 \| stock\/violation-penalties \| POST/);
});

test("list fuzzy matching includes description text", () => {
  const result = runCli(["list", "合规风险"]);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Matches for '合规风险':/);
  assert.match(result.stdout, /上市公司违规处罚 \| stock\/violation-penalties \| POST/);
  assert.match(result.stdout, /desc:/);
});

test("list fuzzy matching ranks exact endpoint names ahead of description-only hits", () => {
  const result = runCli(["list", "基本面分析"]);

  assert.equal(result.status, 0);
  const lines = result.stdout.trim().split("\n");
  assert.match(lines[1], /股票基本面分析 \| stock\/fundamentals \| POST/);
});

test("list shows matching groups when subgroup names are ambiguous", () => {
  const result = runCli(["list", "实时行情"]);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Matching groups for '实时行情':/);
  assert.match(result.stdout, /沪深京数据 \/ 股票行情 \/ 实时行情/);
  assert.match(result.stdout, /基金 \/ 基金行情 \/ 实时行情/);
});

test("search-api finds endpoints and includes request and response summaries", () => {
  const result = runCli(["search-api", "query=违规处罚"]);

  assert.equal(result.status, 0);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.query, "违规处罚");
  assert.deepEqual(payload.toolIds, []);
  assert.match(payload.matches[0].path, /stock\/violation-penalties/);
  assert.match(payload.matches[0].reference, /references\/沪深京数据\/公司行为\/基本信息\.md/);
  assert.equal(payload.matches[0].toolName, undefined);
  assert.equal(payload.matches[0].summary, undefined);
  assert.equal(payload.matches[0].groupPath, undefined);
  assert.ok(Array.isArray(payload.matches[0].requestParams));
  assert.ok(Array.isArray(payload.matches[0].responseFields));
  assert.ok(Array.isArray(payload.matches[0].apiKeySupported));
  assert.match(payload.matches[0].exampleCommand, /investoday-api stock\/violation-penalties --method POST/);
  assert.match(payload.matches[0].exampleCommand, /--body-json/);
});

test("search-api supports tool_ids filtering with repeated values", () => {
  const result = runCli([
    "search-api",
    "tool_ids=list_stock_violation_penalt",
    "tool_ids=list_stock_report_schema",
  ]);

  assert.equal(result.status, 0);
  const payload = JSON.parse(result.stdout);
  assert.deepEqual(payload.toolIds, [
    "list_stock_violation_penalt",
    "list_stock_report_schema",
  ]);
  assert.equal(payload.matches.length, 2);
  assert.equal(payload.matches[0].toolId, "list_stock_violation_penalt");
  assert.equal(payload.matches[1].toolId, "list_stock_report_schema");
});

test("search-api supports query and tool_ids together", () => {
  const result = runCli([
    "search-api",
    "query=违规处罚",
    "tool_ids=list_stock_violation_penalt,list_stock_report_schema",
  ]);

  assert.equal(result.status, 0);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.query, "违规处罚");
  assert.deepEqual(payload.toolIds, [
    "list_stock_violation_penalt",
    "list_stock_report_schema",
  ]);
  assert.equal(payload.matches.length, 1);
  assert.equal(payload.matches[0].toolId, "list_stock_violation_penalt");
});

test("search-api supports multiple query keywords", () => {
  const result = runCli([
    "search-api",
    "query=股票,基本面分析",
  ]);

  assert.equal(result.status, 0);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.query, "股票 基本面分析");
  assert.match(payload.matches[0].path, /stock\/fundamentals/);
});

test("search-api requires all query keywords to match", () => {
  const result = runCli([
    "search-api",
    "query=股票,技术",
  ]);

  assert.equal(result.status, 0);
  const payload = JSON.parse(result.stdout);
  assert.ok(payload.matches.length > 0);
  assert.ok(
    payload.matches.every((match) => {
      const haystack = [
        match.apiName,
        match.path,
        match.toolId,
        match.description,
        ...match.requestParams.map((item) => `${item.name} ${item.desc}`),
        ...match.responseFields.map((item) => `${item.name} ${item.desc}`),
      ].join(" ");
      return haystack.includes("股票") && haystack.includes("技术");
    })
  );
});

test("search-api rejects repeated query arguments", () => {
  const result = runCli([
    "search-api",
    "query=股票",
    "query=基本面分析",
  ]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /只允许一个 query=/);
});

test("search-api --text prints a human-readable summary", () => {
  const result = runCli(["search-api", "query=违规处罚", "--text"]);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Matches for query='违规处罚':/);
  assert.match(result.stdout, /desc:/);
  assert.match(result.stdout, /request params:/);
  assert.match(result.stdout, /response fields:/);
  assert.match(result.stdout, /example: investoday-api stock\/violation-penalties --method POST/);
  assert.match(result.stdout, /--body-json/);
});

test("search-api rejects positional query input", () => {
  const result = runCli(["search-api", "违规处罚"]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /只接受结构化入参/);
});

test("deprecated schema and example commands return a migration hint", () => {
  const schemaResult = runCli(["schema", "stock/basic-info"]);
  const exampleResult = runCli(["example", "stock/basic-info"]);

  assert.equal(schemaResult.status, 1);
  assert.match(schemaResult.stderr, /已移除/);
  assert.match(schemaResult.stderr, /search-api/);
  assert.equal(exampleResult.status, 1);
  assert.match(exampleResult.stderr, /已移除/);
});

test("parseArgs supports explicit JSON body for POST requests", () => {
  const parsed = parseArgs([
    "industry-quote/realtime-v2",
    "--method",
    "POST",
    "industryLevel=1",
    "sortColumn=changeRatio",
    "--body-json",
    '{"industryCodes":[]}',
  ]);

  assert.equal(parsed.apiPath, "industry-quote/realtime-v2");
  assert.equal(parsed.method, "POST");
  assert.deepEqual(parsed.params, {
    industryLevel: "1",
    sortColumn: "changeRatio",
  });
  assert.deepEqual(parsed.bodyJson, {
    industryCodes: [],
  });
});

test("splitPostParams separates OpenAPI query params from JSON body params", () => {
  const endpoint = {
    parameters: [
      { name: "industryLevel", in: "query", type: "integer" },
      { name: "sortColumn", in: "query", type: "string" },
      { name: "industryCodes", in: "body", type: "array" },
    ],
  };

  const result = splitPostParams({
    industryLevel: "1",
    sortColumn: "changeRatio",
    industryCodes: "[]",
  }, endpoint);

  assert.deepEqual(result.queryParams, {
    industryLevel: "1",
    sortColumn: "changeRatio",
  });
  assert.deepEqual(result.bodyParams, {
    industryCodes: [],
  });
});

test("direct execution defaults to the canonical POST method for duplicated paths", () => {
  assert.equal(selectRequestMethod("stock/str-trend-ind", "GET", false), "POST");
  assert.equal(selectRequestMethod("stock/str-trend-ind", "GET", true), "GET");
});

test("metadata exposes x-apikey-supported from OpenAPI path items", () => {
  const openapi = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "data", "openapi.json"), "utf8")
  );
  const [openapiPath, pathItem] = Object.entries(openapi.paths || {}).find(([, value]) =>
    Array.isArray(value?.["x-apikey-supported"])
  ) || [];
  assert.ok(openapiPath);

  const normalizedPath = openapiPath.replace(/^\/+/, "");
  const { pathMap, records } = getMetadata();
  const detail = pathMap[normalizedPath];
  const record = records.find((item) => item.path === normalizedPath);

  assert.ok(detail);
  assert.deepEqual(detail.apiKeySupported, pathItem["x-apikey-supported"]);
  if (record) {
    assert.deepEqual(record.apiKeySupported, pathItem["x-apikey-supported"]);
  }
});

test("endpoint API key routing only uses subscription key for subscription-only APIs", () => {
  const previousResourceKey = process.env[API_KEY_ENV];
  const previousSubscriptionKey = process.env[SUB_API_KEY_ENV];

  process.env[API_KEY_ENV] = "resource-key";
  process.env[SUB_API_KEY_ENV] = "subscription-key";

  try {
    assert.equal(shouldUseSubscriptionApiKey(["subscription"]), true);
    assert.equal(shouldUseSubscriptionApiKey(["subscription", "resource"]), false);
    assert.equal(shouldUseSubscriptionApiKey(["resource"]), false);
    assert.equal(shouldUseSubscriptionApiKey([]), false);
    assert.equal(resolveEndpointApiKey({ apiKeySupported: ["subscription"] }), "subscription-key");
    assert.equal(resolveEndpointApiKey({ apiKeySupported: ["subscription", "resource"] }), "resource-key");
    assert.equal(resolveEndpointApiKey({}), "resource-key");
  } finally {
    if (previousResourceKey === undefined) {
      delete process.env[API_KEY_ENV];
    } else {
      process.env[API_KEY_ENV] = previousResourceKey;
    }
    if (previousSubscriptionKey === undefined) {
      delete process.env[SUB_API_KEY_ENV];
    } else {
      process.env[SUB_API_KEY_ENV] = previousSubscriptionKey;
    }
  }
});

test("direct endpoint calls select subscription key from endpoint metadata", async () => {
  await withTempConfigDirAsync(async (dir) => {
    const { records } = getMetadata();
    const subscriptionOnlyEndpoint = records.find((record) =>
      shouldUseSubscriptionApiKey(record.apiKeySupported)
    );
    assert.ok(subscriptionOnlyEndpoint);

    const previousResourceKey = process.env[API_KEY_ENV];
    const previousSubscriptionKey = process.env[SUB_API_KEY_ENV];
    const originalFetch = global.fetch;
    const originalStdoutWrite = process.stdout.write;
    const calls = [];

    process.env[API_KEY_ENV] = "resource-key";
    process.env[SUB_API_KEY_ENV] = "subscription-key";
    process.stdout.write = () => true;
    global.fetch = async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        json: async () => ({ code: 0, data: { ok: true } }),
      };
    };

    try {
      await main([subscriptionOnlyEndpoint.path]);
    } finally {
      global.fetch = originalFetch;
      process.stdout.write = originalStdoutWrite;
      if (previousResourceKey === undefined) {
        delete process.env[API_KEY_ENV];
      } else {
        process.env[API_KEY_ENV] = previousResourceKey;
      }
      if (previousSubscriptionKey === undefined) {
        delete process.env[SUB_API_KEY_ENV];
      } else {
        process.env[SUB_API_KEY_ENV] = previousSubscriptionKey;
      }
    }

    assert.equal(calls.length, 1);
    assert.equal(calls[0].options.headers.apiKey, "subscription-key");
    assert.match(calls[0].url, new RegExp(`/${subscriptionOnlyEndpoint.path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
    assert.equal(readCredentials({ [CONFIG_DIR_ENV]: dir }), null);
  });
});

test("update manifest URL uses default and environment override", () => {
  assert.equal(
    getManifestUrl({}),
    "https://storage.txyun.investoday.net/application/skill-store/configs/investoday-api.manifest.json"
  );
  assert.equal(DEFAULT_MANIFEST_URL, getManifestUrl({}));
  assert.equal(
    getManifestUrl({ [UPDATE_MANIFEST_URL_ENV]: "https://example.com/manifest.json" }),
    "https://example.com/manifest.json"
  );
});

test("update version comparison supports semantic version ordering", () => {
  assert.equal(compareVersions("1.8.15", "1.8.14"), 1);
  assert.equal(compareVersions("1.8.14", "1.8.15"), -1);
  assert.equal(compareVersions("1.8.15", "1.8.15"), 0);
});

test("scheduler parses the default daily cron", () => {
  assert.deepEqual(parseDailyCron("0 3 * * *"), {
    minute: 0,
    hour: 3,
    expression: "0 3 * * *",
  });
  assert.throws(() => parseDailyCron("@daily"), /5-field/);
});

test("update run requires explicit auto update authorization", async () => {
  await withTempConfigDirAsync(async (dir) => {
    const originalFetch = global.fetch;
    global.fetch = async () => {
      throw new Error("fetch should not be called without authorization");
    };
    try {
      const result = await runUpdate({ [CONFIG_DIR_ENV]: dir });
      assert.equal(result.ok, true);
      assert.equal(result.skipped, true);
      assert.equal(result.reason, "auto update disabled");
    } finally {
      global.fetch = originalFetch;
    }
  });
});

test("update status does not mark missing config as enabled", async () => {
  await withTempConfigDirAsync(async (dir) => {
    const originalFetch = global.fetch;
    global.fetch = async () => {
      throw new Error("manifest unavailable");
    };
    try {
      const status = await getStatus({ [CONFIG_DIR_ENV]: dir });
      assert.equal(status.enabled, false);
      assert.equal(status.remoteAvailable, false);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

test("update run replaces symlink target directory and preserves client symlink", { skip: process.platform === "win32" }, async () => {
  await withTempConfigDirAsync(async (configDir) => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "investoday-api-symlink-test-"));
    const previousHome = process.env.HOME;
    const originalFetch = global.fetch;
    try {
      const homeDir = path.join(tempDir, "home");
      const realSkillDir = path.join(tempDir, "skills-manager", "skills", "investoday-finance-data");
      const clientSkillsRoot = path.join(homeDir, ".workbuddy", "skills");
      const clientSkillLink = path.join(clientSkillsRoot, "investoday-finance-data");
      const zipSourceRoot = path.join(tempDir, "zip-source");
      const zipSkillDir = path.join(zipSourceRoot, "investoday-finance-data");
      const zipPath = path.join(tempDir, "investoday-finance-data.zip");

      fs.mkdirSync(realSkillDir, { recursive: true });
      fs.mkdirSync(clientSkillsRoot, { recursive: true });
      fs.mkdirSync(zipSkillDir, { recursive: true });
      fs.writeFileSync(path.join(realSkillDir, "SKILL.md"), "---\nname: investoday-finance-data\nversion: 1.0.0\n---\nold\n");
      fs.symlinkSync(realSkillDir, clientSkillLink, "dir");
      fs.writeFileSync(path.join(zipSkillDir, "SKILL.md"), "---\nname: investoday-finance-data\nversion: 2.0.0\n---\nupdated\n");

      const zipResult = spawnSync("zip", ["-qr", zipPath, "investoday-finance-data"], {
        cwd: zipSourceRoot,
        encoding: "utf8",
      });
      assert.equal(zipResult.status, 0, zipResult.stderr || zipResult.stdout);
      const zipBuffer = fs.readFileSync(zipPath);
      const zipSha256 = crypto.createHash("sha256").update(zipBuffer).digest("hex");
      const manifest = {
        schemaVersion: 1,
        generatedAt: "2026-05-27T08:00:00+08:00",
        updatePolicy: {
          skillInstallPolicy: "existing-only",
          local_task_cron: "0 3 * * *",
        },
        nodePackage: {
          name: "@investoday/investoday-api",
          version: "0.0.0",
          packageManager: "npm",
        },
        skills: [
          {
            name: "investoday-finance-data",
            version: "2.0.0",
            zipUrl: "https://example.com/investoday-finance-data.zip",
            sha256: zipSha256,
          },
        ],
        clients: [
          {
            id: "workbuddy",
            name: "WorkBuddy",
            targets: [
              {
                type: "fixed",
                paths: ["$HOME/.workbuddy/skills"],
              },
            ],
          },
        ],
      };

      writeConfigFile(configDir, {
        INVESTODAY_API_KEY: "test-key",
        autoUpdate: {
          enabled: true,
          local_task_cron: "0 3 * * *",
          lastRunAt: null,
          lastSuccessAt: null,
          lastError: null,
        },
      });

      process.env.HOME = homeDir;
      global.fetch = async (url) => {
        if (String(url).endsWith("manifest.json")) {
          return {
            ok: true,
            json: async () => manifest,
          };
        }
        if (String(url).endsWith("investoday-finance-data.zip")) {
          return {
            ok: true,
            arrayBuffer: async () => zipBuffer.buffer.slice(zipBuffer.byteOffset, zipBuffer.byteOffset + zipBuffer.byteLength),
          };
        }
        throw new Error(`unexpected fetch URL: ${url}`);
      };

      const result = await runUpdate({
        [CONFIG_DIR_ENV]: configDir,
        [UPDATE_MANIFEST_URL_ENV]: "https://example.com/manifest.json",
      });
      const resolvedRealSkillDir = fs.realpathSync(realSkillDir);

      assert.equal(result.ok, true);
      assert.equal(fs.lstatSync(clientSkillLink).isSymbolicLink(), true);
      assert.equal(fs.realpathSync(clientSkillLink), resolvedRealSkillDir);
      assert.match(fs.readFileSync(path.join(realSkillDir, "SKILL.md"), "utf8"), /version: 2\.0\.0/);
      assert.match(fs.readFileSync(path.join(clientSkillLink, "SKILL.md"), "utf8"), /updated/);
      assert.equal(result.state.skills[0].displayPath, clientSkillLink);
      assert.equal(result.state.skills[0].actualPath, resolvedRealSkillDir);
      assert.equal(result.state.skills[0].isSymlink, true);
    } finally {
      global.fetch = originalFetch;
      if (previousHome === undefined) {
        delete process.env.HOME;
      } else {
        process.env.HOME = previousHome;
      }
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
