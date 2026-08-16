import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const [page, helper, quickActions, styles, imageStyles, mediaStudio] = await Promise.all([
  readFile(new URL("../dashboard/src/pageSections/aiView.ts", import.meta.url), "utf8"),
  readFile(new URL("../dashboard/src/client/modules/dashboard/image/sendDestinationHelpers.js", import.meta.url), "utf8"),
  readFile(new URL("../dashboard/src/client/modules/dashboard/image/previewQuickActionController.js", import.meta.url), "utf8"),
  readFile(new URL("../dashboard/src/styles/media-ai/_model3d-send-destination.scss", import.meta.url), "utf8"),
  readFile(new URL("../dashboard/src/styles/media-ai/_image.scss", import.meta.url), "utf8"),
  readFile(new URL("../dashboard/src/client/modules/aiMediaStudioHelpers.js", import.meta.url), "utf8")
]);

assert.match(page, /id="image-send-menu-toggle"[\s\S]*?<span>Send To \.\.\.<\/span>/);
assert.match(page, /id="image-generation-placeholder"/);
assert.match(page, /Shaping pixels from your prompt/);
assert.match(page, /class="studio-send-destination-panel hidden" id="image-send-destination-panel" role="dialog" aria-modal="true"/);
for (const tab of ["tool", "game-engine", "3d-suite"]) {
  assert.match(page, new RegExp(`data-image-send-tab="${tab}"`));
}
assert.equal((page.match(/id="image-tool-picker"/g) || []).length, 1);
assert.equal((page.match(/id="image-send-to-tool-button"/g) || []).length, 1);
assert.equal((page.match(/id="image-send-to-game-engine-button"/g) || []).length, 1);
assert.match(page, /id="image-import-blender-button"/);
assert.match(helper, /createDashboardImageSendDestinationHelpers/);
assert.match(helper, /image-send-destination-panel/);
assert.match(helper, /data-image-send-tab/);
assert.match(quickActions, /image-send-menu-toggle/);
assert.match(styles, /\.studio-send-destination-panel/);
assert.match(styles, /\.studio-send-destination-backdrop/);
assert.match(imageStyles, /\.image-generation-placeholder/);
assert.match(imageStyles, /imageGenerationHalftoneDrift/);
assert.doesNotMatch(imageStyles, /imagePreviewGlassSweep/);
assert.match(mediaStudio, /latestMediaViewHelpers\.getLatestGifEntries\(\)/);

console.log("Image send destination validation passed.");
