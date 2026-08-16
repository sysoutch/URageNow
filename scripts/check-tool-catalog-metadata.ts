import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {getToolCatalogMetadata} from "../dashboard/src/server/resourceHub/toolCatalogMetadataStore.js";
import {buildToolFileDiff} from "../dashboard/src/server/resourceHub/toolFileDiff.js";

const metadata = getToolCatalogMetadata();
const games = metadata.categories.find(category => category.id === "game");
assert.equal(games?.label, "Games");
assert.equal(games?.icon, "controller");
assert.equal(games?.hidden, false);
assert.equal(typeof games?.assignedToolCount, "number");

const view = await readFile(new URL("../dashboard/src/pageSections/toolsView.ts", import.meta.url), "utf8");
const routes = await readFile(new URL("../dashboard/src/server/routes/resourceHubRoutes.ts", import.meta.url), "utf8");
const catalog = await readFile(new URL("../dashboard/src/client/modules/dashboard/tools/workspaceCatalogHelpers.js", import.meta.url), "utf8");
const workspace = await readFile(new URL("../dashboard/src/client/modules/dashboard/tools/workspaceHelpers.js", import.meta.url), "utf8");
const controller = await readFile(new URL("../dashboard/src/client/modules/dashboard/tools/toolCatalogMetadataController.js", import.meta.url), "utf8");
const transaction = await readFile(new URL("../dashboard/src/server/resourceHub/toolCategoryMoveTransaction.ts", import.meta.url), "utf8");

assert.match(view, /data-tools-tags/);
assert.match(view, /tools-manage-metadata-button/);
assert.match(view, /tools-workspace-action-label/, "Catalogue action labels should be independently collapsible.");
assert.match(routes, /\/api\/tools\/categories\/save/);
assert.match(routes, /\/api\/tools\/tags\/rename/);
assert.match(routes, /\/api\/tools\/categories\/move-tool/);
assert.match(routes, /\/api\/tools\/categories\/visibility/);
assert.match(routes, /\/api\/tools\/categories\/delete/);
assert.match(routes, /\/api\/tools\/tags\/bulk/);
assert.match(routes, /\/api\/tools\/tags\/color/);
assert.match(catalog, /data-tools-tags/);
assert.match(workspace, /entry\.tags/);
assert.match(workspace, /data-tools-tag-filter/);
assert.match(controller, /Move .* transactionally/);
assert.match(controller, /selectedOptions/);
assert.match(transaction, /urage-move/);
assert.match(transaction, /rollbackSource/);

const diff = buildToolFileDiff("app.js", "one\ntwo", "one\nthree");
assert.equal(diff.added, 1);
assert.equal(diff.removed, 1);

console.log("Tool category preset and tag metadata validation passed.");
