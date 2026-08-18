import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readSource = relativePath => readFile(path.join(repoRoot, relativePath), "utf8");
const [viewSource, viewportSource, actionSource, eventBindingSource] = await Promise.all([
  readSource("dashboard/src/pageSections/aiView.ts"),
  readSource("dashboard/src/client/modules/dashboard/3d/viewportControlHelpers.js"),
  readSource("dashboard/src/client/modules/dashboard/3d/studioActionHelpers.js"),
  readSource("dashboard/src/client/modules/dashboard/3d/studioEventBindingHelpers.js")
]);

assert.match(viewSource, /id="model3d-llm-real-height-button"[^>]*data-model3d-llm-real-height-action/);
assert.match(viewSource, /Ask LLM For Real-Life Height/);
assert.equal((viewSource.match(/data-model3d-llm-real-height-action/g) || []).length, 3);
assert.match(viewportSource, /\+ "\[data-model3d-llm-real-height-action\],"/);
assert.match(viewportSource, /getAttribute\("data-model3d-llm-real-height-action"\)/);
assert.match(viewportSource, /await runModel3dLlmScaleForSelectedModel\(\)/);
assert.match(actionSource, /async function runModel3dLlmScaleForSelectedModel\(\)[\s\S]*request\("\/api\/model3d-edit",[\s\S]*dimensionMode: "llm"/);
assert.doesNotMatch(eventBindingSource, /getElementById\("model3d-three-scale-llm-button"\)/);

console.log("3D LLM real-life height quick action validation passed.");
