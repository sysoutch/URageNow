import assert from "node:assert/strict";
import { chromium } from "playwright";
import type { DashboardDependencies } from "@urage/shared/dashboard/types";
import { RuntimeState } from "@urage/server/runtime/runtimeState";
import { appConfig } from "@urage/server/config/appConfig";
import { startDashboardServer } from "@urage/dashboard/server";

appConfig.dashboardUiEnabled = true;

const dependencies = {
  port: 0,
  host: "127.0.0.1",
  runtimeState: new RuntimeState(),
  saveDashboardSettings: async () => {},
  setLlmConnectionSettings: () => {},
  getMessengerRuntimeSnapshot: () => ({ runtimes: [], events: [] }),
  controlMessengerRuntime: async input => ({ messenger: input.messenger, status: "stopped" }),
  getBotSnapshot: () => ({ id: null, tag: null, avatarUrl: null, guildCount: 0, startedAt: new Date().toISOString(), dashboardPort: 0 })
} as unknown as DashboardDependencies;

const server = startDashboardServer(dependencies);
const browser = await chromium.launch({ headless: true });
try {
  await server.ready;
  const address = server.address();
  assert.ok(address);
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
  const pageErrors: string[] = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.route("**/api/**", route => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  const response = await page.goto(`http://${address.address}:${address.port}`, { waitUntil: "domcontentloaded" });
  assert.equal(response?.status(), 200);
  assert.match(await page.content(), /id="bots-dashboard-frame"/);
  const frame = page.locator("#bots-dashboard-frame");
  assert.equal(await frame.getAttribute("src"), null, "Bots iframe must not load during initial Studio startup.");
  await page.locator('[data-rail-category="bots"]').click();
  await page.waitForFunction(() => document.getElementById("bots-dashboard-frame")?.hasAttribute("src"));
  assert.match(await frame.getAttribute("src") || "", /\/bots-dashboard$/);
  await page.waitForFunction(() => document.getElementById("bots-dashboard-frame")?.contentDocument?.querySelector(".bots-host"));
  assert.deepEqual(pageErrors, []);
  console.log("Studio lazy Bots dashboard frame validation passed.");
} finally {
  await browser.close();
  await server.close();
}
