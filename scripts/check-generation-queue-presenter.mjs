import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import {fileURLToPath} from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const modulePath = path.join(repoRoot, "dashboard", "src", "client", "modules", "dashboard", "media", "generationQueuePresenter.js");
const source = await readFile(modulePath, "utf8");

class TestElement {
  constructor(id = "") {
    this.id = id;
    this.children = [];
    this.className = "";
    this.textContent = "";
    this.attributes = {};
    this.classList = {contains: value => this.className.split(/\s+/).includes(value)};
  }
  get firstChild() { return this.children[0] || null; }
  append(...children) { this.children.push(...children); }
  appendChild(child) { this.children.push(child); return child; }
  removeChild(child) { this.children.splice(this.children.indexOf(child), 1); }
  setAttribute(name, value) { this.attributes[name] = value; }
}

function createDocument({message = "", idle = true} = {}) {
  const container = new TestElement("queue");
  const status = new TestElement("image-status");
  status.textContent = message;
  const state = new TestElement("image-status-state");
  state.className = idle ? "is-idle" : "is-running";
  const elements = new Map([[container.id, container], [status.id, status], [state.id, state]]);
  return {
    container,
    document: {
      createElement: () => new TestElement(),
      getElementById: id => elements.get(id) || null
    }
  };
}

const context = vm.createContext({document: undefined});
vm.runInContext(`${source}\nthis.createPresenter = createDashboardGenerationQueuePresenter;`, context, {filename: modulePath});

const idleFixture = createDocument();
const idleResult = context.createPresenter({document: idleFixture.document}).render({
  containerId: "queue",
  statusKey: "image",
  noun: "image",
  studioLabel: "Image Studio"
});
assert.equal(idleResult.isActive, false);
assert.match(idleResult.item.className, /studio-component-empty-state/);
assert.equal(idleResult.item.children[1].textContent, "No active image jobs.");

const activeFixture = createDocument({message: "Generating 42%", idle: false});
const activeResult = context.createPresenter({document: activeFixture.document}).render({
  containerId: "queue",
  statusKey: "image",
  noun: "image",
  studioLabel: "Image Studio",
  createActiveAction() {
    const button = new TestElement();
    button.textContent = "Cancel";
    return button;
  }
});
assert.equal(activeResult.isActive, true);
assert.match(activeResult.item.className, /active/);
assert.equal(activeResult.item.children[1].textContent, "Generating 42%");
assert.equal(activeResult.item.children[2].textContent, "Cancel");

console.log("Shared Studio generation queue presenter validation passed.");
