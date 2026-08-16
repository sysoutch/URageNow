import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [messengerView, dashboardView, routes, bridge, matrixClient, runtimeUi, workspaceUi] = await Promise.all([
  readFile(path.join(root, "dashboard/src/pageSections/messengerView.ts"), "utf8"),
  readFile(path.join(root, "dashboard/src/pageSections/messengerDashboardView.ts"), "utf8"),
  readFile(path.join(root, "dashboard/src/server/routes/messengerAdminRoutes.ts"), "utf8"),
  readFile(path.join(root, "dashboard/src/server/runtime/botBridge.ts"), "utf8"),
  readFile(path.join(root, "server/src/services/messaging/matrixAdminClient.ts"), "utf8"),
  readFile(path.join(root, "dashboard/src/client/modules/shellRuntimeThemeHelpers.js"), "utf8"),
  readFile(path.join(root, "dashboard/src/client/modules/messenger/workspaceHelpers.js"), "utf8")
]);

for (const id of ["matrix-refresh-rooms-button", "matrix-refresh-activity-button", "matrix-runtime-health-chip", "matrix-activity-list", "matrix-room-id-input", "matrix-message-text", "matrix-send-message-button"]) {
  assert.match(messengerView, new RegExp(id));
}
assert.match(dashboardView, /messenger-dashboard-runtime-button/);
assert.match(dashboardView, /messenger-dashboard-quick-runtime-button/);
assert.match(dashboardView, /messenger-dashboard-member-label/);
assert.match(routes, /postRoute\("\/api\/matrix\/rooms\/refresh"/);
assert.match(routes, /getRoute\("\/api\/matrix\/health"/);
assert.match(routes, /getRoute\("\/api\/matrix\/events"/);
assert.match(routes, /refreshMatrixAdminRooms/);
assert.match(routes, /fetchMatrixAdminHealth/);
assert.match(routes, /fetchMatrixAdminEvents/);
assert.match(bridge, /refreshMatrixAdminRooms/);
assert.match(bridge, /fetchMatrixAdminHealth/);
assert.match(matrixClient, /"\/refresh-rooms"/);
assert.match(matrixClient, /"\/health"/);
assert.match(matrixClient, /"\/events"/);
assert.match(runtimeUi, /BotFather token/);
assert.match(runtimeUi, /Matrix token from OS Credential Store/);
assert.match(workspaceUi, /function getWorkspaceSelectedTelegramChat\(\)/);
assert.match(workspaceUi, /const selectedChat = getWorkspaceSelectedTelegramChat\(\)/);
assert.doesNotMatch(workspaceUi, /getSelectedTelegramChat\(\)/);

const dashboardHelpers = await readFile(path.join(root, "dashboard/src/client/modules/messenger/dashboardHelpers.js"), "utf8");
assert.match(dashboardHelpers, /\? "Restart" : "Start"/);
assert.match(dashboardHelpers, /browserButton\.hidden = messenger === "matrix"/);
assert.match(dashboardHelpers, /Matrix Runtime Activity/);

const messengerSelection = await readFile(path.join(root, "dashboard/src/client/modules/messenger/selectionHelpers.js"), "utf8");
assert.match(messengerSelection, /state\.selectedMessenger === "telegram"/);
assert.doesNotMatch(messengerSelection, /\n\s*renderTelegramChats\(\);/);
assert.ok(
  messengerSelection.indexOf("renderMessengerRuntimePanel();") < messengerSelection.indexOf("refreshNonDiscordMessengerState(getActiveView())"),
  "Messenger runtime labels must update before optional messenger-specific refresh work."
);

console.log("Telegram and Matrix dashboard control surface validation passed.");
