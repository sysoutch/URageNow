import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const server = await readFile(new URL("../dashboard/src/server/resourceHub/toolEditorManager.ts", import.meta.url), "utf8");
const routes = await readFile(new URL("../dashboard/src/server/routes/resourceHubRoutes.ts", import.meta.url), "utf8");
const controller = await readFile(new URL("../dashboard/src/client/modules/dashboard/tools/toolEditorController.js", import.meta.url), "utf8");
const view = await readFile(new URL("../dashboard/src/pageSections/toolsView.ts", import.meta.url), "utf8");

assert.match(routes, /\/api\/tools\/edit\/catalog/);
assert.match(routes, /\/api\/tools\/edit\/file/);
assert.match(routes, /\/api\/tools\/edit\/plan/);
assert.match(routes, /\/api\/tools\/edit\/apply/);
assert.match(routes, /\/api\/tools\/edit\/stage/);
assert.match(routes, /\/api\/tools\/edit\/rollback/);
assert.match(server, /tool-edit-backups/);
assert.match(server, /auditToolScaffoldFiles/);
assert.match(server, /Only existing tool files may be changed/);
assert.match(server, /originalHashes/);
assert.match(server, /commitStagedFiles/);
assert.match(server, /automatic rollback was incomplete/);
assert.match(controller, /data-tool-editor-mode/);
assert.match(controller, /Review every proposed file before applying/);
assert.match(controller, /Confirm Transactional Apply/);
assert.match(controller, /renderDiff/);
assert.match(controller, /\/api\/tools\/edit\/rollback/);
assert.match(view, /id="tools-edit-tool-button"/);
assert.match(view, /tools-workspace-actions/, "Tool actions should share one horizontal action rail.");
assert.match(view, /id="tool-editor-overlay"/);

console.log("Audited tool editor validation passed.");
