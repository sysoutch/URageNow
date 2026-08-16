import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { repoRoot } from "@urage/shared/runtime/repositoryPaths";

const messengers = ["discord", "telegram", "matrix", "whatsapp"] as const;
const sourcePaths = [
  path.join(repoRoot, "dashboard", "src", "page.ts"),
  path.join(repoRoot, "dashboard", "src", "pageSections", "aiView.ts"),
  path.join(repoRoot, "dashboard", "src", "server", "routes", "readRoutes.ts")
];
const serverSource = await readFile(path.join(repoRoot, "dashboard", "src", "server.ts"), "utf8");

for (const messenger of messengers) {
  const assetRoot = path.join(repoRoot, "dashboard", "assets", "messengers", messenger);
  const logo = await readFile(path.join(assetRoot, "logo.svg"), "utf8");
  const theme = JSON.parse(await readFile(path.join(assetRoot, "theme.json"), "utf8")) as {
    variables?: Record<string, string>;
  };
  assert.ok(logo.includes("<svg"), `${messenger} logo must be an SVG`);
  assert.ok(theme.variables && Object.keys(theme.variables).length > 0, `${messenger} theme must define variables`);
}

const sources = (await Promise.all(sourcePaths.map(filePath => readFile(filePath, "utf8")))).join("\n");
for (const messenger of messengers) {
  assert.ok(sources.includes(`/assets/messengers/${messenger}/logo.svg`), `Missing ${messenger} asset URL`);
}
assert.equal(/\/bots\/[^"']+_(?:logo)\.svg/.test(sources), false);
assert.equal(/bots\/[^"']+\/dashboard-theme\.json/.test(sources), false);
assert.equal(serverSource.includes('pathname.startsWith("/bots/")'), false);
assert.equal(serverSource.includes('pathname.startsWith("/assets/messengers/")'), true);

console.log("Dashboard messenger asset validation passed.");
