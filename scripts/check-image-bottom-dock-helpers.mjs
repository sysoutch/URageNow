import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import {fileURLToPath} from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const modulePath = path.join(repoRoot, "dashboard", "src", "client", "modules", "dashboard", "media", "imageBottomDockHelpers.js");
const presenterPath = path.join(repoRoot, "dashboard", "src", "client", "modules", "dashboard", "media", "generationQueuePresenter.js");
const [source, presenterSource] = await Promise.all([
  readFile(modulePath, "utf8"),
  readFile(presenterPath, "utf8")
]);
const runtime = vm.createContext({});
vm.runInContext(`${presenterSource}\n${source}\nthis.createDock = createDashboardImageBottomDockHelpers;`, runtime, {filename: modulePath});

function createNode(tagName = "div") {
  const listeners = new Map();
  return {
    tagName,
    children: [],
    attributes: new Map(),
    classList: {contains: value => value === "is-idle" ? false : false},
    listeners,
    append(...children) { this.children.push(...children); },
    appendChild(child) { this.children.push(child); return child; },
    get firstChild() { return this.children[0] || null; },
    removeChild(child) { this.children.splice(this.children.indexOf(child), 1); },
    addEventListener: (name, listener) => listeners.set(name, listener),
    setAttribute(name, value) { this.attributes.set(name, value); },
    dispatch(name, event = {}) { listeners.get(name)?.(event); }
  };
}

const filmstrip = createNode("section");
const queue = createNode("section");
const status = createNode();
status.textContent = "Generating image 2 of 4";
const statusState = createNode();
const nodes = new Map([
  ["image-bottom-filmstrip", filmstrip],
  ["image-bottom-queue-list", queue],
  ["imagegen-status", status],
  ["imagegen-status-state", statusState]
]);
const entries = Array.from({length: 25}, (_, index) => ({
  id: "image-" + index,
  imageFileName: "image-" + index + ".png",
  prompt: index < 13 ? "forest" : "city",
  createdAt: "2026-07-24T00:00:00.000Z"
}));
const state = {
  generatedImages: entries,
  imageBottomVisibleLimit: 24,
  selectedGeneratedImageId: "",
  selectedGeneratedImageIds: []
};
const calls = [];
let filteredEntries = entries;
const dock = runtime.createDock({
  state,
  createElement: createNode,
  getElementById: id => nodes.get(id),
  clearChildren: node => { node.children = []; },
  attachLazyMedia: (node, url) => { node.src = url; },
  detachLazyMedia: node => calls.push(["detach", node]),
  formatDateTime: value => "formatted:" + value,
  getImageUrl: (id, fileName) => "/images/" + id + "/" + fileName,
  multiSelection: {
    handleSelectionClick({id}) {
      state.selectedGeneratedImageId = id;
      state.selectedGeneratedImageIds = [id];
    },
    isSelected: (_selectionKey, selectedId, id) => selectedId === id,
    pruneSelection: (...args) => calls.push(["prune", ...args.slice(0, 2)])
  },
  recentMedia: {
    appendGroupHeading(container, label, count) {
      const heading = createNode("heading");
      heading.textContent = label + ":" + count;
      container.appendChild(heading);
    },
    filterEntries: () => filteredEntries,
    groupEntries(items) {
      return [{label: "Prompt", entries: items}];
    },
    renderControls: (_id, options) => calls.push(["controls", options.key])
  },
  renderSelectedMeta: () => calls.push(["meta"]),
  scrollSelectedIntoView: id => calls.push(["scroll", id])
});

assert.equal(dock.renderFilmstrip(), true);
assert.equal(filmstrip.children.length, 26);
const firstCard = filmstrip.children[1];
assert.equal(firstCard.attributes.get("data-image-id"), "image-0");
assert.equal(firstCard.children[0].src, "/images/image-0/image-0.png");
firstCard.dispatch("click", {preventDefault() { this.prevented = true; }});
assert.equal(state.selectedGeneratedImageId, "image-0");
assert.equal(calls.some(call => call[0] === "meta"), true);
assert.equal(calls.some(call => call[0] === "scroll" && call[1] === "image-0"), true);

const moreButton = filmstrip.children.at(-1);
moreButton.dispatch("click", {preventDefault() {}});
assert.equal(state.imageBottomVisibleLimit, 48);
assert.equal(filmstrip.children.length, 26);

filteredEntries = [];
dock.renderFilmstrip();
assert.equal(filmstrip.children[0].textContent, "No recent images match the filter.");

assert.equal(dock.renderQueue(), true);
assert.equal(queue.children[0].className, "studio-generation-queue-item image-queue-item active");
assert.equal(queue.children[0].children[1].textContent, "Generating image 2 of 4");
assert.equal(queue.children[0].children[1].children[0].textContent, "Current Image Studio status");

console.log("Image bottom dock validation passed.");
