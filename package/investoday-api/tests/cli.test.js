const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { selectRequestMethod, verifyApiKey } = require("../lib/call-api");
const {
  API_KEY_ENV,
  CONFIG_DIR_ENV,
  getCredentialsPath,
  readCredentials,
  removeCredentials,
  resolveApiKey,
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

  process.env[CONFIG_DIR_ENV] = dir;
  delete process.env[API_KEY_ENV];

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
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("--help prints usage", () => {
  const result = runCli(["--help"]);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage:/);
  assert.match(result.stdout, /investoday-api init/);
  assert.match(result.stdout, /investoday-api config status/);
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

test("credentials are saved encrypted in local config", () => {
  withTempConfigDir((dir) => {
    saveCredentials("test-api-key", { [CONFIG_DIR_ENV]: dir });

    const credentialsPath = getCredentialsPath({ [CONFIG_DIR_ENV]: dir });
    assert.ok(fs.existsSync(credentialsPath));
    assert.doesNotMatch(fs.readFileSync(credentialsPath, "utf8"), /test-api-key/);

    const credentials = readCredentials({ [CONFIG_DIR_ENV]: dir });
    assert.equal(credentials.apiKey, "test-api-key");
  });
});

test("local config is used as fallback after environment variable", () => {
  withTempConfigDir((dir) => {
    saveCredentials("local-key", { [CONFIG_DIR_ENV]: dir });

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
  });
});

test("config status, path, and remove are available", () => {
  withTempConfigDir((dir) => {
    saveCredentials("local-key", { [CONFIG_DIR_ENV]: dir });

    const statusResult = runCli(["config", "status"], {
      env: {
        [CONFIG_DIR_ENV]: dir,
        [API_KEY_ENV]: "",
      },
    });
    assert.equal(statusResult.status, 0);
    const payload = JSON.parse(statusResult.stdout);
    assert.equal(payload.status, "configured");
    assert.equal(payload.localConfig, "configured");
    assert.equal(payload.activeSource, "config");

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
    await verifyApiKey("secret-key");
  } finally {
    global.fetch = originalFetch;
  }

  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/trade-calender\/cn\/is-trade-date\?tDate=2025-12-22$/);
  assert.equal(calls[0].options.method, "GET");
  assert.equal(calls[0].options.headers.apiKey, "secret-key");
  assert.equal(calls[0].options.body, undefined);
});

test("verifyApiKey propagates the API error message", async () => {
  await withTempConfigDir(async (dir) => {
    const originalFetch = global.fetch;
    global.fetch = async () => ({
      ok: true,
      json: async () => ({ code: 40001, message: "invalid api key" }),
    });

    try {
      await assert.rejects(() => verifyApiKey("bad-key"), /invalid api key/);
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
    assert.match(result.stderr, /Interactive input is unavailable/);
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
  assert.match(payload.matches[0].exampleCommand, /investoday-api stock\/violation-penalties --method POST stockCode=/);
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
  assert.match(result.stderr, /only accepts one query=/);
});

test("search-api --text prints a human-readable summary", () => {
  const result = runCli(["search-api", "query=违规处罚", "--text"]);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Matches for query='违规处罚':/);
  assert.match(result.stdout, /desc:/);
  assert.match(result.stdout, /request params:/);
  assert.match(result.stdout, /response fields:/);
  assert.match(result.stdout, /example: investoday-api stock\/violation-penalties --method POST stockCode=/);
});

test("search-api rejects positional query input", () => {
  const result = runCli(["search-api", "违规处罚"]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /only accepts structured inputs/);
});

test("deprecated schema and example commands return a migration hint", () => {
  const schemaResult = runCli(["schema", "stock/basic-info"]);
  const exampleResult = runCli(["example", "stock/basic-info"]);

  assert.equal(schemaResult.status, 1);
  assert.match(schemaResult.stderr, /were removed/);
  assert.match(schemaResult.stderr, /search-api/);
  assert.equal(exampleResult.status, 1);
  assert.match(exampleResult.stderr, /were removed/);
});

test("direct execution defaults to the canonical POST method for duplicated paths", () => {
  assert.equal(selectRequestMethod("stock/str-trend-ind", "GET", false), "POST");
  assert.equal(selectRequestMethod("stock/str-trend-ind", "GET", true), "GET");
});
