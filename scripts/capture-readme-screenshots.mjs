import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const dashboardUrl = process.argv[2] || "http://127.0.0.1:4782";
const outputDirectory = path.resolve(process.cwd(), "screenshots");

await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch({ headless: true });

async function capture(name, prepare) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  await page.goto(dashboardUrl, { waitUntil: "networkidle" });
  await prepare(page);
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outputDirectory, `${name}.png`), fullPage: false });
  await page.close();
}

try {
  await capture("dashboard-home", async page => {
    await page.locator('[data-studio-home-view="workflow"]').first().click();
  });
  await capture("dashboard-chat", async page => {
    await page.locator('[data-ai-scroll-target="ask-rod-card"]').first().click();
  });
  await capture("dashboard-image", async page => {
    await page.locator('[data-ai-scroll-target="image-studio-card"]').first().click();
  });
  await capture("dashboard-tools", async page => {
    await page.locator('[data-view="tools"]').first().click();
  });
} finally {
  await browser.close();
}
