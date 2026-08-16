import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import {fileURLToPath} from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const modulePath = path.join(repoRoot, "dashboard", "src", "client", "modules", "dashboard", "media", "studioSidebarSplitLayout.js");
const source = await readFile(modulePath, "utf8");
const storage = new Map();
const context = vm.createContext({
  localStorage: {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value)
  }
});
vm.runInContext(`${source}\nthis.createSplitLayout = createDashboardStudioSidebarSplitLayout;`, context, {filename: modulePath});
const layout = context.createSplitLayout({escapeHtml: value => String(value)});

assert.equal(layout.readHeight("image"), 220);
storage.set("urage-studio-sidebar-bottom-height-image", "314");
assert.equal(layout.readHeight("image"), 314);
storage.set("urage-studio-sidebar-bottom-height-image", "invalid");
assert.equal(layout.readHeight("image"), 220);

function createTarget(kind, value) {
  return {
    value,
    active: false,
    hidden: false,
    getAttribute: name => name === kind ? value : null,
    classList: {
      toggle(name, enabled) {
        if (name === "active") this.owner.active = enabled;
        if (name === "hidden") this.owner.hidden = enabled;
      },
      owner: null
    },
    setAttribute(name, nextValue) {
      if (name === "aria-selected") this.ariaSelected = nextValue;
    }
  };
}

const previewTab = createTarget("data-sidebar-bottom-tab", "preview");
const metaTab = createTarget("data-sidebar-bottom-tab", "meta");
const previewPanel = createTarget("data-sidebar-bottom-panel", "preview");
const metaPanel = createTarget("data-sidebar-bottom-panel", "meta");
[previewTab, metaTab, previewPanel, metaPanel].forEach(target => { target.classList.owner = target; });
const shell = {
  querySelectorAll(selector) {
    return selector === "[data-sidebar-bottom-tab]" ? [previewTab, metaTab] : [previewPanel, metaPanel];
  }
};

layout.setBottomTab(shell, "meta");
assert.equal(previewTab.active, false);
assert.equal(metaTab.active, true);
assert.equal(previewPanel.hidden, true);
assert.equal(metaPanel.hidden, false);
assert.equal(metaTab.ariaSelected, "true");

layout.setBottomTab(shell, "unsupported");
assert.equal(previewTab.active, true);
assert.equal(metaPanel.hidden, true);

console.log("Studio sidebar split layout validation passed.");
