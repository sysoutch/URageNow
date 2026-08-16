import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import vm from "node:vm";

function createClassList() {
  const values = new Set(["hidden"]);
  return {
    add: value => values.add(value),
    remove: value => values.delete(value),
    contains: value => values.has(value),
    toggle(value, force) {
      if (force === true) values.add(value);
      else if (force === false) values.delete(value);
      else if (values.has(value)) values.delete(value);
      else values.add(value);
    }
  };
}

function createNode(attributes = {}) {
  const listeners = new Map();
  const node = {
    value: "",
    textContent: "",
    id: "",
    type: "",
    dataset: {},
    children: [],
    className: "",
    classList: createClassList(),
    attributes: {...attributes},
    append(...children) { this.children.push(...children); },
    appendChild(child) { this.children.push(child); },
    replaceChildren(...children) { this.children = children; },
    addEventListener(name, listener) { listeners.set(name, listener); },
    dispatch(name, event = {}) { listeners.get(name)?.({target: this, key: "", preventDefault() {}, stopImmediatePropagation() {}, ...event}); },
    getAttribute(name) { return this.attributes[name] || ""; },
    setAttribute(name, value) { this.attributes[name] = String(value); },
    removeAttribute(name) { delete this.attributes[name]; },
    focus() {},
    setSelectionRange() {},
    dispatchEvent() {}
  };
  return node;
}

const prompt = createNode();
const palette = createNode();
const tool = createNode({
  "data-tools-tool": "art__pixel-tool",
  "data-tools-src": "/tools/art/pixel-tool/index.html",
  "data-tools-title": "Pixel Tool",
  "data-tools-description": "Edit pixels.",
  "data-tools-category": "Art"
});
const nodes = new Map([
  ["ask-prompt", prompt],
  ["ask-slash-command-palette", palette]
]);
const source = await readFile(new URL("../dashboard/src/client/modules/dashboard/chat/slashCommandController.js", import.meta.url), "utf8");
const context = vm.createContext({
  document: {
    getElementById: id => nodes.get(id) || null,
    querySelectorAll: selector => selector.includes("data-tools-tool") ? [tool] : [],
    createElement: () => createNode()
  },
  window: {setTimeout: callback => callback()},
  Event: class Event {},
  console
});
vm.runInContext(`${source}\nthis.createController = createDashboardChatSlashCommandController;`, context);
const controller = context.createController({
  request: async () => ({skills: [{id: "generate-image", name: "Generate Image", description: "Create an image."}]})
});
controller.bind();
await Promise.resolve();

prompt.value = "/";
controller.syncFromPrompt();
assert.equal(palette.classList.contains("hidden"), false);
assert.equal(palette.children.some(child => child.children?.[0]?.textContent === "/tools"), true);

prompt.value = "/tools ";
controller.syncFromPrompt();
assert.equal(palette.children.some(child => child.children?.[0]?.textContent === "Pixel Tool"), true);
assert.equal(controller.readTools().map(entry => entry.id).join(","), "art__pixel-tool");

console.log("Chat slash command palette validation passed.");
