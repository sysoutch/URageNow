import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stylesheetPath = path.join(repoRoot, "dashboard", "src", "styles", "shared", "_messenger-studio-theme-contract.scss");
const source = readFileSync(stylesheetPath, "utf8");

assert.match(source, /\.view-messaging-active/);
assert.match(source, /--panel: var\(--studio-panel-bg\)/);
assert.match(source, /\.messenger-dashboard-header-card/);
assert.match(source, /\.chat-composer-card/);
assert.match(source, /Messenger brands may still colour their own identity\/status indicators/);

console.log("Messenger Studio theme contract checks passed.");
