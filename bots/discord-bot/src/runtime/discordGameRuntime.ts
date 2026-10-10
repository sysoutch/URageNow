import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  StringSelectMenuBuilder,
  type ChatInputCommandInteraction,
  type Interaction
} from "discord.js";
import { listGamePackages, getInstalledGamePackage } from "@urage/server/services/games/gamePackageStore";
import type { InstalledGamePackage } from "@urage/server/services/games/gamePackageStore";
import { createTypingSpeedGameAdapter } from "./games/typingSpeedGameAdapter.js";
import { createRacingGameAdapter } from "./games/racingGameAdapter.js";
import { createUltimateTexasHoldemGameAdapter } from "./games/ultimateTexasHoldemGameAdapter.js";

type DiscordGameAdapter = {
  openSettings: (interaction: any, game: { packageInfo: InstalledGamePackage; configuration: Record<string, unknown> }) => Promise<void>;
  start: (interaction: any, game: { packageInfo: InstalledGamePackage; configuration: Record<string, unknown> }) => Promise<void>;
  handleInteraction: (interaction: Interaction) => Promise<boolean>;
};

// Game adapters own their own replies, so a router-level failure notice has to
// cope with an interaction they may already have answered or deferred.
async function replyEphemeral(interaction: any, content: string): Promise<void> {
  try {
    if (interaction.deferred || interaction.replied) await interaction.followUp({ content, flags: MessageFlags.Ephemeral });
    else await interaction.reply({ content, flags: MessageFlags.Ephemeral });
  } catch {
    // The reply channel is unavailable; the logged error is the record.
  }
}

const gameAdapters: Record<string, DiscordGameAdapter> = {
  "typing-speed": createTypingSpeedGameAdapter(),
  "animal-racing": createRacingGameAdapter(),
  "ultimate-texas-holdem": createUltimateTexasHoldemGameAdapter()
};

export function createDiscordGameRuntime() {
  async function handleGamesCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const { installed } = await listGamePackages();
    if (!interaction.inGuild()) {
      await interaction.reply({ content: "Games are available inside a Discord server channel.", flags: MessageFlags.Ephemeral });
      return;
    }
    const playable = installed.filter(game => game.enabledRuntimes.includes("discord") && gameAdapters[game.gameType]).slice(0, 25);
    if (!playable.length) {
      await interaction.reply({ content: "No Discord games are enabled yet. An administrator can import and enable games in the dashboard's Games view.", flags: MessageFlags.Ephemeral });
      return;
    }
    const menu = new StringSelectMenuBuilder()
      .setCustomId("urage-game:select")
      .setPlaceholder("Choose a game")
      .addOptions(playable.map(game => ({
        label: game.name.slice(0, 100),
        description: (game.description || game.id).slice(0, 100),
        value: game.id
      })));
    await interaction.reply({
      content: "Choose a game to start. Each game package is loaded from the runtime catalog.",
      components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)],
      flags: MessageFlags.Ephemeral
    });
  }

  async function handleInteraction(interaction: Interaction): Promise<boolean> {
    if (interaction.isStringSelectMenu() && interaction.customId === "urage-game:select") {
      const gameId = interaction.values[0] || "";
      const game = await getInstalledGamePackage(gameId);
      if (!game || !game.packageInfo.enabledRuntimes.includes("discord")) {
        await interaction.reply({ content: "That game is no longer enabled for Discord.", flags: MessageFlags.Ephemeral });
        return true;
      }
      const adapter = gameAdapters[game.packageInfo.gameType];
      if (!adapter) {
        await interaction.reply({ content: "This package uses a game type that Discord does not support yet.", flags: MessageFlags.Ephemeral });
        return true;
      }
      await interaction.update({
        content: `**${game.packageInfo.name}**\n${game.packageInfo.description || "Ready to play."}`,
        components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId(`urage-game:${gameId}:open`).setLabel("Start game").setStyle(ButtonStyle.Primary)
        )]
      });
      return true;
    }
    const customId = "customId" in interaction ? String(interaction.customId || "") : "";
    if (!customId.startsWith("urage-game:")) return false;
    const [, gameId, action] = customId.split(":");
    if (!gameId || !action) return true;
    const game = await getInstalledGamePackage(gameId);
    if (action === "open") {
      if (!interaction.isButton()) return true;
      if (!game || !game.packageInfo.enabledRuntimes.includes("discord")) {
        await interaction.reply({ content: "That game is no longer enabled for Discord.", flags: MessageFlags.Ephemeral });
        return true;
      }
      const adapter = gameAdapters[game.packageInfo.gameType];
      if (!adapter) {
        await interaction.reply({ content: "This package uses an unsupported game type.", flags: MessageFlags.Ephemeral });
        return true;
      }
      await adapter.openSettings(interaction, game);
      return true;
    }
    // Route the interaction to the adapter that owns the package's game type.
    // Adapters are independently installed, so an interaction must never be
    // offered to an adapter for a different game: that adapter would answer on
    // behalf of the game and validate its configuration against foreign settings.
    const adapter = game ? gameAdapters[game.packageInfo.gameType] : undefined;
    if (!adapter) {
      // The package was removed or its document is unreadable, so there is no
      // game type to route on; any adapter may still retire orphaned sessions.
      for (const candidate of Object.values(gameAdapters)) {
        if (await candidate.handleInteraction(interaction)) return true;
      }
      return true;
    }
    try {
      await adapter.handleInteraction(interaction);
    } catch (error) {
      console.error("Discord game interaction failed:", error);
      await replyEphemeral(interaction, "That game action failed. Reopen the game and try again.");
    }
    return true;
  }

  return { handleGamesCommand, handleInteraction };
}
