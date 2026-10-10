import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { renderDashboardGamesView } from "../dashboard/src/pageSections/gamesView.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sample = Array.from({ length: 25 }, (_, index) => `word${index + 1}`).join(" ");
const game = {
  id: "token-typing", name: "Token Typing", description: "Guess the speed", version: "1.0.0",
  gameType: "typing-speed", runtimes: ["discord"], enabledRuntimes: ["discord"]
};
let configuration: Record<string, unknown> = { rounds: 5, text: sample };
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1024, height: 900 } });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("http://games.test/", route => route.fulfill({ status: 200, contentType: "text/html", body: renderDashboardGamesView() }));
  await page.route("**/api/games", async route => {
    const request = route.request();
    const body = request.method() === "POST" ? request.postDataJSON() : null;
    let result: unknown = { installed: [game], available: [] };
    if (body?.action === "get-configuration") result = { game, configuration };
    if (body?.action === "update-configuration") {
      configuration = body.configuration;
      result = { configuration };
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(result) });
  });
  await page.goto("http://games.test/");
  await page.addScriptTag({ path: path.join(root, "dashboard/src/client/modules/gamesDashboard.js") });
  await page.getByRole("button", { name: "Edit texts" }).click();
  await page.locator(".games-text-row").first().waitFor();
  assert.equal(await page.locator(".games-text-row").count(), 1);
  assert.equal(await page.locator(".games-text-row textarea").first().inputValue(), sample);
  await page.getByRole("button", { name: "Add text" }).click();
  await page.locator(".games-text-row textarea").nth(1).fill(`${sample} extra`);
  await page.locator(".games-config-field select").selectOption("shuffle");
  await page.getByRole("button", { name: "Save texts" }).click();
  await page.getByText("Token Typing texts saved.", { exact: false }).waitFor();
  assert.deepEqual(configuration, { rounds: 5, texts: [sample, `${sample} extra`], textMode: "shuffle" });
  await page.getByRole("button", { name: "Edit texts" }).click();
  await page.locator(".games-text-row").first().waitFor();
  assert.equal(await page.locator(".games-text-row").count(), 2);
  assert.equal(await page.locator(".games-config-field select").inputValue(), "shuffle");
  assert.deepEqual(errors, []);
  console.log("Games dashboard text editor browser validation passed.");
} finally {
  await browser.close();
}
