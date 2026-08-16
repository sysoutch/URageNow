import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const baseUrl = "http://127.0.0.1:4782";
const screenshotDirectory = "artifacts/verification";
const targets = [
  ["audio-studio-card", "audio"],
  ["image-studio-card", "image"],
  ["model3d-studio-card", "model3d"],
  ["video-studio-card", "video"]
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 2048, height: 1018 }, deviceScaleFactor: 1 });
await mkdir(screenshotDirectory, { recursive: true });
await page.goto(baseUrl, { waitUntil: "networkidle" });

const results = [];
for (const [targetId, label] of targets) {
  await page.locator(`[data-ai-scroll-target="${targetId}"]`).first().click();
  await page.waitForTimeout(400);
  const result = await page.evaluate(id => {
    const card = document.getElementById(id);
    const shell = document.querySelector(".content-shell");
    const grid = document.querySelector(".ai-grid");
    const hiddenCards = Array.from(document.querySelectorAll(".ai-section-target"))
      .filter(node => node.id !== id)
      .map(node => ({ id: node.id, display: getComputedStyle(node).display, inlineDisplay: node.style.display }));
    const rect = card ? card.getBoundingClientRect() : null;
    const shellRect = shell ? shell.getBoundingClientRect() : null;
    const gridRect = grid ? grid.getBoundingClientRect() : null;
    return {
      activeId: id,
      shellScrollTop: shell ? shell.scrollTop : null,
      cardRect: rect ? { top: rect.top, left: rect.left, width: rect.width, height: rect.height, bottom: rect.bottom } : null,
      shellRect: shellRect ? { top: shellRect.top, left: shellRect.left, width: shellRect.width, height: shellRect.height, bottom: shellRect.bottom } : null,
      gridRect: gridRect ? { top: gridRect.top, left: gridRect.left, width: gridRect.width, height: gridRect.height, bottom: gridRect.bottom } : null,
      hiddenCards
    };
  }, targetId);
  results.push(result);
  await page.screenshot({ path: `${screenshotDirectory}/urage-${label}-focus.png`, fullPage: false });
}

console.log(JSON.stringify(results, null, 2));
await browser.close();
