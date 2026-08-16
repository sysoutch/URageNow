import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const modulePath = path.join(repoRoot, "dashboard", "src", "client", "modules", "dashboard", "image", "generationOrchestrator.js");
const mediaPath = path.join(repoRoot, "dashboard", "src", "client", "modules", "aiMediaStudioHelpers.js");
const [moduleSource, mediaSource] = await Promise.all([readFile(modulePath, "utf8"), readFile(mediaPath, "utf8")]);
const elements = new Map([
  ["imagegen-prompt", {value: "A test image"}],
  ["imagegen-prompt-text-file", {value: ""}],
  ["imagegen-prompt-text-no-repeat", {checked: false}],
  ["imagegen-negative-prompt", {value: ""}],
  ["imagegen-auto-prompt", {checked: false}],
  ["imagegen-auto-filename", {checked: false}],
  ["imagegen-auto-description", {checked: true}],
  ["imagegen-auto-filename-timing", {value: "after"}],
  ["image-strip-metadata-storage", {checked: true}]
]);
const runtime = vm.createContext({document: {getElementById: id => elements.get(id) || null}});
vm.runInContext(`${moduleSource}\nthis.createOrchestrator = createDashboardImageGenerationOrchestrator;`, runtime, {filename: modulePath});

const generationDelegate = mediaSource.slice(
  mediaSource.indexOf("function generateImageFromUi(options)"),
  mediaSource.indexOf("function closeImageRegenerateModeModal()")
);
assert.doesNotMatch(generationDelegate, /const generatedPayloads = \[\]/);
assert.match(generationDelegate, /return imageGenerationOrchestrator\.generate\(options\)/);

const calls = [];
const orchestrator = runtime.createOrchestrator({
  app: {
    state: {imageStudioTab: "generate"},
    request: async (route, payload) => {
      calls.push(["request", route, payload]);
      return {id: "image-1", imageFileName: "result.png", prompt: payload.prompt};
    },
    setOutput: message => calls.push(["output", message]),
    refreshState: async () => calls.push(["refresh"]),
    loadBotMessages: async () => calls.push(["messages"]),
    buildAbsoluteDashboardUrl: value => value,
    getGeneratedImageFileUrl: (id, fileName) => `/api/generated/${id}/${fileName}`
  },
  editSources: {getExecutionSources: () => [], resetRunStates() {}, updateRunState() {}},
  form: {readOptionalNumberInput: () => undefined, readGenerateCount: () => 1},
  generation: {
    setStatus: message => calls.push(["status", message]),
    startRequest: () => "request-1",
    finishRequest: (kind, id) => calls.push(["finish", kind, id])
  },
  history: {
    getBatchEntries: payload => [payload],
    load: async id => calls.push(["history", id]),
    scheduleRefresh() {}
  },
  postTargets: {get: () => ({messenger: "", destinationId: ""}), postExternal: async () => {}},
  preview: {
    applyWorkflowDimensions() {},
    applyWorkflowDimensionsFromWorkflow: async () => {},
    setLoading: active => calls.push(["loading", active])
  },
  workflow: {readSeed: () => 42, applySeedAfterGenerate() {}}
});

const result = await orchestrator.generate();
assert.equal(result.id, "image-1");
assert.equal(calls.find(call => call[0] === "request")[2].prompt, "A test image");
assert.equal(calls.find(call => call[0] === "request")[2].autoDescription, true);
assert.deepEqual(calls.filter(call => call[0] === "loading").map(call => call[1]), [true, false]);
assert.ok(calls.some(call => call[0] === "output" && call[1] === "Generated image in Image Studio."));
console.log("Image generation orchestrator validation passed.");
