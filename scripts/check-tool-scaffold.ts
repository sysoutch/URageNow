import assert from "node:assert/strict";
import {
  auditToolScaffoldFiles,
  buildToolScaffoldImplementationPrompt,
  buildToolScaffoldPlanningPrompt,
  getToolScaffoldInputIssues,
  normalizeToolScaffoldSpec,
  parseToolScaffoldPlan,
  parseToolScaffoldImplementation,
  renderToolScaffoldFiles
} from "../dashboard/src/server/resourceHub/toolScaffoldManager.js";

const manual = normalizeToolScaffoldSpec({
  category: "../DEV Tools",
  title: "Sprite Sheet Inspector",
  description: "Inspect sprite sheets.",
  purpose: "Import a sprite sheet and choose frames.",
  outputKind: "image",
  acceptsFiles: true,
  includeSidebar: true,
  persistState: true
});
assert.equal(manual.category, "dev-tools");
assert.equal(manual.slug, "sprite-sheet-inspector");
assert.equal(manual.outputKind, "image");
assert.deepEqual(getToolScaffoldInputIssues({...manual, purpose: ""}), ["purpose is required"]);

const files = renderToolScaffoldFiles(manual);
assert.deepEqual(Object.keys(files).sort(), ["README.md", "app.js", "index.html", "style.css", "tool.json"]);
assert.match(files["index.html"], /data-dashboard-theme="fire"/);
assert.match(files["index.html"], /dashboard-current-output-autodescribe\.js/);
assert.match(files["index.html"], /dashboard-tool-bridge\.js/);
assert.match(files["app.js"], /__urageToolDescribeCurrentAsset/);
assert.match(files["app.js"], /__urageToolLoadAssetPayload/);
assert.equal(auditToolScaffoldFiles(files).every(item => item.passed), true);
const escapedFiles = renderToolScaffoldFiles({...manual, title: String.raw`Bob's \ Tool`});
assert.doesNotThrow(() => Function(escapedFiles["app.js"]));

const plan = parseToolScaffoldPlan('Planning...\n{"category":"audio","slug":"tone-lab","title":"Tone Lab","description":"Create tones.","purpose":"Create and export tones.","outputKind":"text","acceptsFiles":false,"includeSidebar":false,"persistState":false}');
assert.equal(plan.slug, "tone-lab");
assert.equal(plan.includeSidebar, false);

const prompt = buildToolScaffoldPlanningPrompt("Make a palette tool.");
assert.match(prompt, /Integration rules are non-negotiable/);
assert.match(prompt, /Do not return HTML, JavaScript/);

const implementationPrompt = buildToolScaffoldImplementationPrompt(manual, "Build a real sprite-sheet inspector.");
assert.match(implementationPrompt, /Implement the actual behavior/);
assert.match(implementationPrompt, /__urageToolDescribeCurrentAsset/);
const implementation = parseToolScaffoldImplementation(JSON.stringify({
  summary: "Implemented frame selection.",
  files: {
    "index.html": files["index.html"],
    "app.js": files["app.js"].replace("Output updated.", "Frame selection updated."),
    "style.css": files["style.css"]
  }
}), manual);
assert.match(implementation.files["app.js"], /Frame selection updated/);
assert.equal(auditToolScaffoldFiles(implementation.files).every(item => item.passed), true);
assert.throws(() => parseToolScaffoldImplementation('{"summary":"incomplete","files":{}}', manual), /complete implementation files/);

console.log("Tool scaffold validation passed.");
