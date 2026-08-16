import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import {fileURLToPath} from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const modulePath = path.join(repoRoot, "dashboard", "src", "client", "modules", "dashboard", "tools", "pinnedDesktopToolListHelpers.js");
const source = await readFile(modulePath, "utf8");
const runtime = vm.createContext({encodeURIComponent});
vm.runInContext(`${source}\nthis.createPinnedList = createDashboardPinnedDesktopToolListHelpers;`, runtime, {filename: modulePath});

function createNode(tagName) {
  const listeners = new Map();
  return {
    tagName,
    children: [],
    listeners,
    append(...children) { this.children.push(...children); },
    appendChild(child) { this.children.push(child); return child; },
    addEventListener: (name, listener) => listeners.set(name, listener),
    click() { listeners.get("click")?.(); }
  };
}

const list = createNode("section");
let tools = [];
const calls = [];
const controller = runtime.createPinnedList({
  api: {
    post: async (url, body) => {
      calls.push(["post", url, body.toolPath]);
      if (body.toolPath.includes("broken")) throw new Error("Launch failed.");
    }
  },
  createElement: createNode,
  getFileExtension: toolPath => toolPath.split(".").pop().toLowerCase(),
  getList: () => list,
  getToolName: toolPath => toolPath.split(/[\\/]/).pop(),
  renderFileIcon: extension => "<icon-" + extension + ">",
  setStatus: (message, tone) => calls.push(["status", message, tone]),
  store: {
    pin(toolPath) {
      calls.push(["pin", toolPath]);
      tools = [{id: "one", title: "Tool", path: toolPath}];
    },
    read: () => tools,
    remove(toolId) {
      calls.push(["remove", toolId]);
      tools = [];
    }
  }
});

assert.equal(controller.render(), true);
assert.equal(list.children.at(-1).textContent, "No desktop tools pinned yet.");

controller.pin("C:\\Tools\\run.sh");
assert.deepEqual(calls.at(-1), ["status", "Desktop tool pinned.", "ok"]);
const card = list.children.at(-1);
assert.equal(card.className, "desktop-tool-card");
assert.equal(card.children[0].innerHTML, "<icon-sh>");
assert.equal(card.children[1].children[0].textContent, "Tool");

const actions = card.children[2];
actions.children[0].click();
await new Promise(resolve => setTimeout(resolve, 0));
assert.equal(calls.some(call => call[0] === "post" && call[2] === "C:\\Tools\\run.sh"), true);
assert.equal(calls.some(call => call[0] === "status" && call[1] === "Launched run.sh."), true);

actions.children[1].click();
assert.equal(calls.some(call => call[0] === "remove" && call[1] === "one"), true);
assert.equal(list.children.at(-1).textContent, "No desktop tools pinned yet.");

tools = [{id: "broken", title: "Broken", path: "C:\\Tools\\broken.sh"}];
controller.render();
list.children.at(-1).children[2].children[0].click();
await new Promise(resolve => setTimeout(resolve, 0));
assert.equal(calls.some(call => call[0] === "status" && call[1] === "Launch failed." && call[2] === "error"), true);

console.log("Pinned desktop tool list validation passed.");
