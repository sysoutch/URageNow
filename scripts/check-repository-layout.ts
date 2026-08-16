import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { repoRoot } from "@urage/shared/runtime/repositoryPaths";

const canonicalFiles = [
  path.join(repoRoot, "shared", "SOUL.md"),
  path.join(repoRoot, "shared", "USER.md"),
  path.join(repoRoot, "data")
];
const staleDiscordPaths = [
  path.join(repoRoot, "bots", "discord-bot", "SOUL.md"),
  path.join(repoRoot, "bots", "discord-bot", "USER.md"),
  path.join(repoRoot, "bots", "discord-bot", "data")
];

for (const canonicalPath of canonicalFiles) {
  assert.equal(existsSync(canonicalPath), true, `Missing canonical repository path: ${canonicalPath}`);
}
for (const stalePath of staleDiscordPaths) {
  assert.equal(existsSync(stalePath), false, `Stale Discord-owned repository path: ${stalePath}`);
}

console.log("Repository layout validation passed.");
