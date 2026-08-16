import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createDashboardSettingsStore } from "@urage/server/runtime/dashboardSettingsStore";
import { RuntimeState } from "@urage/server/runtime/runtimeState";

const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "urage-dashboard-settings-"));
const storePath = path.join(temporaryDirectory, "dashboard-settings.json");
const store = createDashboardSettingsStore({storePath});

try {
  assert.deepEqual(await store.load(), {
    globalSettings: {},
    defaultGuildSettings: {},
    guildSettings: {},
    honeypotPendingVerifications: []
  });

  await writeFile(storePath, JSON.stringify({
    settings: {
      requireConfirmationForLlmSend: false,
      antiSpamEnabled: false,
      ollamaTextModel: "legacy-text",
      ollamaVisionModel: "legacy-vision"
    },
    globalSettings: {
      ollamaTextModel: "current-text"
    },
    guildSettings: {
      "guild-1": {
        antiSpamEnabled: true
      }
    }
  }), "utf8");

  const migrated = await store.load();
  assert.equal(migrated.globalSettings.requireConfirmationForLlmSend, false);
  assert.equal(migrated.globalSettings.ollamaTextModel, "current-text");
  assert.equal(migrated.defaultGuildSettings.antiSpamEnabled, false);
  assert.equal(migrated.guildSettings["guild-1"]?.antiSpamEnabled, true);

  const firstSave = store.save({
    globalSettings: {ollamaTextModel: "first"},
    defaultGuildSettings: {},
    guildSettings: {},
    honeypotPendingVerifications: []
  });
  const secondSave = store.save({
    globalSettings: {ollamaTextModel: "second"},
    defaultGuildSettings: {},
    guildSettings: {},
    honeypotPendingVerifications: []
  });
  await Promise.all([firstSave, secondSave]);

  const persisted = JSON.parse(await readFile(storePath, "utf8")) as {
    globalSettings?: { ollamaTextModel?: string };
  };
  assert.equal(persisted.globalSettings?.ollamaTextModel, "second");

  const runtimeState = new RuntimeState();
  runtimeState.updateLlmConnectionSettings({lmStudioApiKey: "must-not-persist"});
  runtimeState.updateImageLlmConnectionSettings({lmStudioApiKey: "image-key-must-not-persist"});
  runtimeState.updateModel3dLlmConnectionSettings({lmStudioApiKey: "model3d-key-must-not-persist"});
  assert.equal(runtimeState.getGlobalDashboardSettings().lmStudioApiKey, "must-not-persist");
  assert.equal("lmStudioApiKey" in runtimeState.getStoredDashboardSettings().globalSettings, false);
  assert.equal("imageLmStudioApiKey" in runtimeState.getStoredDashboardSettings().globalSettings, false);
  assert.equal("model3dLmStudioApiKey" in runtimeState.getStoredDashboardSettings().globalSettings, false);
} finally {
  await rm(temporaryDirectory, {recursive: true, force: true});
}

console.log("Dashboard settings store validation passed.");
