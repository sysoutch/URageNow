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
  "latestMediaViewHelpers.js"
);
const source = await readFile(modulePath, "utf8");
const runtime = vm.createContext({});
vm.runInContext(`${source}\nthis.createLatestMedia = createDashboardLatestMediaViewHelpers;`, runtime, {filename: modulePath});

function createNode(tagName = "div") {
  const listeners = new Map();
  const classes = new Set();
  return {
    tagName,
    children: [],
    attributes: new Map(),
    classList: {add: className => classes.add(className), contains: className => classes.has(className)},
    append(...children) { this.children.push(...children); },
    appendChild(child) { this.children.push(child); return child; },
    addEventListener(name, listener) { listeners.set(name, listener); },
    setAttribute(name, value) { this.attributes.set(name, value); },
    dispatch(name, event = {}) { return listeners.get(name)?.(event); }
  };
}

const containers = new Map([
  "image-latest-gif-list",
  "image-latest-video-list",
  "video-latest-gif-list",
  "ask-latest-gif-list",
  "video-latest-image-list",
  "ask-latest-image-list",
  "ask-latest-video-list",
  "ask-latest-audio-list"
].map(id => [id, createNode("section")]));
const state = {
  generatedImages: [
    {id: "image-gif", imageFileName: "generated.gif", createdAt: "2026-07-23T10:00:00.000Z"},
    {id: "image-png", imageFileName: "still.png", createdAt: "2026-07-22T10:00:00.000Z"}
  ],
  generatedVideos: [
    {id: "video-1", videoFileName: "clip.mp4", createdAt: "2026-07-23T11:00:00.000Z"}
  ],
  generatedAudios: [
    {id: "audio-1", audioFileName: "song.mp3", mode: "music", createdAt: "2026-07-23T12:00:00.000Z"}
  ],
  mediaConverterGifs: [
    {jobId: "job-1", fileName: "converted.gif", url: "/converted.gif", createdAt: "2026-07-24T10:00:00.000Z"}
  ]
};
const calls = [];
let latestVideos = [{
  videoId: "video-1",
  fileName: "clip.mp4",
  url: "/videos/video-1/clip.mp4",
  createdAt: "2026-07-23T11:00:00.000Z",
  source: "Generated"
}];
const latestMedia = runtime.createLatestMedia({
  state,
  createElement: createNode,
  getContainer: id => containers.get(id),
  attachLazyMedia: (node, url) => { node.src = url; },
  buildAbsoluteUrl: url => "https://dashboard.test" + url,
  clearChildren: node => { node.children = []; },
  formatDateTime: value => "date:" + value,
  getAudioUrl: (id, fileName) => "/audio/" + id + "/" + fileName,
  getImageUrl: (id, fileName) => "/images/" + id + "/" + fileName,
  getLatestVideoEntries: () => latestVideos,
  getVideoUrl: (id, fileName) => "/videos/" + id + "/" + fileName,
  onDeleteImages: entries => calls.push(["delete-images", entries.map(entry => entry.id)]),
  onDeleteVideos: entries => calls.push(["delete-videos", entries.map(entry => entry.id)]),
  onOpenFocusViewer: entry => calls.push(["focus", entry.fileName]),
  onShowGif: entry => calls.push(["show-gif", entry.fileName]),
  onShowVideo: entry => calls.push(["show-video", entry.fileName]),
  onUseImageAsVideoSource: entry => calls.push(["use-image", entry.id]),
  unobserveMedia: node => calls.push(["unobserve", node])
});

assert.deepEqual(
  Array.from(latestMedia.getLatestGifEntries(), entry => entry.fileName),
  ["converted.gif", "generated.gif"]
);
latestMedia.render();

const imageGifCards = containers.get("image-latest-gif-list").children;
assert.equal(imageGifCards.length, 2);
assert.equal(imageGifCards[0].children[0].src, "https://dashboard.test/converted.gif");
const generatedGifCard = imageGifCards[1];
generatedGifCard.dispatch("click", {preventDefault() {}});
generatedGifCard.dispatch("dblclick", {preventDefault() {}});
assert.equal(calls.filter(call => call[0] === "show-gif").length, 2);
assert.equal(calls.some(call => call[0] === "focus" && call[1] === "generated.gif"), true);
const gifDeleteEvent = {
  preventDefault() { this.prevented = true; },
  stopPropagation() { this.stopped = true; }
};
generatedGifCard.children[1].dispatch("keydown", {...gifDeleteEvent, key: "Enter"});
assert.equal(calls.some(call => call[0] === "delete-images" && call[1][0] === "image-gif"), true);

const videoCard = containers.get("image-latest-video-list").children[0];
videoCard.dispatch("click", {preventDefault() {}});
videoCard.children[1].dispatch("click", {preventDefault() {}, stopPropagation() {}});
assert.equal(calls.some(call => call[0] === "show-video" && call[1] === "clip.mp4"), true);
assert.equal(calls.some(call => call[0] === "delete-videos" && call[1][0] === "video-1"), true);

containers.get("video-latest-image-list").children[0].dispatch("click", {preventDefault() {}});
assert.equal(calls.some(call => call[0] === "use-image" && call[1] === "image-gif"), true);
assert.equal(containers.get("ask-latest-image-list").children.length, 2);
assert.equal(containers.get("ask-latest-video-list").children.length, 1);
const audioRow = containers.get("ask-latest-audio-list").children[0];
assert.equal(audioRow.href, "/audio/audio-1/song.mp3");
assert.equal(audioRow.children[0].textContent, "MUS");

state.generatedImages = [];
state.generatedVideos = [];
state.generatedAudios = [];
state.mediaConverterGifs = [];
latestVideos = [];
latestMedia.render();
assert.equal(containers.get("image-latest-gif-list").children[0].textContent, "No GIFs yet.");
assert.equal(containers.get("image-latest-video-list").children[0].textContent, "No videos yet.");
assert.equal(containers.get("video-latest-image-list").children[0].textContent, "No images yet.");
assert.equal(containers.get("ask-latest-audio-list").children[0].textContent, "No audio or music yet.");

console.log("Latest media view validation passed.");
