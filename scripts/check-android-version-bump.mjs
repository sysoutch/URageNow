import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {readFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const bumpScript = readFileSync(path.join(root, "scripts", "bump-android-version.mjs"), "utf8");
const versionPath = path.join(root, "apps", "android-companion", "version.properties");
const versionBefore = readFileSync(versionPath, "utf8");

assert.equal(packageJson.scripts["version:android"], "node scripts/bump-android-version.mjs");
assert.match(bumpScript, /patch\|minor\|major\|prerelease/);
assert.match(bumpScript, /request === "feature"/);
assert.match(bumpScript, /VERSION_CODE/);
assert.match(bumpScript, /--dry-run/);
const output = execFileSync(process.execPath, ["scripts/bump-android-version.mjs", "patch", "--dry-run"], {cwd: root, encoding: "utf8"});
assert.match(output, /Android version: .*\[dry run\]/);
assert.equal(readFileSync(versionPath, "utf8"), versionBefore);

console.log("Android version bump validation passed.");
