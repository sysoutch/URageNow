// Structural layout audit for the dashboard Chat Studio (Ask LazyDev).
// Implements the verification contract from memory-bank/styleguides/html-css-styleguide.md:
// horizontal overflow, overlaps, clipping, reachability, and scroll ownership are
// measured from DOM geometry at every required viewport - screenshots alone never count.
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const dashboardUrl = process.argv[2] || "http://127.0.0.1:4782";
const outputDirectory = path.resolve(process.argv[3] || "artifacts/chat-studio-audit");
// Style guide section 5: required widths plus the intermediate width it calls out (600px).
const viewports = [
  { name: "w320", width: 320, height: 700 },
  { name: "w375", width: 375, height: 812 },
  { name: "w600", width: 600, height: 900 },
  { name: "w768", width: 768, height: 1024 },
  { name: "w1024", width: 1024, height: 768 },
  { name: "w1440", width: 1440, height: 900 }
];

const ELEMENT_SELECTOR = [
  ".app-shell",
  ".content-shell",
  '.view[data-view-panel="ai"]',
  ".content-grid.ai-grid",
  "#ask-rod-card",
  "#ask-rod-card > .chat-header-topline",
  ".ask-rod-workspace[data-workflow-sidebar-workspace='ask']",
  "#ask-chat-tabs",
  ".ask-rod-main",
  "#ask-chat-feed",
  "#ask-chat-messages",
  ".ask-rod-composer",
  "#ask-prompt",
  "#ask-button",
  "#ask-voice-record-button",
  ".ask-composer-message-row",
  ".ask-composer-send-actions",
  ".studio-workflow-side-resizer[data-workflow-sidebar-resizer='ask']",
  "#ask-rod-sidebar-panel"
].join(", ");

const OVERLAP_GROUPS = [
  ["#ask-rod-card > .chat-header-topline", ".ask-rod-main"],
  [".ask-rod-main", "#ask-rod-sidebar-panel"],
  [".ask-rod-composer", "#ask-chat-feed"]
];
// Self-contained browser-side metric collector (Playwright serializes by value, so it must not close over Node scope).
function chatStudioMetrics(context) {
  const round = value => Math.round(value * 10) / 10;
  const info = selector => {
    const node = document.querySelector(selector);
    if (!node) return null;
    const rect = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    return {
      visible: rect.width > 0 && rect.height > 0,
      display: style.display,
      position: style.position,
      overflow: `${style.overflowX}/${style.overflowY}`,
      x: round(rect.x), y: round(rect.y), w: round(rect.width), h: round(rect.height)
    };
  };
  const elements = {};
  for (const raw of context.elementSelector.split(",")) {
    const selector = raw.trim();
    if (!selector) continue;
    elements[selector] = info(selector);
  }
  // Reachability: compact rows can swap which send control is active, so every
  // candidate is measured and the center tap target (elementFromPoint) proves
  // which element actually receives the click in each viewport/state.
  const sendControls = {};
  for (const selector of ["#ask-voice-record-button", "#ask-button", ".ask-composer-send-actions"]) {
    const node = document.querySelector(selector);
    if (!node) continue;
    const rect = node.getBoundingClientRect();
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;
    const centerHit = document.elementFromPoint(cx, cy);
    sendControls[selector] = {
      visible: rect.width > 0 && rect.height > 0,
      display: getComputedStyle(node).display,
      rect: [round(rect.x), round(rect.y), round(rect.width), round(rect.height)],
      covered: centerHit ? !(centerHit === node || node.contains(centerHit)) : null,
      centerTarget: centerHit ? (centerHit.id || `${centerHit.tagName}.${String(centerHit.className).split(" ").join(".")}`.slice(0, 60)) : "none"
    };
  }
  const overlaps = [];
  for (const [a, b] of context.overlapGroups) {
    const na = document.querySelector(a);
    const nb = document.querySelector(b);
    if (!na || !nb) continue;
    const ra = na.getBoundingClientRect();
    const rb = nb.getBoundingClientRect();
    const xOverlap = Math.max(0, Math.min(ra.right, rb.right) - Math.max(ra.x, rb.x));
    const yOverlap = Math.max(0, Math.min(ra.bottom, rb.bottom) - Math.max(ra.y, rb.y));
    if (xOverlap > 1 && yOverlap > 1) overlaps.push(`${a} x ${b}: ${round(xOverlap)}x${round(yOverlap)}`);
  }
  // Scroll ownership: which element actually scrolls and whether content is trapped.
  const scrollers = [];
  for (const selector of [".app-shell", ".content-shell", '.view[data-view-panel="ai"]', "#ask-rod-card", "#ask-chat-feed", "#ask-chat-messages", ".ask-rod-main", "#ask-rod-sidebar-panel"]) {
    const node = document.querySelector(selector);
    if (!node) continue;
    scrollers.push({
      selector,
      canScrollY: node.scrollHeight > node.clientHeight + 1,
      scrollHeight: node.scrollHeight,
      clientHeight: node.clientHeight,
      overflowY: getComputedStyle(node).overflowY
    });
  }
  return {
    innerWidth,
    docScrollWidth: document.documentElement.scrollWidth,
    horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
    docScrollHeight: document.documentElement.scrollHeight,
    verticalOverflow: Math.max(0, document.documentElement.scrollHeight - window.innerHeight),
    bodyClasses: document.body.className.split(" ").filter(c => c.startsWith("view-") || c.includes("focused") || c.includes("sidebar")).join(" "),
    elements,
    sendControls,
    overlaps,
    scrollers
  };
}

// Self-contained adverse-content seeder (style guide section 8): long bodies that must wrap, not blow the layout out.
function injectAdverseContent() {
  const list = document.getElementById("ask-chat-messages");
  if (!list || list.childElementCount > 2) return;
  const makeBubble = kind => {
    const bubble = document.createElement("div");
    bubble.className = `chat-bubble ${kind === "user" ? "user-bubble" : "assistant-bubble"}`;
    const body = kind === "user"
      ? "Please explain the difference between flexbox and CSS grid with a long, realistic example sentence that is intentionally verbose so we can verify wrapping behaviour at every viewport width."
      : "Flexbox distributes space along one axis while CSS grid positions items on two axes. This deliberately long answer continues: a production chat feed must keep wide tokens such as https://example.com/a-very-long-path/that-should-wrap-anywhere-in-the-string and wrapped paragraphs readable without horizontal overflow at any supported width.";
    bubble.innerHTML = `<div class="chat-role">${kind}</div><div class="chat-bubble-body"></div>`;
    bubble.querySelector(".chat-bubble-body").textContent = body;
    return bubble;
  };
  list.appendChild(makeBubble("user"));
  list.appendChild(makeBubble("assistant"));
}
// Per-viewport summary written next to the screenshots so before/after runs are
// diffable without re-parsing the console log.
const auditResults = [];
const browser = await chromium.launch({ headless: true });
try {
  await fs.mkdir(outputDirectory, { recursive: true });
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
    try {
      await page.goto(dashboardUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await page.waitForSelector(".app-shell", { timeout: 30_000 });
      // The LazyDev home is a tile grid; studio cards only exist in focus mode.
      const onAiHome = await page.evaluate(() => document.body.classList.contains("view-ai-active"));
      if (!onAiHome) {
        // Pointer interception (a transient overlay, tooltip, or mid-animation row)
        // must not fail the audit: fall back to the DOM click the handler listens for.
        await page.locator('[data-view="ai"]:visible').first().click({ timeout: 10_000 }).catch(async () => {
          await page.evaluate(() => document.querySelector('[data-view="ai"]')?.click());
        });
      }
      // Enter Chat Studio focus mode the same way a user would (visible Chat entry point).
      const tile = page.locator('[data-ai-scroll-target="ask-rod-card"]:visible').first();
      await tile.waitFor({ state: "visible", timeout: 15_000 }).catch(() => {});
      if (await tile.count()) {
        await tile.click({ timeout: 10_000 }).catch(async () => {
          await page.evaluate(() => document.querySelector('[data-ai-scroll-target="ask-rod-card"]')?.click());
        });
      } else {
        await page.evaluate(() => document.querySelector('[data-ai-scroll-target="ask-rod-card"]')?.click());
      }
      await page.waitForSelector("#ask-rod-card", { state: "visible", timeout: 30_000 });
      await page.waitForTimeout(600);
      await page.evaluate(injectAdverseContent);
      await page.waitForTimeout(250);
      const metrics = await page.evaluate(chatStudioMetrics, { elementSelector: ELEMENT_SELECTOR, overlapGroups: OVERLAP_GROUPS });
      await page.screenshot({ path: path.join(outputDirectory, `chat-studio-${viewport.name}.png`), fullPage: false });
      console.log(`\n===== ${viewport.name} (${viewport.width}x${viewport.height}) =====`);
      console.log(JSON.stringify(metrics, null, 1));
      auditResults.push({ viewport: `${viewport.name} ${viewport.width}x${viewport.height}`, ...metrics });
    } finally {
      await page.close();
    }
  }
  await fs.writeFile(path.join(outputDirectory, "metrics.json"), JSON.stringify(auditResults, null, 1));
} finally {
  await browser.close();
}
