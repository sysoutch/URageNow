import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import {chromium} from "playwright";

const dashboardUrl = process.argv[2] || "http://127.0.0.1:4782";
const outputDirectory = path.resolve(process.argv[3] || "artifacts/home-command-center-audit");
const browser = await chromium.launch({headless: true});

async function captureHome(page, mode, viewportName) {
  await page.locator(`[data-studio-home-view="${mode}"]`).first().click();
  const activeClass = mode === "studio" ? "studio-home-active" : "studio-workflow-home-active";
  await page.waitForFunction(className => document.body.classList.contains(className), activeClass);
  await page.waitForTimeout(700);
  const metrics = await page.evaluate(selectedMode => {
    const root = selectedMode === "studio" ? document.querySelector(".studio-view-shell") : document.querySelector(".lazydev-home-card");
    const finalRow = selectedMode === "studio" ? document.querySelector(".studio-home-feature-grid") : document.querySelector(".lazydev-home-activity-panel");
    const commandGrid = document.querySelector(".studio-home-command-grid");
    const topbar = document.querySelector(".studio-home-topbar");
    const chart = document.querySelector("#lazydev-home-activity-chart");
    const matchingGridRules = [];
    const collectGridRules = rules => [...rules].forEach(rule => {
      if (rule.cssRules) collectGridRules(rule.cssRules);
      if (!root || !rule.selectorText || !rule.style?.gridTemplateColumns) return;
      try {
        if (root.matches(rule.selectorText)) matchingGridRules.push(`${rule.selectorText} => ${rule.style.gridTemplateColumns}`);
      } catch {}
    });
    [...document.styleSheets].forEach(sheet => {
      try { collectGridRules(sheet.cssRules); } catch {}
    });
    return {
      bodyClasses: document.body.className,
      rootGrid: root ? getComputedStyle(root).gridTemplateColumns : "",
      matchingGridRules,
      topbarRect: topbar ? [...["x", "y", "width", "height"].map(key => Math.round(topbar.getBoundingClientRect()[key]))] : [],
      commandRect: commandGrid ? [...["x", "y", "width", "height"].map(key => Math.round(commandGrid.getBoundingClientRect()[key]))] : [],
      finalRowRect: finalRow ? [...["x", "y", "width", "height"].map(key => Math.round(finalRow.getBoundingClientRect()[key]))] : [],
      documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      rootWidth: Math.round(root?.getBoundingClientRect().width || 0),
      rootRight: Math.round(root?.getBoundingClientRect().right || 0),
      finalRowBottom: Math.round(finalRow?.getBoundingClientRect().bottom || 0),
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      chartWidth: Math.round(chart?.getBoundingClientRect().width || 0),
      chartSeries: chart?.querySelectorAll(".lazydev-home-chart-series").length || 0
    };
  }, mode);
  await page.screenshot({path: path.join(outputDirectory, `${viewportName}-${mode}.png`), fullPage: false});
  assert.ok(metrics.documentOverflow <= 1, `${viewportName} ${mode} overflows horizontally by ${metrics.documentOverflow}px`);
  assert.ok(metrics.rootRight <= metrics.viewportWidth + 1, `${viewportName} ${mode} extends beyond the viewport`);
  if (metrics.viewportWidth >= 2000) {
    assert.ok(metrics.rootWidth >= metrics.viewportWidth * 0.84, `${viewportName} ${mode} leaves excessive horizontal gutters`);
    assert.ok(metrics.finalRowBottom >= metrics.viewportHeight * 0.82, `${viewportName} ${mode} leaves an excessive lower-screen gap: ${JSON.stringify(metrics)}`);
    if (mode === "workflow") {
      assert.ok(metrics.chartWidth >= 700, `${viewportName} LazyDev graph is not visually dominant`);
      assert.ok(metrics.chartSeries >= 1, `${viewportName} LazyDev graph has no rendered series`);
    }
  }
  return metrics;
}

try {
  await fs.mkdir(outputDirectory, {recursive: true});
  for (const viewport of [
    {name: "ultrawide", width: 2560, height: 1440},
    {name: "phone", width: 390, height: 844}
  ]) {
    const page = await browser.newPage({viewport});
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(dashboardUrl, {waitUntil: "domcontentloaded"});
    await page.waitForTimeout(700);
    const studioMetrics = await captureHome(page, "studio", viewport.name);
    const workflowMetrics = await captureHome(page, "workflow", viewport.name);
    assert.deepEqual(errors, [], `${viewport.name} page errors: ${errors.join("; ")}`);
    console.log(`${viewport.name}: ${JSON.stringify({studioMetrics, workflowMetrics})}`);
    await page.close();
  }

  const page = await browser.newPage({viewport: {width: 1440, height: 1000}});
  await page.goto(dashboardUrl, {waitUntil: "domcontentloaded"});
  await page.locator('[data-studio-home-view="workflow"]').first().click();
  await page.locator('.lazydev-home-workflow-button[data-ai-scroll-target="model3d-studio-card"]').click();
  await page.locator("#model3d-llm-real-height-button").waitFor({state: "visible"});
  assert.equal((await page.locator("#model3d-llm-real-height-button").textContent())?.trim(), "Ask LLM For Real-Life Height");
  await page.screenshot({path: path.join(outputDirectory, "desktop-model3d-llm-real-height-action.png"), fullPage: false});
  await page.close();
} finally {
  await browser.close();
}

console.log("Home command center browser validation passed.");
