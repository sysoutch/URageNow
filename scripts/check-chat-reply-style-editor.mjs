import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import vm from "node:vm";

function createNode() {
  const listeners = new Map();
  const node = {
    value: "",
    textContent: "",
    disabled: false,
    children: [],
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    removeChild(child) {
      this.children.splice(this.children.indexOf(child), 1);
      return child;
    },
    addEventListener(name, listener) {
      listeners.set(name, listener);
    },
    dispatch(name) {
      return listeners.get(name)?.({currentTarget: this});
    }
  };
  Object.defineProperty(node, "firstChild", {get() { return this.children[0] || null; }});
  return node;
}

const source = await readFile(
  new URL("../dashboard/src/client/modules/dashboard/chat/replyStyleEditor.js", import.meta.url),
  "utf8"
);
const ids = [
  "ask-reply-style-select",
  "ask-reply-style-label",
  "ask-reply-style-prompt",
  "ask-reply-style-save-button",
  "ask-reply-style-add-button",
  "ask-reply-style-delete-button",
  "ask-reply-style-status"
];
const nodes = new Map(ids.map(id => [id, createNode()]));
const savedPayloads = [];
const initialPayload = {
  activeReplyStyleId: "empty",
  replyStyles: [
    {id: "empty", label: "<empty>", prompt: "", isBuiltIn: true},
    {id: "markdown", label: "Always Markdown", prompt: "Always use Markdown.", isBuiltIn: true}
  ]
};
const context = vm.createContext({
  document: {
    getElementById: id => nodes.get(id) || null,
    createElement: () => createNode()
  },
  fetch: async () => ({ok: true, json: async () => initialPayload}),
  console
});
vm.runInContext(`${source}\nthis.createReplyStyleEditor = createDashboardChatReplyStyleEditor;`, context);
const editor = context.createReplyStyleEditor({
  request: async (_route, payload) => {
    savedPayloads.push(payload);
    return payload;
  }
});

await editor.load();
assert.equal(nodes.get("ask-reply-style-select").children.length, 2);
assert.equal(nodes.get("ask-reply-style-delete-button").disabled, true);

editor.add();
nodes.get("ask-reply-style-label").value = "Release Notes";
nodes.get("ask-reply-style-prompt").value = "Use Added, Changed, and Fixed headings.";
const captured = editor.capture();
assert.equal(captured.activeReplyStyleId, "custom-reply-style");
assert.equal(captured.replyStyles.at(-1).label, "Release Notes");
assert.equal(nodes.get("ask-reply-style-delete-button").disabled, false);

await editor.save();
assert.equal(savedPayloads.length, 1);
assert.equal(savedPayloads[0].replyStyles.at(-1).prompt, "Use Added, Changed, and Fixed headings.");

console.log("Chat reply style editor validation passed.");
