import assert from "node:assert/strict";
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
assert.match(runtime, /dashboardServer\.close\(\)/);
assert.match(runtime, /ComfyUI/);
assert.match(runtime, /runs in a separate process and can operate without the dashboard/);

console.log("Interactive runtime shutdown validation passed.");
