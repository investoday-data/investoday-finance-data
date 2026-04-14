const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const scriptPath = path.join(__dirname, "..", "skills", "scripts", "call_api.js");

test("call_api requires INVESTODAY_API_KEY from environment only", () => {
  const result = spawnSync(process.execPath, [scriptPath, "stock/basic-info"], {
    env: {
      PATH: process.env.PATH || "",
      HOME: process.env.HOME || "",
    },
    encoding: "utf8",
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /INVESTODAY_API_KEY/);
  assert.doesNotMatch(result.stderr, /\.env/);
});
