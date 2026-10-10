import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../dashboard/src/client/modules/workspacePanelHelpers.js", import.meta.url), "utf8");

class MockElement {
  constructor(subview) {
    this.subview = subview;
    this.dataset = {};
    this.active = false;
    this.hidden = false;
    this.classList = {
      toggle: (name, enabled) => {
        if (name === "active") this.active = enabled;
        if (name === "hidden-by-subview") this.hidden = enabled;
      }
    };
  }

  closest(selector) {
    return selector === "[data-subview]" && this.subview ? this : null;
  }

  getAttribute(name) {
    return name === "data-subview" || name === "data-subview-panel" ? this.subview : null;
  }
}

const buttons = [new MockElement("guild-overview"), new MockElement("guild-commands")];
const panels = [new MockElement("guild-overview"), new MockElement("guild-commands")];
const document = {
  documentElement: { dataset: {} },
  listeners: new Map(),
  addEventListener(name, listener) { this.listeners.set(name, listener); },
  querySelectorAll(selector) {
    if (selector === "[data-subview]") return buttons;
    if (selector === "[data-subview-panel]") return panels;
    return [];
  }
};
const context = vm.createContext({ document, Element: MockElement, window: { innerWidth: 1600 } });
vm.runInContext(source, context);

assert.equal(document.listeners.size, 1, "subview clicks should bind before dashboard startup");
document.listeners.get("click")({ target: buttons[1], preventDefault() {} });
assert.equal(buttons[1].active, true);
assert.equal(panels[1].hidden, false);

const state = {};
const helpers = context.createDashboardWorkspacePanelHelpers({ state, setDetailsPaneVisible() {} });
assert.equal(state.guildSubview, "guild-commands", "an early click should survive later dashboard startup");
helpers.bindSubviewTabs();
helpers.bindSubviewTabs();
assert.equal(document.listeners.size, 1, "subview click handler should only bind once");

let prevented = false;
document.listeners.get("click")({ target: buttons[1], preventDefault() { prevented = true; } });
assert.equal(prevented, true);
assert.equal(state.guildSubview, "guild-commands");
assert.equal(buttons[1].active, true);
assert.equal(buttons[0].active, false);
assert.equal(panels[1].hidden, false);
assert.equal(panels[0].hidden, true);

console.log("Guild subview tabs delegate clicks and activate their matching panels.");
