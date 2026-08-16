import assert from "node:assert/strict";
import path from "node:path";
import { repoRoot, dataRoot, toolsRoot, dashboardChatSkillsRoot, resolveRepoPath } from "@urage/server/config/repositoryPaths";

const initialCwd = process.cwd();
const expectedRoot = path.resolve(import.meta.dirname, "..");

assert.equal(repoRoot, expectedRoot);
assert.equal(dataRoot, path.join(expectedRoot, "data"));
assert.equal(toolsRoot, path.join(expectedRoot, "tools"));
assert.equal(dashboardChatSkillsRoot, path.join(expectedRoot, "dashboard", "chat-skills"));
assert.equal(resolveRepoPath("shared", "SOUL.md"), path.join(expectedRoot, "shared", "SOUL.md"));

process.chdir(path.parse(initialCwd).root);
try {
  assert.equal(repoRoot, expectedRoot);
  assert.equal(resolveRepoPath("data"), path.join(expectedRoot, "data"));
} finally {
  process.chdir(initialCwd);
}

console.log("Repository path validation passed.");
