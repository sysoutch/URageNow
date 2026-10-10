import assert from "node:assert/strict";
import path from "node:path";
import { repoRoot, toolsRoot } from "@urage/server/config/repositoryPaths";
import { resolveContainedStaticFilePath } from "@urage/server/security/staticFilePath";

const validTool = resolveContainedStaticFilePath(toolsRoot, "shared/dashboard-theme.js");
assert.equal(validTool, path.join(toolsRoot, "shared", "dashboard-theme.js"));
assert.equal(resolveContainedStaticFilePath(toolsRoot, "../README.md"), null);
assert.equal(resolveContainedStaticFilePath(toolsRoot, "..\\README.md"), null);
assert.equal(resolveContainedStaticFilePath(repoRoot, ".env.public.example"), null);
assert.equal(resolveContainedStaticFilePath(toolsRoot, "missing-file.js"), null);

console.log("Static file containment checks passed.");
