import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import {fileURLToPath} from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const modulePath = path.join(repoRoot, "dashboard", "src", "client", "modules", "dashboard", "tools", "desktopToolPinStoreHelpers.js");
const source = await readFile(modulePath, "utf8");
const runtime = vm.createContext({});
vm.runInContext(`${source}\nthis.createPinStore = createDashboardDesktopToolPinStoreHelpers;`, runtime, {filename: modulePath});

const values = new Map();
const storage = {
  getItem: key => values.get(key) || null,
  setItem: (key, value) => values.set(key, value)
};
let nextId = 0;
const store = runtime.createPinStore({
  storage,
  storageKey: "pinned",
  maximumTools: 2,
  createId: () => "tool-" + (++nextId),
  getTimestamp: () => "2026-07-23T00:00:00.000Z",
  getToolName: toolPath => toolPath.split(/[\\/]/).pop(),
  isAbsolutePath: toolPath => /^[a-z]:\\/i.test(toolPath),
  isSupportedPath: toolPath => /\.(exe|bat)$/i.test(toolPath)
});

assert.deepEqual(Array.from(store.read()), []);
assert.throws(() => store.pin(""), /Choose or paste/);
assert.throws(() => store.pin("tool.exe"), /absolute path/);
assert.throws(() => store.pin("C:\\Tools\\notes.txt"), /not supported/);

store.pin("C:\\Tools\\One.exe");
store.pin("C:\\Tools\\Two.bat");
store.pin("c:\\tools\\one.exe");
assert.deepEqual(Array.from(store.read(), tool => tool.id), ["tool-2", "tool-1"]);
assert.equal(store.read()[1].title, "One.exe");
assert.equal(store.read()[1].pinnedAt, "2026-07-23T00:00:00.000Z");

store.pin("C:\\Tools\\Three.exe");
assert.deepEqual(Array.from(store.read(), tool => tool.id), ["tool-3", "tool-2"]);
store.remove("tool-2");
assert.deepEqual(Array.from(store.read(), tool => tool.id), ["tool-3"]);

values.set("pinned", "{broken json");
assert.deepEqual(Array.from(store.read()), []);

console.log("Desktop tool pin store validation passed.");
