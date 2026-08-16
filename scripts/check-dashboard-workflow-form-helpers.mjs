import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

const repoRoot = process.cwd();
const helperPath = path.join(repoRoot, "dashboard", "src", "client", "modules", "dashboard", "media", "workflowFormHelpers.js");
const source = await fs.readFile(helperPath, "utf8");
const nodes = new Map();

class TestEvent {
  constructor(type, options) {
    this.type = type;
    this.bubbles = options?.bubbles === true;
  }
}

function createInput(id, initialValue = "") {
  const listeners = new Map();
  const node = {
    id,
    value: initialValue,
    checked: false,
    events: [],
    addEventListener(type, listener) {
      const entries = listeners.get(type) || [];
      entries.push(listener);
      listeners.set(type, entries);
    },
    dispatchEvent(event) {
      this.events.push(event.type);
      (listeners.get(event.type) || []).forEach(listener => listener(event));
      return true;
    }
  };
  nodes.set(id, node);
  return node;
}

const context = vm.createContext({
  console,
  Event: TestEvent,
  document: {getElementById: id => nodes.get(id) || null}
});
vm.runInContext(`${source}\nglobalThis.createHelpers = createDashboardWorkflowFormHelpers;`, context, {filename: helperPath});
const helpers = context.createHelpers();

createInput("integer", "42");
createInput("float", "3.75");
createInput("clamped", "99");
assert.equal(helpers.readOptionalNumberInput("integer"), 42);
assert.equal(helpers.readOptionalNumberInput("float", {float: true}), 3.75);
assert.equal(helpers.readOptionalNumberInput("clamped", {min: 1, max: 8}), 8);
assert.equal(helpers.readOptionalNumberInput("missing"), undefined);
assert.deepEqual({...helpers.parseResolutionValue("1920x1080")}, {width: 1920, height: 1080});
assert.equal(helpers.parseResolutionValue("invalid"), null);

const valueInput = createInput("value");
helpers.setInputValue("value", 128);
assert.equal(valueInput.value, "128");
assert.deepEqual(valueInput.events, ["input", "change"]);

const checkbox = createInput("checkbox");
helpers.setCheckboxValue("checkbox", true);
assert.equal(checkbox.checked, true);
assert.deepEqual(checkbox.events, ["input", "change"]);

const first = createInput("first", "2");
const second = createInput("second", "1");
helpers.bindMirroredNumberInputs("first", "second");
first.value = "6";
first.dispatchEvent(new TestEvent("input", {bubbles: true}));
assert.equal(second.value, "6");

console.log("Dashboard workflow form helper validation passed.");
