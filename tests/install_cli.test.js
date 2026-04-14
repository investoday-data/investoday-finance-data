const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildUnixLauncher,
  buildWindowsLauncher,
  getDefaultBinDir,
} = require("../skills/scripts/install_cli.js");

test("install_cli builds a unix launcher for investoday-api", () => {
  const launcher = buildUnixLauncher("/tmp/investoday/call_api.js");
  assert.match(launcher, /investoday-api/);
  assert.match(launcher, /call_api\.js/);
  assert.match(launcher, /exec node/);
});

test("install_cli builds a windows launcher for investoday-api", () => {
  const launcher = buildWindowsLauncher("C:\\investoday\\call_api.js");
  assert.match(launcher, /call_api\.js/);
  assert.match(launcher, /%\\*/);
  assert.match(launcher, /node/);
});

test("install_cli computes a default bin dir for supported platforms", () => {
  assert.equal(
    getDefaultBinDir({ platform: "darwin", homeDir: "/Users/tester" }),
    "/Users/tester/.local/bin"
  );
  assert.equal(
    getDefaultBinDir({ platform: "linux", homeDir: "/home/tester" }),
    "/home/tester/.local/bin"
  );
  assert.equal(
    getDefaultBinDir({ platform: "win32", homeDir: "C:\\Users\\tester" }),
    "C:\\Users\\tester\\.local\\bin"
  );
});
