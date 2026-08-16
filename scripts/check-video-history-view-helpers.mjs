import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import {fileURLToPath} from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const modulePath = path.join(repoRoot, "dashboard", "src", "client", "modules", "dashboard", "media", "videoHistoryViewHelpers.js");
const source = await readFile(modulePath, "utf8");
const runtime = vm.createContext({});
vm.runInContext(`${source}\nthis.createHistory = createDashboardVideoHistoryViewHelpers;`, runtime, {filename: modulePath});

function createNode(tagName = "div") {
  const listeners = new Map();
  return {
    tagName,
    children: [],
    attributes: new Map(),
    dataset: {},
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
  id: "video-" + index,
  videoFileName: "video-" + index + ".mp4",
  createdAt: "2026-07-24T00:00:00.000Z"
}));
const state = {
  generatedVideos: entries,
  videoHistoryVisibleLimit: 2,
  selectedGeneratedVideoId: "video-0",
  selectedGeneratedVideoIds: ["video-0", "video-1"]
};
const calls = [];
const observer = {observe: node => calls.push(["observe", node])};
const history = runtime.createHistory({
  state,
  initialLimit: 2,
  createElement: createNode,
  getContainer: () => container,
  clearChildren: node => { node.children = []; },
  formatDateTime: () => "today",
  getLazyObserver: () => observer,
  getSelectedMany: () => entries.filter(entry => state.selectedGeneratedVideoIds.includes(entry.id)),
  getVideoUrl: (id, fileName) => "/videos/" + id + "/" + fileName,
  multiSelection: {
    handleSelectionClick({id}) {
      state.selectedGeneratedVideoId = id;
      state.selectedGeneratedVideoIds = [id];
    },
    isSelected: (_key, selectedId, id) => selectedId === id,
    pruneSelection: () => calls.push(["prune"])
  },
  onContainerMissing: () => calls.push(["missing"]),
  onDelete: selected => calls.push(["delete", selected.map(entry => entry.id)]),
  onEmpty: () => calls.push(["empty"]),
  onRendered: () => calls.push(["rendered"]),
  onSelected: entry => calls.push(["selected", entry.id]),
  unobserveMedia: node => calls.push(["unobserve", node])
});

assert.equal(history.render(), true);
assert.equal(container.children.length, 4);
assert.equal(container.children[0].className, "media-history-bulk-actions");
const firstRow = container.children[1].children[0];
assert.equal(firstRow.children[0].attributes.get("data-video-id"), "video-0");
const firstThumb = firstRow.children[0].children[0];
assert.equal(firstThumb.dataset.src, "/videos/video-0/video-0.mp4");
assert.equal(calls.some(call => call[0] === "observe" && call[1] === firstThumb), true);

firstRow.children[0].dispatch("click", {});
assert.equal(state.selectedGeneratedVideoId, "video-0");
assert.equal(calls.some(call => call[0] === "selected" && call[1] === "video-0"), true);

const deleteEvent = {
  preventDefault() { this.prevented = true; },
  stopPropagation() { this.stopped = true; }
};
await firstRow.children[1].children[0].dispatch("click", deleteEvent);
assert.equal(deleteEvent.prevented, true);
assert.equal(deleteEvent.stopped, true);
assert.equal(calls.some(call => call[0] === "delete" && call[1][0] === "video-0"), true);

container.children[3].dispatch("click");
assert.equal(state.videoHistoryVisibleLimit, 4);
assert.equal(container.children.length, 3);
assert.equal(calls.some(call => call[0] === "rendered"), true);

state.generatedVideos = [];
state.selectedGeneratedVideoIds = [];
history.render();
assert.equal(container.children[0].textContent, "No generated videos yet.");
assert.equal(calls.some(call => call[0] === "empty"), true);

console.log("Video history view validation passed.");
