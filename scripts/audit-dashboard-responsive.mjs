import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const dashboardUrl = process.argv[2] || "http://127.0.0.1:4782";
const outputDirectory = path.resolve(process.argv[3] || "artifacts/dashboard-responsive-audit");
const viewports = [
  {name: "desktop-studio", width: 1440, height: 900, view: "ai"},
  {name: "desktop-bots", width: 1440, height: 900, view: "dashboard"},
  {name: "desktop-tools-browser", width: 1440, height: 900, view: "tools"},
  {name: "desktop-tools-active", width: 1440, height: 900, view: "tools", toolId: "art__pixel-art-converter"},
  {name: "desktop-tools-zoom", width: 1120, height: 900, view: "tools", toolsMode: "desktop"},
  {name: "phone-studio", width: 390, height: 844, view: "ai"},
  {name: "phone-tools", width: 390, height: 844, view: "tools"},
  {name: "phone-bots", width: 390, height: 844, view: "dashboard"},
  {name: "phone-messaging", width: 390, height: 844, view: "messaging"},
  {name: "phone-automation", width: 390, height: 844, view: "automation"},
  {name: "phone-profile", width: 390, height: 844, view: "profile"}
];

const browser = await chromium.launch({headless: true});
try {
  await fs.mkdir(outputDirectory, {recursive: true});
  for (const viewport of viewports) {
    const page = await browser.newPage({viewport});
    if (viewport.toolsMode) {
      await page.addInitScript(mode => localStorage.setItem("urage-tools-mode", mode), viewport.toolsMode);
    }
    await page.goto(dashboardUrl, {waitUntil: "domcontentloaded"});
    await page.waitForTimeout(750);
    if (viewport.view !== "ai") {
      await page.locator(`[data-view="${viewport.view}"]`).first().evaluate(button => button.click());
      await page.waitForTimeout(250);
    }
    if (viewport.toolId) {
      await page.locator(`[data-tools-tool="${viewport.toolId}"]`).first().evaluate(button => button.click());
      await page.waitForTimeout(500);
    }
    const metrics = await page.evaluate(() => {
      const shell = document.querySelector(".app-shell");
      const nav = document.querySelector(".mobile-bottom-nav");
      const dashboardHeader = document.querySelector(".messenger-dashboard-header-card");
      const toolImportPanel = document.querySelector(".tool-import-panel");
      const toolImportForm = document.querySelector(".tool-import-form");
      const toolFrame = document.querySelector(".tools-workspace-frame-wrap");
      const toolFooter = document.querySelector(".tools-workspace-footer");
      const dashboardHeaderRight = dashboardHeader?.getBoundingClientRect().right || 0;
      return {
        bodyClasses: document.body.className,
        activeViews: [...document.querySelectorAll(".view.active")].map(view => ({
          panel: view.getAttribute("data-view-panel"),
          rect: [Math.round(view.getBoundingClientRect().x), Math.round(view.getBoundingClientRect().y), Math.round(view.getBoundingClientRect().width), Math.round(view.getBoundingClientRect().height)],
          display: getComputedStyle(view).display
        })),
        bodyOverflow: document.body.scrollWidth - document.body.clientWidth,
        shellOverflow: shell ? shell.scrollWidth - shell.clientWidth : 0,
        shellSize: shell ? [shell.clientWidth, shell.clientHeight] : null,
        shellColumns: shell ? getComputedStyle(shell).gridTemplateColumns : null,
        dashboardHeader: dashboardHeader ? {
          rect: [Math.round(dashboardHeader.getBoundingClientRect().x), Math.round(dashboardHeader.getBoundingClientRect().y), Math.round(dashboardHeader.getBoundingClientRect().width), Math.round(dashboardHeader.getBoundingClientRect().height)],
          controlOverflow: Math.max(0, ...[...dashboardHeader.querySelectorAll(".messenger-dashboard-head-actions button, .messenger-dashboard-fetch-buttons button")]
            .map(button => Math.round(button.getBoundingClientRect().right - dashboardHeaderRight)))
        } : null,
        toolImport: toolImportPanel && toolImportForm ? {
          panelHeight: Math.round(toolImportPanel.getBoundingClientRect().height),
          formHeight: Math.round(toolImportForm.getBoundingClientRect().height),
          formWidth: Math.round(toolImportForm.getBoundingClientRect().width),
          display: getComputedStyle(toolImportForm).display
        } : null,
        toolWorkspace: toolFrame && toolFooter ? {
          frameBottom: Math.round(toolFrame.getBoundingClientRect().bottom),
          footerTop: Math.round(toolFooter.getBoundingClientRect().top),
          footerHeight: Math.round(toolFooter.getBoundingClientRect().height)
        } : null,
        nav: nav ? {display: getComputedStyle(nav).display, width: nav.clientWidth, scrollWidth: nav.scrollWidth} : null
      };
    });
    await page.screenshot({path: path.join(outputDirectory, `urage-dashboard-${viewport.name}.png`), fullPage: true});
    console.log(`${viewport.name}: ${JSON.stringify(metrics)}`);
    assert.ok(metrics.bodyOverflow <= 1, `${viewport.name} body overflows by ${metrics.bodyOverflow}px`);
    assert.ok(metrics.shellOverflow <= 1, `${viewport.name} shell overflows by ${metrics.shellOverflow}px`);
    if (viewport.width <= 480) {
      assert.ok(metrics.activeViews.every(view => view.rect[2] >= 280), `${viewport.name} leaves less than 280px for its active view`);
      assert.ok(!metrics.dashboardHeader || metrics.dashboardHeader.controlOverflow <= 1, `${viewport.name} clips dashboard header controls`);
    }
    if (viewport.toolsMode === "desktop") {
      assert.ok(metrics.toolImport?.formHeight > 30, `${viewport.name} hides the repository import controls`);
      assert.ok(metrics.toolImport?.formWidth > 280, `${viewport.name} leaves too little width for repository import`);
    }
    if (viewport.name === "desktop-tools-browser") {
      assert.ok(metrics.toolImport?.panelHeight > 60 && metrics.toolImport.panelHeight < 360, `${viewport.name} stretches the repository import panel`);
    }
    if (viewport.toolId) {
      assert.ok(metrics.toolWorkspace?.footerHeight > 30 && metrics.toolWorkspace.footerHeight < 120, `${viewport.name} stretches the tool workspace footer`);
      assert.ok(metrics.toolWorkspace?.footerTop >= metrics.toolWorkspace.frameBottom, `${viewport.name} places the workspace footer inside the tool frame`);
    }
    await page.close();
  }
} finally {
  await browser.close();
}
