import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import {fileURLToPath} from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const modulePath = path.join(repoRoot, "dashboard", "src", "client", "modules", "dashboard", "media", "studioSidebarFoldouts.js");
const source = await readFile(modulePath, "utf8");
const sidebarStyles = await readFile(path.join(repoRoot, "dashboard", "src", "styles", "shared", "_studio-right-sidebar.scss"), "utf8");
const detailStyles = await readFile(path.join(repoRoot, "dashboard", "src", "styles", "_lists-details.scss"), "utf8");
const cardStyles = await readFile(path.join(repoRoot, "dashboard", "src", "styles", "_cards-components.scss"), "utf8");
const runtimeSource = await readFile(path.join(repoRoot, "dashboard", "src", "client", "modules", "shellRuntimeThemeHelpers.js"), "utf8");
const aiViewSource = await readFile(path.join(repoRoot, "dashboard", "src", "pageSections", "aiView.ts"), "utf8");

class TestElement {
  constructor({id = "", classes = [], children = {}} = {}) {
    this.id = id;
    this.textContent = "";
    this.classList = {contains: name => classes.includes(name), add() {}, toggle() {}};
    this.childrenBySelector = children;
    this.parentElement = null;
  }

  querySelector(selector) {
    return this.childrenBySelector[selector] || null;
  }

  querySelectorAll() {
    return [];
  }
}

class TestDetailsElement extends TestElement {}
const context = vm.createContext({
  HTMLElement: TestElement,
  HTMLDetailsElement: TestDetailsElement,
  document: {querySelectorAll: () => [], body: null},
  window: {setTimeout() {}},
  requestAnimationFrame() {},
  MutationObserver: undefined
});
vm.runInContext(`${source}\nthis.createFoldouts = createDashboardStudioSidebarFoldouts;`, context, {filename: modulePath});
const foldouts = context.createFoldouts({setupSplitPanes() {}});

assert.equal(foldouts.getTitle("image-sidebar-panel", new TestElement({id: "image-sidebar-advanced-stack"})), "Image Tools");
assert.equal(foldouts.getTitle("video-sidebar-panel", new TestElement({classes: ["video-queue-panel"]})), "Generation Queue");
assert.equal(foldouts.getTitle("audio-sidebar-panel", new TestElement({classes: ["audio-preview-card"]})), "Latest Preview");

const label = new TestElement();
label.textContent = "Custom Controls";
assert.equal(foldouts.getTitle("image-sidebar-panel", new TestElement({children: {":scope > label": label}})), "Custom Controls");

assert.equal(foldouts.isInitiallyOpen("image-sidebar-panel", "Inspector"), true);
assert.equal(foldouts.isInitiallyOpen("image-sidebar-panel", "Image Tools"), false);
assert.equal(foldouts.isInitiallyOpen("model3d-sidebar-panel", "Model Variants"), true);
assert.equal(foldouts.isInitiallyOpen("ask-rod-sidebar-panel", "Models"), true);
assert.equal(foldouts.isInitiallyOpen("video-sidebar-panel", "Generation Queue"), false);
assert.equal(foldouts.isInitiallyOpen("anything", "Status"), true);
assert.match(source, /data-sidebar-foldout-generated='true'/);
assert.match(source, /sidebarFoldoutToggleBound/);
assert.match(aiViewSource, /class="studio-side-foldout chat-sidebar-foldout"/);
assert.equal((aiViewSource.match(/data-studio-inspector-panel="true"/g) || []).length, 6);
assert.match(aiViewSource, /<summary><span>Personality \+ Memory<\/span><small>SOUL\.md and USER\.md<\/small><\/summary>/);
assert.match(aiViewSource, /<summary><span>Recent Generated Media<\/span><small>Outputs<\/small><\/summary>/);
assert.doesNotMatch(aiViewSource, /class="resources-foldout-body ask-personality-body"/);

assert.match(sidebarStyles, /#ask-rod-sidebar-panel\[data-studio-sidebar-relocated="true"\]\s*\{[\s\S]*?display:\s*flex\s*!important;[\s\S]*?overflow-y:\s*auto\s*!important;/);
assert.match(sidebarStyles, /#ask-rod-sidebar-panel\[data-studio-sidebar-relocated="true"\]\s*>\s*\.studio-side-foldout\s*>\s*summary\s*\{[\s\S]*?flex:\s*0 0 auto\s*!important;/);
assert.match(detailStyles, /\.studio-right-sidebar\s*\{[\s\S]*?grid-template-rows:\s*auto minmax\(0,\s*1fr\) auto auto;/);
assert.match(sidebarStyles, /\.studio-sidebar-actions\s*\{[\s\S]*?minmax\(min\(100%,\s*140px\),\s*1fr\)/);
assert.match(runtimeSource, /rightSidebar\s*=\s*sidebarHost\?\.closest\("\.studio-right-sidebar"\)/);
assert.match(runtimeSource, /structuralNodes\.forEach\([\s\S]*?setStudioRightSidebarRuntimeStyle\(node,\s*"overflow-y",\s*"hidden"\)/);

console.log("Studio sidebar foldout validation passed.");
