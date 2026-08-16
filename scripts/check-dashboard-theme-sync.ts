import assert from "node:assert/strict";
import {mkdtemp, readFile, rm} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {dashboardThemeIds} from "@urage/shared/dashboard/themeIds";
import {createDashboardThemePreferenceStore} from "@urage/server/services/dashboardThemePreference";

const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "urage-theme-sync-"));
try {
  const storePath = path.join(temporaryDirectory, "theme.json");
  const store = createDashboardThemePreferenceStore({storePath});
  assert.deepEqual(await store.read(), {theme: "fire", updatedAt: null});
  const saved = await store.save("water");
  assert.equal(saved.theme, "water");
  assert.ok(saved.updatedAt);
  assert.equal((await store.read()).theme, "water");
  assert.equal(JSON.parse(await readFile(storePath, "utf8")).theme, "water");

  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const companionRoutes = await readFile(path.join(root, "dashboard/src/server/companion/companionRoutes.ts"), "utf8");
  const dashboardRoutes = await readFile(path.join(root, "dashboard/src/server/routes/readRoutes.ts"), "utf8");
  const dashboardClient = await readFile(path.join(root, "dashboard/src/client/modules/shellRuntimeThemeHelpers.js"), "utf8");
  const androidThemes = await readFile(path.join(root, "apps/android-companion/app/src/main/java/com/uragestudio/companion/StudioThemeStore.java"), "utf8");
  assert.match(companionRoutes, /\/api\/companion\/theme/);
  assert.match(dashboardRoutes, /\/api\/theme-preference/);
  assert.match(dashboardClient, /publishDashboardThemePreference/);
  for (const theme of dashboardThemeIds) assert.match(androidThemes, new RegExp(`"${theme}"`));
} finally {
  await rm(temporaryDirectory, {recursive: true, force: true});
}

console.log("Dashboard-to-Android theme synchronization validation passed.");
