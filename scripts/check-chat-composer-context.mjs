import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import vm from "node:vm";

function createNode() {
  const listeners = new Map();
  const classes = new Set();
  return {
    value: "",
    textContent: "",
    title: "",
    dataset: {},
    children: [],
    classList: {
      toggle(name, enabled) {
        if (enabled) classes.add(name);
        else classes.delete(name);
      },
      contains: name => classes.has(name)
    },
    addEventListener(name, listener) {
      listeners.set(name, listener);
    },
    dispatch(name) {
      listeners.get(name)?.({currentTarget: this});
    },
    appendChild(child) {
      this.children.push(child);
    },
    replaceChildren(...children) {
      this.children = children;
    }
  };
}

const source = await readFile(
  new URL("../dashboard/src/client/modules/dashboard/chat/composerContextController.js", import.meta.url),
  "utf8"
);
const nodes = new Map([
  ["ask-active-personality-badge", createNode()],
  ["ask-active-reply-style-badge", createNode()],
  ["ask-chat-reply-style-override", createNode()]
]);
const session = {replyStyleOverrideId: ""};
let persistCount = 0;
let subscriber = null;
const snapshot = {
  activeReplyStyleId: "markdown",
  replyStyles: [
    {id: "empty", label: "<empty>"},
    {id: "markdown", label: "Always Markdown"},
    {id: "json", label: "JSON Only"}
  ]
};
const context = vm.createContext({
  document: {
    getElementById: id => nodes.get(id) || null,
    createElement: () => createNode()
  }
});
vm.runInContext(`${source}\nthis.createController = createDashboardChatComposerContextController;`, context);
const controller = context.createController({
  getActiveSession: () => session,
  persistSessions: () => { persistCount += 1; },
  getPersonalityLabel: () => "Funny",
  replyStyleEditor: {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      subscriber = listener;
      listener(snapshot);
      return () => {};
    }
  }
});

controller.bind();
assert.equal(nodes.get("ask-active-personality-badge").textContent, "Personality: Funny");
assert.equal(nodes.get("ask-active-reply-style-badge").textContent, "Reply: Always Markdown");
assert.equal(nodes.get("ask-chat-reply-style-override").children.length, 4);

nodes.get("ask-chat-reply-style-override").value = "json";
nodes.get("ask-chat-reply-style-override").dispatch("change");
assert.equal(session.replyStyleOverrideId, "json");
assert.equal(persistCount, 1);
assert.equal(nodes.get("ask-active-reply-style-badge").textContent, "Reply: JSON Only");
assert.equal(nodes.get("ask-active-reply-style-badge").classList.contains("is-overridden"), true);

snapshot.replyStyles = snapshot.replyStyles.filter(style => style.id !== "json");
subscriber(snapshot);
assert.equal(session.replyStyleOverrideId, "");
assert.equal(persistCount, 2);
assert.equal(nodes.get("ask-active-reply-style-badge").textContent, "Reply: Always Markdown");

console.log("Chat composer context validation passed.");
