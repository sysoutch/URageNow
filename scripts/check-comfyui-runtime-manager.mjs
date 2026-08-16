import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const [managerSource, routeSource] = await Promise.all([
  readFile(new URL("../dashboard/src/server/comfyUi/comfyUiRuntimeManager.ts", import.meta.url), "utf8"),
  readFile(new URL("../dashboard/src/server/routes/resourceHubRoutes.ts", import.meta.url), "utf8")
]);

assert.match(managerSource, /detached: true/);
assert.doesNotMatch(managerSource, /runningProcess\.unref\(\)/);
assert.match(managerSource, /windowsHide: false/);
assert.match(managerSource, /const bundledLauncherPath = "scripts\/comfyui\/run-comfyui\.bat"/);
assert.match(managerSource, /stdio: \["ignore", "pipe", "pipe"\]/);
assert.match(managerSource, /child\.stdout\?\.on\("data", appendRuntimeOutput\)/);
assert.match(managerSource, /child\.stderr\?\.on\("data", appendRuntimeOutput\)/);
assert.match(managerSource, /browseForComfyUiLauncherFolder/);
assert.match(managerSource, /browseForComfyUiLauncherBatch/);
assert.match(managerSource, /async function terminateWindowsProcessTree/);
assert.match(managerSource, /await terminateWindowsProcessTree\(child\.pid\)/);
assert.match(managerSource, /await waitForProcessExit\(child\)/);
assert.match(managerSource, /ComfyUI did not stop within 10 seconds/);
assert.match(routeSource, /async function handlePostComfyUiRuntimeStop[\s\S]*?await stopComfyUiRuntime\(\)[\s\S]*?Failed to stop ComfyUI/);
assert.match(routeSource, /\/api\/comfyui\/runtime\/browse-folder/);
assert.match(routeSource, /\/api\/comfyui\/runtime\/browse-launcher/);

console.log("ComfyUI runtime ownership validation passed.");
