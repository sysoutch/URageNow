import { ChatInputCommandInteraction, MessageFlags } from "discord.js";

export async function handleHelpCommand(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  await interaction.reply({
    content: [
      "This is the Discrod bot interface.",
      "Available slash commands: `/help`, `/ping`, `/ask`, `/say`, `/dm`, `/gift`, `/humble`, `/model`, `/lowpoly`, `/image`, `/imagepooladd`, `/audio`, `/music`, `/invite`, `/task`",
      "Rod is available locally for text and vision prompts on the machine running the bot."
    ].join("\n"),
    flags: MessageFlags.Ephemeral
  });
}
