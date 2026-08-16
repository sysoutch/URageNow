import { Routes, type REST } from "discord.js";
import type { CommandSettings } from "./commandSettingsStore.js";

export type CommandScopeState = {
  globalEnabledCommands: string[];
  guildEnabledCommands: string[];
  guildDisabledInheritedCommands: string[];
};

type CommandSyncServiceDependencies = {
  appClientId: string | null | undefined;
  commandRest: REST;
  getCommandSettings: () => CommandSettings;
  setCommandSettings: (settings: CommandSettings) => void;
  saveCommandSettings: (settings: CommandSettings) => Promise<CommandSettings>;
  buildCommandJsonByNames: (names: string[]) => unknown[];
};

export type CommandSyncService = {
  persistCommandSettings: (nextSettings: CommandSettings) => Promise<CommandSettings>;
  getCommandScopeState: (guildId: string | null | undefined) => CommandScopeState;
  syncGlobalCommands: () => Promise<number>;
  syncGuildCommands: (guildId: string) => Promise<number>;
};

function ensureClientId(appClientId: string | null | undefined): string {
  const clientId = appClientId?.trim() ?? "";
  if (!clientId) {
    throw new Error("DISCORD_CLIENT_ID is required for command sync.");
  }
  return clientId;
}

function buildEffectiveGuildCommandNames(settings: CommandSettings, guildId: string): string[] {
  return [...new Set([
    ...settings.globalEnabledCommands.filter(name => !(settings.guildDisabledInheritedCommands[guildId] ?? []).includes(name)),
    ...(settings.guildEnabledCommands[guildId] ?? [])
  ])];
}

export function createCommandSyncService(dependencies: CommandSyncServiceDependencies): CommandSyncService {
  async function persistCommandSettings(nextSettings: CommandSettings): Promise<CommandSettings> {
    const saved = await dependencies.saveCommandSettings(nextSettings);
    dependencies.setCommandSettings(saved);
    return saved;
  }

  function getCommandScopeState(guildId: string | null | undefined): CommandScopeState {
    const settings = dependencies.getCommandSettings();
    return {
      globalEnabledCommands: [...settings.globalEnabledCommands],
      guildEnabledCommands: guildId ? [...(settings.guildEnabledCommands[guildId] ?? [])] : [],
      guildDisabledInheritedCommands: guildId ? [...(settings.guildDisabledInheritedCommands[guildId] ?? [])] : []
    };
  }

  async function syncGlobalCommands(): Promise<number> {
    const clientId = ensureClientId(dependencies.appClientId);
    const settings = dependencies.getCommandSettings();
    const commands = dependencies.buildCommandJsonByNames(settings.globalEnabledCommands);
    await dependencies.commandRest.put(Routes.applicationCommands(clientId), { body: commands });
    return commands.length;
  }

  async function syncGuildCommands(guildId: string): Promise<number> {
    const clientId = ensureClientId(dependencies.appClientId);
    const settings = dependencies.getCommandSettings();
    const commands = dependencies.buildCommandJsonByNames(buildEffectiveGuildCommandNames(settings, guildId));
    await dependencies.commandRest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
    return commands.length;
  }

  return {
    persistCommandSettings,
    getCommandScopeState,
    syncGlobalCommands,
    syncGuildCommands
  };
}
