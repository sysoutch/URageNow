import { PermissionFlagsBits, type ChatInputCommandInteraction } from "discord.js";

interface SendableChannel {
  send: (content: string | import("discord.js").MessagePayload | import("discord.js").MessageCreateOptions) => Promise<unknown>;
}

interface AdminCoreCommandDependencies {
  canSendMessages: (channel: unknown) => channel is SendableChannel;
  sendChunkedToChannel: (channel: SendableChannel, content: string) => Promise<void>;
  sendDirectMessage: (userId: string, content: string) => Promise<void>;
  describeChannel: (channel: unknown) => string;
  summarizeText: (text: string, maxLength?: number) => string;
  recordAction: (type: string, summary: string) => void;
}

export async function handleAdminCoreSlashCommands(
  interaction: ChatInputCommandInteraction,
  dependencies: AdminCoreCommandDependencies
): Promise<boolean> {
  const isGuildAdministrator = interaction.inGuild() && (interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) || false);
  if (interaction.commandName === "ping") {
    dependencies.recordAction("slash:/ping", `${interaction.user.tag} pinged the bot.`);
    await interaction.reply({ content: "pong", ephemeral: true });
    return true;
  }
  if (interaction.commandName === "say") {
    if (!isGuildAdministrator) {
      await interaction.reply({ content: "Only server administrators can use `/say`.", ephemeral: true });
      return true;
    }
    const channel = interaction.options.getChannel("channel", true);
    const content = interaction.options.getString("message", true).trim();
    if (!dependencies.canSendMessages(channel)) {
      await interaction.reply({ content: "That channel cannot receive messages from the bot.", ephemeral: true });
      return true;
    }
    await dependencies.sendChunkedToChannel(channel, content);
    dependencies.recordAction("slash:/say", `${interaction.user.tag} -> ${dependencies.describeChannel(channel)}: ${dependencies.summarizeText(content)}`);
    await interaction.reply({ content: "Message sent.", ephemeral: true });
    return true;
  }
  if (interaction.commandName === "dm") {
    if (!isGuildAdministrator) {
      await interaction.reply({ content: "Only server administrators can use `/dm`.", ephemeral: true });
      return true;
    }
    const user = interaction.options.getUser("user", true);
    const content = interaction.options.getString("message", true).trim();
    await dependencies.sendDirectMessage(user.id, content);
    dependencies.recordAction("slash:/dm", `${interaction.user.tag} -> ${user.tag}: ${dependencies.summarizeText(content)}`);
    await interaction.reply({ content: "Direct message sent.", ephemeral: true });
    return true;
  }
  return false;
}
