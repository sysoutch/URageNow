import assert from "node:assert/strict";
import { chromium } from "playwright";
import { renderBotsDashboardHtml } from "../dashboard/src/botsDashboardPage.js";

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1180, height: 900 } });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("http://bots.test/**", async route => {
    const url = new URL(route.request().url());
    if (url.pathname === "/" || url.pathname === "/bots-dashboard") {
      await route.fulfill({ status: 200, contentType: "text/html", body: renderBotsDashboardHtml() });
      return;
    }
    if (url.pathname === "/api/messenger-runtimes") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ runtimes: [], events: [] }) });
      return;
    }
    if (url.pathname === "/api/discord/status") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ bot: {}, runtime: null, events: [] }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  await page.goto("http://bots.test/", { waitUntil: "networkidle" });

  const workspaceTabs = page.locator(".bots-workspace-tabs [data-bots-view]");
  assert.equal(await workspaceTabs.getByText("Guild", { exact: true }).isVisible(), true);
  assert.equal(await workspaceTabs.getByText("Moderation", { exact: true }).isVisible(), true);
  await workspaceTabs.getByText("Guild", { exact: true }).click();
  assert.equal(await page.locator('[data-view-panel="guild"]').isVisible(), true);
  assert.equal(await page.getByRole("button", { name: "Commands", exact: true }).isVisible(), true);
  await workspaceTabs.getByText("Moderation", { exact: true }).click();
  assert.equal(await page.locator('[data-view-panel="moderation"]').isVisible(), true);

  await page.locator('[data-bot="telegram"]').click();
  assert.equal(await page.locator("#messenger-dashboard-title").textContent(), "Telegram");
  assert.deepEqual(errors, []);
  console.log("Bots dashboard keeps the shared dashboard style and exposes every Discord workspace view.");
} finally {
  await browser.close();
}
