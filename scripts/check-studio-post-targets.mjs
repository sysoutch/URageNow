import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import {fileURLToPath} from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const modulePath = path.join(
  repoRoot,
  "dashboard",
  "src",
  "client",
  "modules",
  "dashboard",
  "media",
  "studioPostTargets.js"
);
const source = await readFile(modulePath, "utf8");
const nodes = new Map();

function createNode(value = "") {
  const listeners = new Map();
  const node = {
    value,
    textContent: "",
    disabled: false,
    children: [],
    classList: {toggle() {}},
    get options() {
      return this.children;
    },
    appendChild(child) {
      this.children.push(child);
    },
    addEventListener(type, listener) {
      const entries = listeners.get(type) || [];
      entries.push(listener);
      listeners.set(type, entries);
    },
    dispatch(type) {
      (listeners.get(type) || []).forEach(listener => listener({preventDefault() {}}));
    }
  };
  return node;
}

const document = {
  createElement: () => createNode(),
  getElementById: id => nodes.get(id) || null
};
const context = vm.createContext({document});
vm.runInContext(`${source}\nthis.createPostTargets = createDashboardStudioPostTargets;`, context, {filename: modulePath});

const requests = [];
const state = {
  channels: [
    {id: "text-1", name: "art", canSendMessages: true, isVoice: false, kind: "text"},
    {id: "voice-1", name: "voice", canSendMessages: true, isVoice: true, kind: "voice"},
    {id: "forum-1", name: "forum", canSendMessages: true, isVoice: false, kind: "guild-forum"}
  ],
  selectedChannelId: "fallback-channel",
  selectedTelegramChatId: "fallback-chat",
  telegramChats: [{chatId: "chat-1", title: "Studio Chat"}]
};
const helpers = context.createPostTargets({
  state,
  clearChildren(node) {
    node.children.length = 0;
  },
  setOutput() {},
  async request(route, body) {
    requests.push({route, body});
    return {};
  }
});

const messenger = createNode("discord");
const destination = createNode("");
nodes.set("imagegen-post-messenger-select", messenger);
nodes.set("imagegen-post-destination-input", destination);
nodes.set("imagegen-post-destination-hint", createNode());
helpers.bindPostTargetUi("imagegen");
await new Promise(resolve => setImmediate(resolve));

assert.deepEqual({...helpers.getPostTarget("imagegen", "images")}, {
  messenger: "discord",
  destinationId: "fallback-channel",
  error: ""
});
assert.deepEqual(destination.children.map(option => option.value), ["", "text-1", "fallback-channel"]);

messenger.value = "telegram";
destination.value = "";
messenger.dispatch("change");
await new Promise(resolve => setImmediate(resolve));
assert.deepEqual(destination.children.map(option => option.value), ["", "chat-1", "fallback-chat"]);

messenger.value = "matrix";
destination.value = "!room:example.test";
assert.equal(helpers.getPostTarget("imagegen", "images").error, "Matrix posting from LazyDev is not wired yet.");

assert.equal(await helpers.postToExternalTarget({messenger: "telegram", destinationId: "chat-2"}, "hello"), true);
assert.equal(state.selectedTelegramChatId, "chat-2");
assert.equal(await helpers.postToExternalTarget({messenger: "whatsapp", destinationId: "+41000"}, "hello"), true);
assert.deepEqual(JSON.parse(JSON.stringify(requests)), [
  {route: "/api/telegram/send-message", body: {chatId: "chat-2", text: "hello"}},
  {route: "/api/whatsapp/send-message", body: {to: "+41000", text: "hello"}}
]);
assert.equal(await helpers.postToExternalTarget({messenger: "discord", destinationId: "text-1"}, "hello"), false);

console.log("Studio post target validation passed.");
