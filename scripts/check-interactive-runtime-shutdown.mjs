import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const prompt = readFileSync(path.join(root, "bots/discord-bot/src/runtime/interactiveShutdownPrompt.ts"), "utf8");
const runtime = readFileSync(path.join(root, "bots/discord-bot/src/index.ts"), "utf8");

assert.match(prompt, /process\.on\("SIGINT"/);
assert.match(prompt, /answer === "y" \|\| answer === "yes"/);
assert.match(prompt, /port remains open/);
assert.match(runtime, /installInteractiveShutdownPrompt/);
assert.match(runtime, /confirmOnSigint: !scopedBotDashboard && !appConfig\.dashboardUiEnabled/);
assert.match(runtime, /!scopedBotDashboard && await isComfyUiReachable\(\)/);
assert.match(runtime, /dashboardServer\.close\(\)/);
assert.match(runtime, /ComfyUI/);
assert.match(runtime, /runs in a separate process and can operate without the dashboard/);

function runShutdownScenario(stopBody, timeoutMs = 1000) {
  const source = `
    import { installInteractiveShutdownPrompt } from "./bots/discord-bot/src/runtime/interactiveShutdownPrompt.ts";
    installInteractiveShutdownPrompt({
      runtimeName: "Dashboard",
      confirmOnSigint: false,
      shutdownTimeoutMs: ${timeoutMs},
      getDependencies: async () => { throw new Error("dependency lookup should be skipped"); },
      stop: ${stopBody}
    });
    process.emit("SIGINT");
  `;
  return spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", source], {
    cwd: root,
    encoding: "utf8",
    timeout: 5000
  });
}

const completed = runShutdownScenario("async () => { process.stdout.write('Cleanup ran.\\n'); }");
assert.equal(completed.status, 0, completed.stderr);
assert.match(completed.stdout, /Dashboard shutdown requested/);
assert.match(completed.stdout, /Cleanup ran/);
assert.match(completed.stdout, /Dashboard stopped\. Exiting now/);
assert.doesNotMatch(completed.stdout, /Stop the dashboard\?/);

const timedOut = runShutdownScenario("() => new Promise(() => {})", 30);
assert.equal(timedOut.status, 1, timedOut.stderr);
assert.match(timedOut.stdout, /cleanup could not finish: shutdown exceeded 30 ms\. Exiting the process now/);

console.log("Interactive runtime shutdown validation passed.");
