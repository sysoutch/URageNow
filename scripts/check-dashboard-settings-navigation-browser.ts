import assert from "node:assert/strict";
import {chromium} from "playwright";
import type {DashboardDependencies} from "@urage/shared/dashboard/types";
import {RuntimeState} from "@urage/server/runtime/runtimeState";
import {startDashboardServer} from "@urage/dashboard/server";

const runtimeState = new RuntimeState();
const dependencies = {
  port: 0,
  host: "127.0.0.1",
  runtimeState,
  saveDashboardSettings: async () => {},
  setLlmConnectionSettings: () => {},
  getMessengerRuntimeSnapshot: () => ({runtimes: [], events: []}),
  controlMessengerRuntime: async () => {
    throw new Error("Messenger runtime control is unavailable in the settings navigation check.");
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
  const page = await browser.newPage({viewport: {width: 981, height: 911}});
  await page.route("**/api/**", route => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === "/api/settings/network/access-token/qr.svg") {
      return route.continue();
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "{}"
    });
  });
  await page.goto(`http://${address.address}:${address.port}`, {waitUntil: "domcontentloaded"});
  await page.locator("#rail-settings-button").click();
  await page.locator('[data-settings-tab="network"]').click();
  assert.equal(await page.locator("#settings-overlay-title").textContent(), "Network And Devices");

  for (const tab of ["connection", "remote-access", "devices"]) {
    await page.locator(`[data-network-settings-subtab="${tab}"]`).click();
    const activePanel = page.locator(`[data-network-settings-subpanel="${tab}"]`);
    assert.equal(await activePanel.getAttribute("class"), "network-settings-subpanel active");
    assert.equal(await activePanel.evaluate(element => getComputedStyle(element).display), "grid");
    assert.equal(await page.locator("[data-network-settings-subpanel].active").count(), 1);
  }

  await page.locator('[data-network-settings-subtab="connection"]').click();
  await page.locator("#network-dashboard-token").fill("browser-test-dashboard-access-token");
  await page.locator("#network-show-token-qr-button").click();
  const tokenQr = page.locator("#network-dashboard-token-qr");
  await tokenQr.locator("img").waitFor({state: "visible"});
  assert.equal(await tokenQr.getAttribute("hidden"), null);
  assert.match(await tokenQr.locator("img").getAttribute("src") || "", /^blob:/);
  assert.ok(await tokenQr.locator("img").evaluate(image => (image as HTMLImageElement).naturalWidth > 0));
  assert.equal(await page.locator("#network-show-token-qr-button").getAttribute("aria-expanded"), "true");
  await page.locator("#network-show-token-qr-button").click();
  assert.equal(await tokenQr.getAttribute("hidden"), "");

  const footerButtons = page.locator("#settings-overlay .settings-overlay-footer button");
  assert.equal(await footerButtons.count(), 2);
  for (let index = 0; index < await footerButtons.count(); index += 1) {
    const box = await footerButtons.nth(index).boundingBox();
    assert.ok(box && box.width < 240, "Settings footer actions should remain compact.");
  }
  if (process.env.SETTINGS_NAV_SCREENSHOT) {
    await page.screenshot({path: process.env.SETTINGS_NAV_SCREENSHOT});
  }
} finally {
  await browser.close();
  await server.close();
}

console.log("Dashboard settings browser navigation validation passed.");
