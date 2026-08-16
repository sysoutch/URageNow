import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import {fileURLToPath} from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const modulePath = path.join(repoRoot, "dashboard", "src", "client", "modules", "dashboard", "media", "videoBottomDockHelpers.js");
const presenterPath = path.join(repoRoot, "dashboard", "src", "client", "modules", "dashboard", "media", "generationQueuePresenter.js");
const [source, presenterSource] = await Promise.all([
  readFile(modulePath, "utf8"),
  readFile(presenterPath, "utf8")
]);
const runtime = vm.createContext({});
vm.runInContext(`${presenterSource}\n${source}\nthis.createDock = createDashboardVideoBottomDockHelpers;`, runtime, {filename: modulePath});

function createNode(tagName = "div") {
  const listeners = new Map();
  return {
    tagName,
    children: [],
    attributes: new Map(),
    classList: {contains: () => false},
    dataset: {},
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
status.textContent = "";
const statusState = createNode();
const nodes = new Map([
  ["video-bottom-filmstrip", filmstrip],
  ["video-bottom-queue-list", queue],
  ["videogen-status", status],
  ["videogen-status-state", statusState]
]);
const entry = {
  id: "video-1",
  videoFileName: "clip.mp4",
  prompt: "orbiting camera",
  frames: 150,
  fps: 30,
  createdAt: "2026-07-24T00:00:00.000Z"
};
const state = {
  generatedVideos: [entry],
  selectedGeneratedVideoId: "",
  selectedGeneratedVideoIds: []
};
const calls = [];
const observer = {observe: node => calls.push(["observe", node])};
const dock = runtime.createDock({
  state,
  createElement: createNode,
  getElementById: id => nodes.get(id),
  clearChildren: node => { node.children = []; },
  formatDateTime: () => "today",
  getLazyObserver: () => observer,
  getVideoUrl: (id, fileName) => "/videos/" + id + "/" + fileName,
  multiSelection: {
    handleSelectionClick({id}) {
      state.selectedGeneratedVideoId = id;
      state.selectedGeneratedVideoIds = [id];
    },
    isSelected: (_selectionKey, selectedId, id) => selectedId === id,
    pruneSelection: () => calls.push(["prune"])
  },
  recentMedia: {
    appendGroupHeading(container, label, count) {
      const heading = createNode("heading");
      heading.textContent = label + ":" + count;
      container.appendChild(heading);
    },
    filterEntries: entries => entries,
    groupEntries: entries => [{label: "Prompt", entries}],
    renderControls: (_id, options) => calls.push(["controls", options.key])
  },
  renderHistory: () => calls.push(["history"]),
  unobserveMedia: container => calls.push(["unobserve", container])
});

assert.equal(dock.getDurationLabel(entry), "5s");
assert.equal(dock.getDurationLabel({durationSeconds: 7}), "7s");
assert.equal(dock.getDurationLabel({}), "Video");
assert.equal(dock.renderFilmstrip(), true);
assert.equal(filmstrip.children.length, 2);
const card = filmstrip.children[1];
const thumb = card.children[0];
assert.equal(thumb.dataset.src, "/videos/video-1/clip.mp4");
assert.equal(thumb.src, undefined);
assert.equal(calls.some(call => call[0] === "observe" && call[1] === thumb), true);
assert.equal(card.children[2].textContent, "5s - today");
card.dispatch("click");
assert.equal(state.selectedGeneratedVideoId, "video-1");
assert.equal(calls.some(call => call[0] === "history"), true);

assert.equal(dock.renderQueue(), true);
assert.equal(queue.children[0].className, "studio-generation-queue-item video-queue-item studio-component-empty-state");
assert.equal(queue.children[0].children[1].textContent, "No active video jobs.");
assert.equal(queue.children[0].children[1].children[0].textContent, "Queue is clear");

console.log("Video bottom dock validation passed.");
