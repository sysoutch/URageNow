import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sourcePath = "tools/plan/flowchart-builder/index.html";
const html = await readFile(sourcePath, "utf8");
const scriptStart = html.indexOf("<script>");
const scriptEnd = html.lastIndexOf("</script>");

assert.match(html, /<\/style>\s*<\/head>/, "The Flowchart Builder stylesheet must close before the document head.");
assert.ok(scriptStart >= 0 && scriptEnd > scriptStart, "The Flowchart Builder script block is missing.");

const inlineScript = html.slice(scriptStart + "<script>".length, scriptEnd);
new Function(inlineScript);

assert.match(inlineScript, /tool:theme-request/, "The Flowchart Builder must request dashboard theme tokens.");
assert.match(inlineScript, /applyDashboardTheme/, "The Flowchart Builder must apply dashboard theme tokens.");

console.log("Flowchart Builder validation passed.");
