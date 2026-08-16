import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const serverLauncher = readFileSync(path.join(root, "scripts/run-server.cmd"), "utf8");
const dashboardLauncher = readFileSync(path.join(root, "scripts/run-dashboard.cmd"), "utf8");
const studioLauncher = readFileSync(path.join(root, "scripts/run-studio.cmd"), "utf8");
const roleLauncher = readFileSync(path.join(root, "scripts/bots/launch.ps1"), "utf8");
const localDashboardLauncher = readFileSync(path.join(root, "scripts/run-dashboard-runtime.mjs"), "utf8");

assert.equal(packageJson.scripts["start:server"], "scripts\\run-server.cmd start");
assert.equal(packageJson.scripts["dev:server"], "scripts\\run-server.cmd dev");
assert.equal(packageJson.scripts["start:dashboard"], "scripts\\run-dashboard.cmd start");
assert.equal(packageJson.scripts["start:studio"], "scripts\\run-studio.cmd start");
assert.equal(packageJson.scripts["dev:studio"], "scripts\\run-studio.cmd dev");
assert.equal(packageJson.scripts["build:worker"], "tsc -p tsconfig.worker.json");
assert.match(serverLauncher, /start-headless/);
assert.match(serverLauncher, /dev-headless/);
assert.match(dashboardLauncher, /-Role dashboard/);
assert.match(studioLauncher, /run-dashboard\.cmd/);
assert.match(studioLauncher, /HTTP\/API server and browser UI share one runtime process/);
assert.doesNotMatch(studioLauncher, /run-server\.cmd/);
assert.match(roleLauncher, /DASHBOARD_ENABLED = "false"/);
assert.match(serverLauncher, /-NoMessengerAutostart/);
assert.match(roleLauncher, /URAGE_DISABLE_MESSENGER_AUTOSTART = "true"/);
assert.doesNotMatch(roleLauncher, /DISCORD_RUNTIME_AUTOSTART = "false"/);
assert.match(roleLauncher, /build:dashboard:css:if-needed/);
assert.doesNotMatch(roleLauncher, /"dashboard:start" \{\s*Invoke-NpmScript -ScriptName "build:dashboard"/);
for (const workerMode of ["start", "dev"]) {
  const workerBlock = roleLauncher.match(new RegExp(`"worker:${workerMode}" \\{([\\s\\S]*?)\\n    \\}`))?.[1] || "";
  assert.ok(workerBlock, `Expected worker:${workerMode} launch block.`);
  assert.doesNotMatch(workerBlock, /build:dashboard:css/);
}
assert.match(localDashboardLauncher, /ensure-dashboard-css\.mjs/);
assert.doesNotMatch(localDashboardLauncher, /build:dashboard/);
assert.match(roleLauncher, /"worker:build" \{ Invoke-NpmScript -ScriptName "build:worker" \}/);

console.log("Runtime server and dashboard launch separation validation passed.");
