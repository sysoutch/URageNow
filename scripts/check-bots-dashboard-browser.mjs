import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.URAGE_BOTS_DASHBOARD_URL || "http://127.0.0.1:4784";
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.locator('[data-bot="telegram"]').click();
  assert.equal(await page.locator("#messenger-dashboard-title").textContent(), "Telegram");
  await page.locator('[data-bot="matrix"]').click();
  assert.equal(await page.locator("#messenger-dashboard-title").textContent(), "Matrix");
  await page.locator('[data-bot="whatsapp"]').click();
  assert.equal(await page.locator("#messenger-dashboard-title").textContent(), "WhatsApp");
  assert.equal(await page.locator("#messenger-dashboard-space-label").textContent(), "Recipients");
  await page.locator('.messenger-dashboard-view [data-view="messenger"]').click();
  assert.equal(await page.locator('[data-view-panel="messenger"]').evaluate(node => node.classList.contains("active")), true);
  assert.deepEqual(pageErrors, []);
  const screenshotPath = path.join(os.tmpdir(), "urage-bots-dashboard-smoke.png");
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`Bots dashboard browser validation passed. Screenshot: ${screenshotPath}`);
} finally {
  await browser.close();
}
