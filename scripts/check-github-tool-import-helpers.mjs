import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import {fileURLToPath} from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const modulePath = path.join(repoRoot, "dashboard", "src", "client", "modules", "dashboard", "tools", "githubToolImportHelpers.js");
const source = await readFile(modulePath, "utf8");
const runtime = vm.createContext({});
vm.runInContext(`${source}\nthis.createImporter = createDashboardGithubToolImportHelpers;`, runtime, {filename: modulePath});

function createNode() {
  const listeners = new Map();
  const classes = new Set(["hidden"]);
  return {
    children: [],
    dataset: {},
    listeners,
    value: "",
    classList: {
      add: value => classes.add(value),
      remove: value => classes.delete(value),
      contains: value => classes.has(value)
    },
    addEventListener: (name, listener) => listeners.set(name, listener),
    append(...children) { this.children.push(...children); },
    appendChild(child) { this.children.push(child); return child; },
    dispatch(name, event = {}) { listeners.get(name)?.(event); }
  };
}

const selectors = [
  "[data-tool-github-import-status]",
  "[data-tool-github-repo-input]",
  "[data-tool-github-type-select]",
  "[data-tool-release-select-row]",
  "[data-tool-github-release-asset-select]",
  "[data-imported-tool-list]",
  "[data-tool-github-import-button]",
  "[data-tool-github-release-button]",
  "[data-tool-github-release-download-selected-button]"
];
const nodes = new Map(selectors.map(selector => [selector, createNode()]));
const repoInput = nodes.get("[data-tool-github-repo-input]");
const typeSelect = nodes.get("[data-tool-github-type-select]");
const releaseSelect = nodes.get("[data-tool-github-release-asset-select]");
const releaseRow = nodes.get("[data-tool-release-select-row]");
const calls = [];
let releaseAttempt = 0;
const importer = runtime.createImporter({
  api: {
    get: async url => {
      calls.push(["get", url]);
      return {imports: []};
    },
    post: async (url, body) => {
      calls.push(["post", url, body]);
      if (url.endsWith("/import")) return {entry: {title: "Example", toolType: "desktop"}};
      releaseAttempt += 1;
      if (releaseAttempt === 1) {
        const error = new Error("Choose an asset.");
        error.payload = {
          error: "Choose an asset.",
          requiresAssetSelection: true,
          release: {tagName: "v1", assets: [{name: "tool.zip", size: 2048}]}
        };
        throw error;
      }
      return {asset: {assetName: "tool.exe", downloadPath: "C:\\Tools\\tool.exe", autoPinnable: true}};
    }
  },
  createElement: createNode,
  getFileExtension: () => "exe",
  pinTool: toolPath => calls.push(["pin", toolPath]),
  query: selector => nodes.get(selector),
  renderFileIcon: extension => "<icon-" + extension + ">",
  setDesktopStatus: (message, tone) => calls.push(["desktop-status", message, tone])
});

assert.equal(importer.bind(), true);
repoInput.value = "owner/repo";
typeSelect.value = "desktop";
nodes.get("[data-tool-github-import-button]").dispatch("click");
await new Promise(resolve => setTimeout(resolve, 0));
assert.equal(nodes.get("[data-tool-github-import-status]").textContent, "Imported Example.");
assert.equal(repoInput.value, "");

repoInput.value = "owner/repo";
nodes.get("[data-tool-github-release-button]").dispatch("click");
await new Promise(resolve => setTimeout(resolve, 0));
assert.equal(releaseRow.classList.contains("hidden"), false);
assert.equal(releaseSelect.children[0].textContent, "tool.zip (2 KB)");
assert.equal(releaseSelect.dataset.releaseName, "v1");

releaseSelect.value = "tool.zip";
nodes.get("[data-tool-github-release-download-selected-button]").dispatch("click");
await new Promise(resolve => setTimeout(resolve, 0));
assert.equal(calls.some(call => call[0] === "pin" && call[1] === "C:\\Tools\\tool.exe"), true);
assert.match(nodes.get("[data-tool-github-import-status]").textContent, /pinned it/);

console.log("GitHub tool import validation passed.");
