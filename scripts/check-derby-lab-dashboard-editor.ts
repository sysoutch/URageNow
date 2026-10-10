import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { renderDashboardGamesView } from "../dashboard/src/pageSections/gamesView.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packDocument = JSON.parse(await readFile(path.join(root, "bots", "discord-bot", "game-packs", "derby-lab.uragegame.json"), "utf8"));
const game = { ...packDocument.manifest, enabledRuntimes: ["discord"] };
let configuration: Record<string, unknown> = structuredClone(packDocument.configuration);
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
  await page.getByRole("button", { name: "Edit rosters" }).click();
  await page.locator(".games-roster-row").first().waitFor();
  assert.equal(await page.locator(".games-roster-row").count(), 3);
  assert.equal(await page.locator(".games-racer-row").count(), 18);
  assert.equal(await page.locator(".games-roster-label").first().inputValue(), "Horses");
  assert.deepEqual(
    await page.locator(".games-roster-species").evaluateAll(elements => elements.map(element => (element as HTMLSelectElement).value)),
    ["horse", "emu", "penguin"]
  );
  assert.equal(await page.locator(".games-racer-name").nth(1).inputValue(), "Night Rider");
  assert.equal(await page.locator(".games-racer-color").nth(1).inputValue(), "#a78bfa");
  assert.equal(await page.locator(".games-racer-power").nth(1).inputValue(), "8.1");
  assert.equal(await page.locator(".games-config-editor > .games-config-field select").inputValue(), "sequential");

  await page.getByRole("button", { name: "Add roster" }).click();
  await page.locator(".games-roster-row").nth(3).waitFor();
  await page.locator(".games-roster-label").nth(3).fill("Goats");
  for (let index = 0; index < 3; index += 1) {
    await page.getByRole("button", { name: "Add racer" }).nth(3).click();
  }
  const newRacers = [
    ["Test Mare", "#f4bc55", "7"],
    ["Test Pony", "#a78bfa", "5"],
    ["Test Foal", "#fd7971", "3"]
  ];
  for (const [offset, racer] of newRacers.entries()) {
    await page.locator(".games-racer-name").nth(18 + offset).fill(racer[0]);
    await page.locator(".games-racer-color").nth(18 + offset).fill(racer[1]);
    await page.locator(".games-racer-power").nth(18 + offset).fill(racer[2]);
  }
  assert.equal(await page.locator(".games-racer-row").count(), 21);
  await page.getByRole("button", { name: "Save rosters" }).click();
  await page.getByText("Derby Lab rosters saved.", { exact: false }).waitFor();
  assert.equal((configuration.rosters as unknown[]).length, 4);
  assert.deepEqual(
    (configuration.rosters as never[])[3],
    {
      label: "Goats",
      species: "horse",
      racers: [
        { name: "Test Mare", color: "#f4bc55", power: 7 },
        { name: "Test Pony", color: "#a78bfa", power: 5 },
        { name: "Test Foal", color: "#fd7971", power: 3 }
      ]
    }
  );
  assert.deepEqual((configuration.rosters as never[])[0], packDocument.configuration.rosters[0]);

  await page.getByRole("button", { name: "Edit rosters" }).click();
  await page.locator(".games-roster-row").nth(3).waitFor();
  await page.locator(".games-roster-row").nth(3).locator("button").last().click();
  assert.equal(await page.locator(".games-roster-row").count(), 3);
  assert.equal(await page.locator(".games-racer-row").count(), 18);
  await page.locator(".games-config-editor > .games-config-field select").selectOption("shuffle");
  await page.getByRole("button", { name: "Save rosters" }).click();
  await page.getByText("Derby Lab rosters saved.", { exact: false }).waitFor();
  assert.equal(configuration.rosterMode, "shuffle");
  assert.equal(configuration.rounds, 3);
  assert.equal(configuration.houseFee, 5);
  assert.equal(configuration.bonusPool, 500);

  await page.getByRole("button", { name: "Edit rosters" }).click();
  await page.locator(".games-roster-row").first().waitFor();
  await page.locator(".games-racer-color").first().fill("blue");
  await page.getByRole("button", { name: "Save rosters" }).click();
  await page.getByText("Roster 1 has a racer missing", { exact: false }).waitFor();
  assert.deepEqual(configuration.rosters, packDocument.configuration.rosters);
  assert.deepEqual(errors, []);
  console.log("Derby Lab dashboard roster editor browser validation passed.");
} finally {
  await browser.close();
}
