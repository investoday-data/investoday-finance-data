#!/usr/bin/env node
/**
 * 今日投资数据市场 - 通用 API 调用脚本
 *
 * 大模型直接调用此脚本获取金融数据，无需编写任何代码。
 *
 * 用法：
 *   node scripts/call_api.js <接口路径> [参数名=参数值 ...] [--method GET|POST]
 *
 * 示例：
 *   # GET 接口（默认）
 *   node scripts/call_api.js stock/basic-info stockCode=600519
 *   node scripts/call_api.js stock/adjusted-quotes stockCode=600519 beginDate=2024-01-01 endDate=2024-12-31
 *   node scripts/call_api.js trade-calender/special-date
 *
 *   # POST 接口（参数以 JSON body 发送）
 *   node scripts/call_api.js fund/daily-quotes --method POST fundCode=000001 beginDate=2024-01-01
 *   node scripts/call_api.js entity-recognition --method POST
 *
 *   # array 类型参数：同一 key 重复传入，自动合并为列表
 *   node scripts/call_api.js index-quote/realtime --method POST indexCodes=000001 indexCodes=399006
 *
 * 凭证来源：
 *   1. 环境变量 INVESTODAY_API_KEY（优先）
 *   2. Skill 根目录 .env 中的 INVESTODAY_API_KEY
 *
 * 输出：
 *   JSON 格式的 data 字段内容，调用失败时输出错误信息并以非零退出码退出
 */

const fs   = require("fs");
const path = require("path");

// ─── 配置 ──────────────────────────────────────────────────────────────────────

const BASE_URL        = "https://data-api.investoday.net/data";
const REQUEST_TIMEOUT = 30_000; // ms
const SKILL_ENV_FILE  = path.resolve(__dirname, "..", ".env");

// ─── API Key 加载 ──────────────────────────────────────────────────────────────

function readEnvKey(envFile) {
  if (!fs.existsSync(envFile)) return null;
  const lines = fs.readFileSync(envFile, "utf-8").split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith("#") || !line.includes("=")) continue;
    const idx = line.indexOf("=");
    const k   = line.slice(0, idx).trim();
    const v   = line.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    if (k === "INVESTODAY_API_KEY" && v) return v;
  }
  return null;
}

function loadApiKey() {
  // 1. 环境变量
  const envKey = (process.env.INVESTODAY_API_KEY || "").trim();
  if (envKey) return envKey;

  // 2. Skill 根目录下的固定 .env 文件
  const fileKey = readEnvKey(SKILL_ENV_FILE);
  if (fileKey) return fileKey;

  process.stderr.write(
    "ERROR: 请先设置环境变量 INVESTODAY_API_KEY，或在 skill 根目录 .env 中配置同名键。"
  );
  process.exit(1);
}

// ─── 参数解析 ──────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  if (!argv.length) {
    process.stderr.write(
      "用法: node call_api.js <接口路径> [key=value ...] [--method GET|POST]\n" +
      "示例: node call_api.js stock/basic-info stockCode=600519\n"
    );
    process.exit(1);
  }

  const apiPath = argv[0].replace(/^\/+/, "");
  let method    = "GET";
  const params  = {};

  let i = 1;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg === "--method") {
      i++;
      if (i >= argv.length) {
        process.stderr.write("ERROR: --method 后需指定 GET 或 POST\n");
        process.exit(1);
      }
      method = argv[i].toUpperCase();
      if (method !== "GET" && method !== "POST") {
        process.stderr.write(`ERROR: 不支持的 HTTP 方法 '${method}'，仅支持 GET 或 POST\n`);
        process.exit(1);
      }
    } else if (!arg.includes("=")) {
      process.stderr.write(`ERROR: 参数格式错误 '${arg}'，应为 key=value\n`);
      process.exit(1);
    } else {
      const eqIdx = arg.indexOf("=");
      const k     = arg.slice(0, eqIdx);
      const v     = arg.slice(eqIdx + 1);
      if (!k) {
        process.stderr.write(`ERROR: 参数格式错误 '${arg}'，key 不能为空\n`);
        process.exit(1);
      }
      // 同一 key 出现多次 → 收集为 array（用于 array 类型参数）
      if (Object.prototype.hasOwnProperty.call(params, k)) {
        const existing = params[k];
        params[k] = Array.isArray(existing) ? [...existing, v] : [existing, v];
      } else {
        params[k] = v;
      }
    }
    i++;
  }

  return { apiPath, method, params };
}

// ─── API 调用 ──────────────────────────────────────────────────────────────────

async function callApi(apiPath, method, params, apiKey) {
  const headers = { apiKey };
  let url       = `${BASE_URL}/${apiPath}`;
  let fetchOpts = { method, headers, signal: AbortSignal.timeout(REQUEST_TIMEOUT) };

  if (method === "POST") {
    headers["Content-Type"] = "application/json";
    fetchOpts.body          = JSON.stringify(params);
  } else {
    const hasParams = Object.keys(params).length > 0;
    if (hasParams) {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) {
        if (Array.isArray(v)) {
          v.forEach((item) => qs.append(k, item));
        } else {
          qs.append(k, v);
        }
      }
      url += "?" + qs.toString();
    }
  }

  let resp;
  try {
    resp = await fetch(url, fetchOpts);
  } catch (err) {
    if (err.name === "TimeoutError" || err.name === "AbortError") {
      process.stderr.write(
        `ERROR: 请求超时（${REQUEST_TIMEOUT / 1000}s）: ${url}\n`
      );
    } else {
      // 脱敏：避免 API Key 泄露
      let msg = String(err.message || err);
      if (apiKey && msg.includes(apiKey)) msg = msg.replaceAll(apiKey, "***");
      process.stderr.write(`ERROR: 请求失败: ${msg}\n`);
    }
    process.exit(1);
  }

  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    process.stderr.write(`ERROR: HTTP ${resp.status}: ${url}\n${body.slice(0, 500)}\n`);
    process.exit(1);
  }

  let result;
  try {
    result = await resp.json();
  } catch {
    const body = await resp.text().catch(() => "");
    process.stderr.write(`ERROR: 响应不是合法 JSON\n${body.slice(0, 500)}\n`);
    process.exit(1);
  }

  const code = result.code;
  if (code !== 0) {
    const msg = result.message || "未知错误";
    process.stderr.write(`ERROR: API 返回错误 [${code}]: ${msg}\n`);
    process.exit(1);
  }

  const data = result.data;
  if (data === undefined || data === null) {
    process.stderr.write("ERROR: API 响应中无 data 字段\n");
    process.exit(1);
  }

  // 只输出 data 字段，方便大模型直接消费
  process.stdout.write(JSON.stringify(data, null, 2) + "\n");
}

// ─── 入口 ──────────────────────────────────────────────────────────────────────

(async () => {
  const { apiPath, method, params } = parseArgs(process.argv.slice(2));
  const apiKey                      = loadApiKey();
  await callApi(apiPath, method, params, apiKey);
})();
