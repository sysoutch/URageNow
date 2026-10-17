import assert from "node:assert/strict";
import {chromium} from "playwright";
import type {DashboardDependencies} from "@urage/shared/dashboard/types";
import {RuntimeState} from "@urage/server/runtime/runtimeState";
import {startDashboardServer} from "@urage/dashboard/server";

// The Studio page shares client bindings with the bot dashboards. A binding to
// a panel that only exists there used to throw inside the async bootstrap,
// which silently left the rail, Studio home, and view state uninitialized.
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

const server = startDashboardServer(dependencies);
const browser = await chromium.launch({headless: true});

try {
  await server.ready;
  const address = server.address();
  assert.ok(address && typeof address === "object", "Dashboard server must expose a TCP address.");
  const page = await browser.newPage({viewport: {width: 1440, height: 900}});
  const failures: string[] = [];
  page.on("pageerror", error => failures.push(error.message));
  page.on("console", message => {
    if (message.type() === "error" && message.text().startsWith("Dashboard bootstrap failed")) {
      failures.push(message.text());
    }
  });
  await page.addInitScript(() => {
    window.addEventListener("dashboard:ready", () => document.documentElement.setAttribute("data-check-ready", "true"));
  });
  await page.goto(`http://127.0.0.1:${address.port}/`, {waitUntil: "load"});
  await page.waitForSelector("html[data-check-ready='true']", {timeout: 20_000}).catch(() => {});
  const result = await page.evaluate(() => ({
    ready: document.documentElement.getAttribute("data-check-ready") === "true",
    bodyClasses: document.body.className
  }));
  assert.deepEqual(failures, [], "Studio bootstrap must not fail.");
  assert.ok(result.ready, `Studio bootstrap must dispatch dashboard:ready (body: ${result.bodyClasses}).`);
  assert.match(result.bodyClasses, /\bstudio-(workflow-)?home-active\b/, "A Studio home mode must be marked active after bootstrap.");
  console.log("Dashboard bootstrap readiness check passed.");
} finally {
  await browser.close();
  await server.close();
}
