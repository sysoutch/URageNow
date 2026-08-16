import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readSource = relativePath => readFile(path.join(repoRoot, relativePath), "utf8");

const [
  aiView,
  imageRuntime,
  imageStore,
  modelStore,
  imageStudio,
  modelStudio
] = await Promise.all([
  readSource("dashboard/src/pageSections/aiView.ts"),
  readSource("bots/discord-bot/src/runtime/generatedImageRuntime.ts"),
  readSource("server/src/services/generatedMediaLibrary.ts"),
  readSource("server/src/services/model3d.ts"),
  readSource("dashboard/src/client/modules/aiMediaStudioHelpers.js"),
  readSource("dashboard/src/client/modules/dashboard/3d/viewerHelpers.js")
]);

assert.match(aiView, /id="imagegen-auto-filename"[^>]*checked/);
assert.match(aiView, /id="imagegen-auto-description"[^>]*checked/);
assert.match(aiView, /id="model3d-llm-filename"[^>]*checked/);
assert.match(aiView, /id="model3d-llm-description"[^>]*checked/);

assert.match(imageRuntime, /for \(const record of generatedRecords\)/);
assert.match(imageRuntime, /updateGeneratedImageDescription\(generatedImageId, description\)/);
assert.match(imageStore, /export async function updateGeneratedImageDescription/);
assert.match(modelStore, /export async function updateGeneratedModelDescription/);

assert.match(imageStudio, /"Description: " \+ \(record\.description/);
assert.match(modelStudio, /\{ key: "Description", value: record\.description/);

console.log("Generated Image and 3D metadata validation passed.");
