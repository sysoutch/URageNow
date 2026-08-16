import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import {fileURLToPath} from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspacePath = path.join(
  repoRoot,
  "dashboard",
  "src",
  "client",
  "modules",
  "dashboard",
  "image",
  "editSourceWorkspace.js"
);
const workspaceSource = await readFile(workspacePath, "utf8");
const mediaSource = await readFile(
  path.join(repoRoot, "dashboard", "src", "client", "modules", "aiMediaStudioHelpers.js"),
  "utf8"
);
const aiViewSource = await readFile(
  path.join(repoRoot, "dashboard", "src", "pageSections", "aiView.ts"),
  "utf8"
);
const focusedStyles = await readFile(
  path.join(repoRoot, "dashboard", "src", "styles", "studio", "_focused-workflow.scss"),
  "utf8"
);
const focusedResponsiveStyles = await readFile(
  path.join(repoRoot, "dashboard", "src", "styles", "studio", "_focused-workflow-responsive.scss"),
  "utf8"
);
const runtime = vm.createContext({});
vm.runInContext(
  `${workspaceSource}\nthis.createWorkspace = createDashboardImageEditSourceWorkspace;`,
  runtime,
  {filename: workspacePath}
);

assert.doesNotMatch(mediaSource, /const imageEditSourceState/);
assert.doesNotMatch(mediaSource, /function renderImageEditSourcePreview/);
assert.match(mediaSource, /imageEditSourceWorkspace\.bind\(\{bind, bindDropzone, clickInput\}\)/);
const workspaceAssembly = mediaSource.slice(
  mediaSource.indexOf("const imageEditSourceWorkspace"),
  mediaSource.indexOf("const imageObjectPrompts")
);
assert.doesNotMatch(workspaceAssembly, /\n\s+(?:bind|bindDropzone|clickInput),/);
for (const styles of [focusedStyles, focusedResponsiveStyles]) {
  assert.doesNotMatch(
    styles,
    /image-studio-edit-mode #image-studio-panel-edit\.active\s*\{[^}]*overflow-y:\s*auto/is,
    "The Edit panel must flow inside the prompt card instead of creating a nested scrollbar."
  );
  assert.doesNotMatch(
    styles,
    /image-studio-edit-mode \.image-studio-workspace\s*\{[^}]*0\.42fr/is,
    "Edit mode must not split the left sidebar into independently scrolling grid rows."
  );
}
assert.match(
  focusedStyles,
  /\.image-studio-left-sidebar\s*\{[^}]*grid-row:\s*1\s*\/\s*-1[^}]*overflow-y:\s*auto/is,
  "The shared focused left-sidebar wrapper should own the only vertical scrollbar."
);
assert.match(
  aiViewSource,
  /image-studio-left-sidebar[\s\S]*image-prompt-card[\s\S]*image-studio-panel-edit[\s\S]*image-advanced-stack/,
  "The prompt builder and Edit workspace should share one left-sidebar scroll container."
);

function createNode(properties = {}) {
  const classes = new Set();
  return {
    checked: properties.checked === true,
    textContent: "",
    value: properties.value || "",
    classList: {
      contains: className => classes.has(className),
      toggle(className, force) {
        if (force) classes.add(className);
        else classes.delete(className);
      }
    }
  };
}

const urlInput = createNode();
const batchToggle = createNode();
const previewEmpty = createNode();
const previewName = createNode();
const previewDetail = createNode();
const batchControls = createNode();
const elements = new Map([
  ["image-edit-source-url", urlInput],
  ["image-edit-batch-enabled", batchToggle],
  ["image-edit-source-preview-empty", previewEmpty],
  ["image-edit-source-preview-name", previewName],
  ["image-edit-source-preview-detail", previewDetail],
  ["image-edit-batch-controls", batchControls]
]);
let nextId = 0;
let previewSyncs = 0;
const workspace = runtime.createWorkspace({
  appState: {imagePools: []},
  buildAbsoluteDashboardUrl: value => `http://dashboard.local${value}`,
  clearChildren() {},
  createBatchItemState: () => ({selected: true, runState: "idle", runMessage: ""}),
  createId: () => `source-${++nextId}`,
  escapeHtml: value => String(value),
  getElementById: id => elements.get(id) || null,
  getImagePoolById: () => null,
  moveListEntryById: items => items,
  readFileAsDataUrl: async () => "",
  setOutput() {},
  syncPreviewTarget: () => { previewSyncs += 1; }
});

workspace.addSources([
  {value: "https://example.com/first.png"},
  {value: "/api/generated-images/model/second.png"}
]);
assert.equal(workspace.getActive().fileNameHint, "first.png");
assert.equal(urlInput.value, "https://example.com/first.png");
assert.equal(workspace.getExecutionSources().length, 1);
assert.equal(previewName.textContent, "first.png");

batchToggle.checked = true;
workspace.setAllSelections(false);
assert.equal(workspace.getExecutionSources().length, 0);
workspace.setAllSelections(true);
assert.equal(workspace.getExecutionSources().length, 2);
workspace.updateRunState("source-1", "success", "Saved.");
assert.equal(workspace.getActive().batchState.runState, "success");
assert.ok(previewSyncs >= 4);

workspace.clear();
assert.equal(workspace.getActive(), null);
assert.equal(urlInput.value, "");
assert.equal(previewEmpty.textContent, "No source image selected.");

console.log("Image edit source workspace validation passed.");
