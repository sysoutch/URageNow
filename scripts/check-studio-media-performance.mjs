import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lazyHelpers = await readFile(path.join(repoRoot, "dashboard", "src", "client", "modules", "lazyMediaHelpers.js"), "utf8");
const mediaHelpers = await readFile(path.join(repoRoot, "dashboard", "src", "client", "modules", "aiMediaStudioHelpers.js"), "utf8");
const objectPromptCollection = await readFile(path.join(repoRoot, "dashboard", "src", "client", "modules", "dashboard", "image", "objectPromptCollection.js"), "utf8");
const modelHelpers = await readFile(path.join(repoRoot, "dashboard", "src", "client", "modules", "dashboard", "3d", "viewerHelpers.js"), "utf8");
const routingHelpers = await readFile(path.join(repoRoot, "dashboard", "src", "client", "modules", "studioRoutingMediaBootstrapHelpers.js"), "utf8");
const routingInputHelpers = await readFile(path.join(repoRoot, "dashboard", "src", "client", "modules", "studioRoutingBootstrapInputHelpers.js"), "utf8");
const modelRoutes = await readFile(path.join(repoRoot, "dashboard", "src", "server", "routes", "messagingAndModelRoutes.ts"), "utf8");
const modelService = await readFile(path.join(repoRoot, "server", "src", "services", "model3d.ts"), "utf8");

assert.ok(lazyHelpers.includes("attach.detach = detach"));
assert.ok(lazyHelpers.includes('media.removeAttribute("src")'));
assert.ok(mediaHelpers.includes("detachDashboardLazyMedia(container)"));
assert.ok(mediaHelpers.includes("unobserveImageHistoryMedia(container)"));
assert.ok(mediaHelpers.includes("releaseImagePreviewGifFrames"));
assert.ok(mediaHelpers.includes("videoHistoryInitialRenderLimit"));
assert.ok(mediaHelpers.includes("disableImageObjectIdentificationMode();"));
assert.equal(mediaHelpers.includes('document.getElementById("image-identify-objects-toggle")?.checked === true || imageObjectPromptState.items.length > 0'), false);
assert.ok(objectPromptCollection.includes('hasMultiplePrompts ? "Generate Multiple Images"'));
assert.ok(mediaHelpers.includes('document.getElementById("image-identify-objects-toggle")?.checked === true || imageObjectPromptState.items.length > 1'));
assert.equal(mediaHelpers.includes("thumb.src = input.getGeneratedImageFileUrl(entry.id, entry.imageFileName)"), false);
assert.equal(mediaHelpers.includes("image.src = sourceUrl;"), false);
assert.ok(mediaHelpers.includes("input.updateVideoToolQuickActionState()"));
assert.equal(mediaHelpers.includes("typeof updateVideoToolQuickActionState"), false);
assert.ok(routingHelpers.includes("updateVideoToolQuickActionState: typeof updateVideoToolQuickActionState"));
assert.ok(routingInputHelpers.includes("updateVideoToolQuickActionState: input.updateVideoToolQuickActionState"));
assert.ok(modelHelpers.includes("disposeModel3dRootResources"));
assert.ok(modelHelpers.includes("attachDashboardLazyMedia.detach(container)"));
assert.ok(modelHelpers.includes("record.__model3dVariantKey || resolveModel3dThreeVariantForRecord(record)"));
assert.equal(modelHelpers.includes("const directPreviewUrlCandidates = [record.lowPolyPreviewGifUrl, record.previewGifUrl, record.lowPolyPreviewImageUrl, record.previewImageUrl]"), false);
assert.ok(modelHelpers.includes("const order = { current: 0, lowpoly: 1, albedo: 2, original: 3 }"));
const mergedVariantIndex = modelHelpers.indexOf('{ key: "current", title: "Merged"');
const lowPolyVariantIndex = modelHelpers.indexOf('{ key: "lowpoly", title: "Low Poly"');
assert.ok(mergedVariantIndex >= 0 && lowPolyVariantIndex > mergedVariantIndex);
assert.ok(modelRoutes.includes('if (!modelId || !variant || !fileName)'));
const variantDeleteService = modelService.slice(
  modelService.indexOf("export async function deleteGeneratedModelVariant"),
  modelService.indexOf("export async function setGeneratedModelPreviewGif")
);
assert.equal(variantDeleteService.includes("deleteGeneratedModel(safeModelId)"), false);
assert.ok(variantDeleteService.includes("lowPolyModelFileName: null"));
assert.ok(routingHelpers.includes('document.addEventListener("visibilitychange"'));
assert.ok(routingHelpers.includes("unloadModel3dViewerPreview()"));

console.log("Studio media performance validation passed.");
