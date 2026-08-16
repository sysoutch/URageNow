import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import {fileURLToPath} from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const modulePath = path.join(repoRoot, "dashboard", "src", "client", "modules", "dashboard", "media", "imageHistoryViewHelpers.js");
const source = await readFile(modulePath, "utf8");
const runtime = vm.createContext({});
vm.runInContext(`${source}\nthis.createHistory = createDashboardImageHistoryViewHelpers;`, runtime, {filename: modulePath});

function createNode(tagName = "div") {
  const listeners = new Map();
  return {
    tagName,
    children: [],
    attributes: new Map(),
    listeners,
    append(...children) { this.children.push(...children); },
    appendChild(child) { this.children.push(child); return child; },
    addEventListener: (name, listener) => listeners.set(name, listener),
    setAttribute(name, value) { this.attributes.set(name, value); },
    dispatch(name, event = {}) { return listeners.get(name)?.(event); }
  };
}

const container = createNode("section");
const entries = Array.from({length: 3}, (_, index) => ({
  id: "image-" + index,
  imageFileName: "image-" + index + ".png",
  createdAt: "2026-07-24T00:00:00.000Z"
}));
const state = {
  generatedImages: entries,
  imageHistoryVisibleLimit: 2,
  selectedGeneratedImageId: "image-0",
  selectedGeneratedImageIds: ["image-0", "image-1"]
};
const calls = [];
const history = runtime.createHistory({
  state,
  initialLimit: 2,
  createElement: createNode,
  getContainer: () => container,
  clearChildren: node => { node.children = []; },
  attachLazyMedia: (node, url) => { node.src = url; },
  formatDateTime: () => "today",
  getImageUrl: (id, fileName) => "/images/" + id + "/" + fileName,
  getSelected: () => entries.find(entry => entry.id === state.selectedGeneratedImageId) || null,
  getSelectedMany: () => entries.filter(entry => state.selectedGeneratedImageIds.includes(entry.id)),
  multiSelection: {
    handleSelectionClick({id}) {
      state.selectedGeneratedImageId = id;
      state.selectedGeneratedImageIds = [id];
    },
    isSelected: (_key, selectedId, id) => selectedId === id,
    pruneSelection: () => calls.push(["prune"])
  },
  onAddSelectedToPool: () => calls.push(["pool"]),
  onDelete: selected => calls.push(["delete", selected.map(entry => entry.id)]),
  onPixelate: entry => calls.push(["pixel", entry.id]),
  onRename: entry => calls.push(["rename", entry.id]),
  renderMeta: record => calls.push(["meta", record?.id || null]),
  renderRelated: () => calls.push(["related"]),
  scrollSelectedIntoView: id => calls.push(["scroll", id]),
  unobserveMedia: node => calls.push(["unobserve", node])
});

assert.equal(history.render(), true);
assert.equal(container.children.length, 4);
assert.equal(container.children[0].className, "media-history-bulk-actions");
assert.equal(container.children[3].textContent, "Show 1 more images");
const firstRowWrap = container.children[1];
assert.equal(firstRowWrap.attributes.get("data-image-id"), "image-0");
assert.equal(firstRowWrap.children[0].children[0].children[0].src, "/images/image-0/image-0.png");

const actionButtons = firstRowWrap.children[0].children[1].children;
for (const [index, expected] of [["rename", 0], ["pixel", 1], ["delete", 2]]) {
  const event = {
    preventDefault() { this.prevented = true; },
    stopPropagation() { this.stopped = true; }
  };
  await actionButtons[expected].dispatch("click", event);
  assert.equal(event.prevented, true);
  assert.equal(event.stopped, true);
  assert.equal(calls.some(call => call[0] === index), true);
}

container.children[0].children[1].dispatch("click");
assert.equal(calls.some(call => call[0] === "pool"), true);
container.children[3].dispatch("click");
assert.equal(state.imageHistoryVisibleLimit, 4);
assert.equal(container.children.length, 4);

const secondRow = container.children[2].children[0].children[0];
secondRow.dispatch("click", {});
assert.equal(state.selectedGeneratedImageId, "image-1");
assert.equal(calls.some(call => call[0] === "scroll" && call[1] === "image-1"), true);

console.log("Image history view validation passed.");
