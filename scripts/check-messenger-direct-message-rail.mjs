import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const modulePath = path.join(repoRoot, "dashboard", "src", "client", "modules", "messenger", "directMessageRailHelpers.js");
const source = readFileSync(modulePath, "utf8");

function createNode(id = "") {
  return {
    id,
    children: [],
    dataset: {},
    className: "",
    textContent: "",
    title: "",
    attributes: {},
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    append(...children) {
      this.children.push(...children);
    },
    replaceChildren(...children) {
      this.children = [...children];
    },
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
    addEventListener(name, listener) {
      this.listeners ||= {};
      this.listeners[name] = listener;
    }
  };
}

const nodes = new Map([
  ["rail-direct-messages", createNode("rail-direct-messages")],
  ["rail-direct-message-list", createNode("rail-direct-message-list")],
  ["rail-direct-messages-refresh", createNode("rail-direct-messages-refresh")],
  ["messaging-selected-user-chip", createNode("messaging-selected-user-chip")]
]);
const context = {
  document: {
    getElementById: id => nodes.get(id) || null,
    createElement: () => createNode()
  },
  localStorage: {
    values: new Map(),
    getItem(key) { return this.values.get(key) || null; },
    setItem(key, value) { this.values.set(key, value); }
  },
  window: {
    addEventListener() {}
  }
};
vm.createContext(context);
vm.runInContext(source + "\nglobalThis.createSubject = createDashboardDirectMessageRailHelpers;", context);

const state = {
  selectedMessenger: "discord",
  selectedDmChannelId: "",
  selectedUserId: "",
  selectedUser: null,
  dmThreads: []
};
const requests = [];
const controller = context.createSubject({
  state,
  request: async route => {
    requests.push(route);
    return [{
      channelId: "dm-1",
      userId: "user-1",
      displayName: "Ada Lovelace",
      tag: "ada",
      lastMessagePreview: "Hello"
    }];
  }
});

await controller.refresh();
assert.deepEqual(requests, ["/api/dms"]);
assert.equal(state.dmThreads.length, 1);
assert.equal(nodes.get("rail-direct-message-list").children.length, 1);
const dmButton = nodes.get("rail-direct-message-list").children[0];
assert.equal(dmButton.attributes["aria-label"], "Open direct message with Ada Lovelace");
dmButton.listeners.click();
assert.equal(state.selectedDmChannelId, "dm-1");
assert.equal(state.selectedUserId, "user-1");
assert.equal(nodes.get("messaging-selected-user-chip").textContent, "Ada Lovelace");

state.selectedMessenger = "matrix";
await controller.refresh();
assert.equal(requests.at(-1), "/api/matrix/rooms");
assert.equal(nodes.get("rail-direct-message-list").children[0].textContent, "No joined rooms discovered");

state.matrixRooms = [
  { roomId: "!space:example.org", title: "Studio", isSpace: true, childRoomIds: ["!images:example.org"] },
  { roomId: "!images:example.org", title: "Images", parentSpaceIds: ["!space:example.org"] },
  { roomId: "!lobby:example.org", title: "Lobby" }
];
controller.render();
const matrixGroups = nodes.get("rail-direct-message-list").children;
assert.equal(matrixGroups.length, 2);
assert.equal(matrixGroups[0].children[0].textContent, "Studio");
assert.equal(matrixGroups[0].children[1].attributes["aria-label"], "Open Matrix room Images");
assert.equal(matrixGroups[1].children[0].textContent, "Rooms");

assert.match(source, /\/api\/whatsapp\/contacts/);
assert.match(source, /urage-whatsapp-recipient-history/);
assert.match(source, /selectedWhatsAppRecipient/);
assert.match(source, /getMatrixRoomGroups/);
assert.match(source, /Spaces & rooms/);

const pageSource = readFileSync(path.join(repoRoot, "dashboard", "src", "page.ts"), "utf8");
assert.match(pageSource, /id="rail-direct-messages"/);
assert.match(pageSource, /bi-arrow-clockwise/);

const workspaceSource = readFileSync(path.join(repoRoot, "dashboard", "src", "client", "modules", "messenger", "workspaceHelpers.js"), "utf8");
assert.match(workspaceSource, /function normalizeWorkspaceTelegramChatId/);
assert.doesNotMatch(workspaceSource, /\bnormalizeTelegramChatId\(/, "Messenger workspace must not rely on an undeclared outer Telegram normalizer.");

console.log("Messenger direct-message rail checks passed.");
