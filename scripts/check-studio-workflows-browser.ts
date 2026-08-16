import assert from "node:assert/strict";
import {mkdir} from "node:fs/promises";
import path from "node:path";
import {chromium, type Page} from "playwright";
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
  controlMessengerRuntime: async () => { throw new Error("Messenger runtime control is unavailable in this check."); },
  getBotSnapshot: () => ({
    id: null, tag: null, avatarUrl: null, guildCount: 0,
    startedAt: new Date().toISOString(), dashboardPort: 0
  })
} as unknown as DashboardDependencies;

const workflows = [
  {name: "image", cardId: "image-studio-card", metadataId: "imagegen-meta-output"},
  {name: "model3d", cardId: "model3d-studio-card", metadataId: "model3d-meta-output"},
  {name: "audio", cardId: "audio-studio-card", metadataId: "audiogen-meta-output"},
  {name: "music", cardId: "music-studio-card", metadataId: "musicgen-meta-output"},
  {name: "video", cardId: "video-studio-card", metadataId: "videogen-meta-output"}
] as const;
const viewports = [
  {name: "desktop", width: 1440, height: 900},
  {name: "narrow", width: 430, height: 900}
] as const;

async function openWorkflow(page: Page, cardId: string) {
  await page.evaluate(targetId => {
    const trigger = document.querySelector<HTMLElement>(`[data-ai-scroll-target="${targetId}"]`);
    if (!trigger) throw new Error(`Missing workflow navigation trigger for ${targetId}.`);
    trigger.click();
  }, cardId);
  const card = page.locator(`#${cardId}`);
  await card.waitFor({state: "visible"});
  return card;
}

const server = startDashboardServer(dependencies);
const browser = await chromium.launch({headless: true});
const screenshotRoot = path.resolve("artifacts", "studio-workflow-browser", String(process.pid));

try {
  await server.ready;
  await mkdir(screenshotRoot, {recursive: true});
  const address = server.address();
  assert.ok(address);
  const dashboardUrl = `http://${address.address}:${address.port}`;

  for (const viewport of viewports) {
    const page = await browser.newPage({viewport});
    await page.route("**/api/**", route => route.fulfill({status: 200, contentType: "application/json", body: "{}"}));
    await page.goto(dashboardUrl, {waitUntil: "domcontentloaded"});
    for (const workflow of workflows) {
      const card = await openWorkflow(page, workflow.cardId);
      const contract = await card.evaluate(element => {
        const rect = element.getBoundingClientRect();
        const controls = [...element.querySelectorAll<HTMLElement>(
          ".studio-component-form input, .studio-component-form select, .studio-component-form textarea, .studio-component-form button"
        )]
          .filter(node => getComputedStyle(node).display !== "none" && node.getBoundingClientRect().width > 0)
          .map(node => {
            const controlRect = node.getBoundingClientRect();
            return {
              id: node.id,
              label: node.id || `${node.tagName.toLowerCase()}.${node.className}`,
              left: controlRect.left,
              right: controlRect.right
            };
          });
        return {
          cardLeft: rect.left,
          cardRight: rect.right,
          scrollWidth: element.scrollWidth,
          clientWidth: element.clientWidth,
          forms: element.querySelectorAll(".studio-component-form").length,
          sections: element.querySelectorAll(".studio-component-form-section").length,
          previews: element.querySelectorAll(".studio-component-preview-card").length,
          queues: element.querySelectorAll(".studio-component-queue").length,
          advancedSettings: element.querySelectorAll(".studio-component-advanced-settings").length,
          controls
        };
      });
      assert.ok(contract.forms >= 1, `${workflow.name} must use the shared form contract.`);
      assert.ok(contract.sections >= 1, `${workflow.name} must use shared form sections.`);
      assert.ok(contract.previews >= 1, `${workflow.name} must use a shared preview card.`);
      assert.ok(contract.queues >= 1, `${workflow.name} must use a shared generation queue.`);
      assert.ok(contract.advancedSettings >= 1, `${workflow.name} must use shared advanced settings.`);
      await page.locator(`#${workflow.metadataId}.studio-component-metadata`).waitFor({state: "attached"});
      assert.ok(await page.locator(".studio-component-status").count() >= 5,
        "Every Studio must use the shared status-panel contract.");
      assert.ok(contract.scrollWidth <= contract.clientWidth + 2,
        `${workflow.name} card must not introduce horizontal overflow at ${viewport.name} width.`);
      for (const control of contract.controls) {
        assert.ok(control.left >= contract.cardLeft - 2 && control.right <= contract.cardRight + 2,
          `${workflow.name} control ${control.label} (${control.left}-${control.right}) overflows ${contract.cardLeft}-${contract.cardRight} at ${viewport.name} width.`);
      }
      await page.screenshot({
        path: path.join(screenshotRoot, `${viewport.name}-${workflow.name}.png`),
        animations: "disabled"
      });
    }
    await page.close();
  }
} finally {
  await browser.close();
  await server.close();
}

console.log("Image, 3D, Audio, Music, and Video desktop/narrow browser validation passed.");
