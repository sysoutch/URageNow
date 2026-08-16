import assert from "node:assert/strict";
import {access, readFile} from "node:fs/promises";

const [manager, routes, page, client, iconManifestText] = await Promise.all([
  readFile(new URL("../dashboard/src/server/resourceHub/remoteAssetCatalogManager.ts", import.meta.url), "utf8"),
  readFile(new URL("../dashboard/src/server/routes/resourceHubRoutes.ts", import.meta.url), "utf8"),
  readFile(new URL("../dashboard/src/pageSections/resourceHubView.ts", import.meta.url), "utf8"),
  readFile(new URL("../dashboard/src/client/modules/resourceHubViewHelpers.js", import.meta.url), "utf8"),
  readFile(new URL("../dashboard/assets/config/remote-asset-icons.json", import.meta.url), "utf8")
]);
const iconManifest = JSON.parse(iconManifestText);

assert.match(manager, /https:\/\/github\.com\/sysoutch\/URage-Assets/);
assert.match(manager, /runGit\(\["clone", "--depth", "1"/);
assert.match(manager, /\["archive", "--format=zip"/);
assert.match(manager, /archivePromises/);
assert.match(manager, /filePath: archivePath/);
assert.match(manager, /GIT_TERMINAL_PROMPT: "0"/);
assert.match(manager, /refreshRemoteAssetCatalog/);
assert.match(manager, /iconUrl:/);
assert.match(routes, /getRoute\("\/api\/asset-catalog"/);
assert.match(routes, /getRoute\("\/api\/asset-catalog\/download"/);
assert.doesNotMatch(page, /externalAssetsRoot/);
assert.doesNotMatch(page, /C:\\\\Files\\\\github\\\\URage-suite\\\\URage Assets/);
assert.doesNotMatch(page, /Repository Sources/);
assert.doesNotMatch(page, /recommendedAssetSources/);
assert.match(page, /data-remote-asset-refetch/);
assert.match(page, /data-remote-asset-catalog-list/);
assert.match(client, /loadRemoteAssetCatalog\(true\)/);
assert.match(client, /\/api\/asset-catalog\/download\?id=/);
assert.match(client, /remote-asset-icon-artwork/);
await Promise.all([...new Set(Object.values(iconManifest))].map(iconName => access(
  new URL(`../dashboard/assets/vendor/bootstrap-icons/icons/${iconName}.svg`, import.meta.url)
)));

console.log("Remote URage Assets catalog validation passed.");
