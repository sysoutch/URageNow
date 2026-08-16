import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [
  pageSource,
  clientSource,
  routeSource,
  generationSource,
  configSource
] = await Promise.all([
  readFile(new URL("../dashboard/src/pageSections/aiView.ts", import.meta.url), "utf8"),
  readFile(new URL("../dashboard/src/client/modules/aiMediaStudioHelpers.js", import.meta.url), "utf8"),
  readFile(new URL("../dashboard/src/server/routes/messagingAndModelRoutes.ts", import.meta.url), "utf8"),
  readFile(new URL("../server/src/services/audioGeneration.ts", import.meta.url), "utf8"),
  readFile(new URL("../server/src/config/appConfig.ts", import.meta.url), "utf8")
]);

for (const id of ["musicgen-steps", "musicgen-cfg", "musicgen-seed", "musicgen-seed-control"]) {
  assert.match(pageSource, new RegExp(`id="${id}"`), `Music Studio is missing #${id}.`);
}
assert.match(pageSource, /for="musicgen-seed-control">Control After Generation</);
assert.match(clientSource, /request\("\/api\/music-generate", \{[\s\S]*?steps,[\s\S]*?cfg,[\s\S]*?seed,/);
assert.match(clientSource, /applySeedControlAfterGenerate\("musicgen-seed", "musicgen-seed-control", seed\)/);
assert.match(routeSource, /generateMusicFromPrompt\(\{[\s\S]*?steps,[\s\S]*?cfg,[\s\S]*?seed,/);
assert.match(generationSource, /setNodeInputNumber\(workflowRoot, input\.stepsNodeId, input\.stepsInputKey, requestedSteps\)/);
assert.match(generationSource, /setNodeInputNumber\(workflowRoot, input\.cfgNodeId, input\.cfgInputKey, requestedCfg\)/);
assert.match(configSource, /COMFYUI_MUSIC_CFG_NODE_ID/);

console.log("Music generation controls validation passed.");
