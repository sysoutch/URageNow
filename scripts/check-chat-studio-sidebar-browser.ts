import assert from "node:assert/strict";
import {chromium} from "playwright";
import type {DashboardDependencies} from "@urage/shared/dashboard/types";
import {RuntimeState} from "@urage/server/runtime/runtimeState";
import {startDashboardServer} from "@urage/dashboard/server";

const dependencies = {
  port: 0,
  host: "127.0.0.1",
  runtimeState: new RuntimeState(),
  saveDashboardSettings: async () => {},
  setLlmConnectionSettings: () => {},
  getMessengerRuntimeSnapshot: () => ({runtimes: [], events: []}),
  controlMessengerRuntime: async () => {
    throw new Error("Messenger runtime control is unavailable in the Chat sidebar check.");
  },
  getBotSnapshot: () => ({
    id: null,
    tag: null,
    avatarUrl: null,
    guildCount: 0,
    startedAt: new Date().toISOString(),
    dashboardPort: 0
  })
} as unknown as DashboardDependencies;

const server = startDashboardServer(dependencies);
const browser = await chromium.launch({headless: true});

try {
  await server.ready;
  const address = server.address();
  assert.ok(address);
  const page = await browser.newPage({viewport: {width: 1280, height: 760}});
  await page.route("**/api/**", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: "{}"
  }));
  await page.goto(`http://${address.address}:${address.port}`, {waitUntil: "domcontentloaded"});

  await page.evaluate(() => {
    const trigger = [...document.querySelectorAll<HTMLElement>('[data-ai-scroll-target="ask-rod-card"]')]
      .find(node => node.offsetParent !== null);
    if (!trigger) throw new Error("No visible Chat Studio navigation trigger exists.");
    trigger.click();
  });
  const sidebar = page.locator("#ask-rod-sidebar-panel");
  await sidebar.waitFor({state: "attached", timeout: 5_000});
  const sidebarDisplay = await sidebar.evaluate(element => ({
    display: getComputedStyle(element).display,
    visibility: getComputedStyle(element).visibility,
    inlineDisplay: element.style.display,
    parentClass: element.parentElement?.className || ""
  }));
  assert.notEqual(sidebarDisplay.display, "none", `Chat inspector is hidden: ${JSON.stringify(sidebarDisplay)}`);
  await page.waitForFunction(() => {
    const panel = document.getElementById("ask-rod-sidebar-panel");
    return Boolean(panel && !panel.closest(".details-pane") && panel.dataset.studioSidebarRelocated !== "true");
  }, undefined, {timeout: 5_000});

  const chatTabs = page.locator("#ask-chat-tabs");
  const [sidebarBox, chatTabsBox] = await Promise.all([sidebar.boundingBox(), chatTabs.boundingBox()]);
  assert.ok(sidebarBox && sidebarBox.width > 180, "Chat inspector must remain visible in its workflow-local sidebar.");
  assert.ok(chatTabsBox && chatTabsBox.width >= 44, "Chat conversation tabs must remain a visible left rail.");
  const chatMainBox = await page.locator("#ask-rod-card .ask-rod-main").boundingBox();
  assert.ok(chatTabsBox && chatMainBox && chatTabsBox.x + chatTabsBox.width <= chatMainBox.x,
    "Desktop Chat conversation tabs must remain in the second left rail, before the conversation workspace.");

  const foldouts = sidebar.locator(":scope > .chat-sidebar-foldout");
  assert.equal(await foldouts.count(), 6);
  assert.equal(await foldouts.locator(":scope > .studio-side-foldout-content").count(), 6);

  await foldouts.evaluateAll(nodes => nodes.forEach(node => {
    (node as HTMLDetailsElement).open = true;
    node.dispatchEvent(new Event("toggle"));
  }));
  const overflow = await sidebar.evaluate(element => ({
    overflowY: getComputedStyle(element).overflowY,
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight
  }));
  assert.match(overflow.overflowY, /auto|scroll/);

  const saveButton = sidebar.locator("#ask-personality-save-button");
  await saveButton.scrollIntoViewIfNeeded();
  const [currentSidebarBox, saveBox] = await Promise.all([sidebar.boundingBox(), saveButton.boundingBox()]);
  assert.ok(currentSidebarBox && saveBox);
  assert.ok(saveBox.x >= currentSidebarBox.x && saveBox.x + saveBox.width <= currentSidebarBox.x + currentSidebarBox.width + 1,
    `Chat sidebar actions must remain within the sidebar border: sidebar=${JSON.stringify(currentSidebarBox)}, save=${JSON.stringify(saveBox)}`);
  assert.ok(saveBox.height >= 38, "Chat sidebar actions must retain a usable hit target.");

  const summaryHeights = await foldouts.locator(":scope > summary").evaluateAll(nodes =>
    nodes.map(node => Math.round(node.getBoundingClientRect().height))
  );
  assert.ok(Math.max(...summaryHeights) - Math.min(...summaryHeights) <= 2,
    `Chat accordion headers should use one consistent height: ${summaryHeights.join(", ")}.`);

  await page.waitForFunction(() => document.fonts.check("16px bootstrap-icons"));

  assert.equal(await page.locator(".details-pane:visible [data-studio-right-sidebar]:not(.hidden)").count(), 0,
    "Studio inspector content must not be rendered inside the global Messenger/Discord details pane.");

  await page.setViewportSize({width: 900, height: 760});
  await sidebar.waitFor({state: "visible", timeout: 5_000});
  const narrowSidebarBox = await sidebar.boundingBox();
  assert.ok(narrowSidebarBox && narrowSidebarBox.width > 180,
    "Narrow Studio layouts must keep the workflow-local inspector reachable in normal flow.");
  assert.equal(await page.locator(".details-pane:visible [data-studio-right-sidebar]:not(.hidden)").count(), 0,
    "Narrow Studio layouts must not create a global inspector drawer.");
} finally {
  await browser.close();
  await server.close();
}

console.log("Chat Studio sidebar browser validation passed.");
