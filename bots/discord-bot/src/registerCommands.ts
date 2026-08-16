import { REST, Routes } from "discord.js";
import { appConfig } from "@urage/server/config/appConfig";
import { buildCommandJsonByNames, getAllCommandNames } from "./services/commandCatalog.js";
import { loadCommandSettings } from "./services/commandSettingsStore.js";

async function main(): Promise<void> {
  if (!appConfig.discordClientId) {
    throw new Error("DISCORD_CLIENT_ID is required to register slash commands.");
  }

  const rest = new REST({ version: "10" }).setToken(appConfig.discordToken);
  const commandSettings = await loadCommandSettings();
  const globalCommands = buildCommandJsonByNames(commandSettings.globalEnabledCommands);

  await rest.put(Routes.applicationCommands(appConfig.discordClientId), { body: globalCommands });

  const defaultGuildId = appConfig.discordGuildId;
  if (defaultGuildId) {
    const guildCommandNames = [...new Set([
      ...commandSettings.globalEnabledCommands.filter(name => !(commandSettings.guildDisabledInheritedCommands[defaultGuildId] ?? []).includes(name)),
      ...(commandSettings.guildEnabledCommands[defaultGuildId] ?? getAllCommandNames())
    ])];
    const guildCommands = buildCommandJsonByNames(guildCommandNames);
    await rest.put(
      Routes.applicationGuildCommands(appConfig.discordClientId, defaultGuildId),
      { body: guildCommands }
    );
    console.log(`Registered ${globalCommands.length} global command(s) and ${guildCommands.length} guild command(s).`);
    return;
  }

  console.log(`Registered ${globalCommands.length} global command(s).`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
