import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Colors,
  EmbedBuilder,
  GuildMember,
  MessageFlags,
  type ButtonInteraction,
  type Client
} from "discord.js";

type ModerationVetoRecord = {
  id: string;
  guildId: string;
  userId: string;
  username: string;
  reason: string;
  resolvedAt: string | null;
};

type ModerationVetoServiceDependencies = {
  client: Client;
  vetoPrefix: string;
  getModerationVetoRecord: (id: string) => ModerationVetoRecord | null;
  resolveModerationVetoRecord: (id: string, input: { vetoedByUserId: string; vetoedByTag: string }) => ModerationVetoRecord | null;
  isProtectedGuildMember: (member: GuildMember | null) => boolean;
  getGuildSettings: (guildId: string) => Promise<{ investigationRoleId: string | null }>;
  canSendMessages: (channel: unknown) => boolean;
  sendChunkedToTarget: (target: any, content: string) => Promise<void>;
  recordAction: (type: string, summary: string) => void;
};

type ModerationVetoService = {
  handleModerationVeto: (interaction: ButtonInteraction) => Promise<void>;
};

export function createModerationVetoService(dependencies: ModerationVetoServiceDependencies): ModerationVetoService {
  async function handleModerationVeto(interaction: ButtonInteraction): Promise<void> {
    const vetoId = interaction.customId.slice(dependencies.vetoPrefix.length).trim();
    const record = dependencies.getModerationVetoRecord(vetoId);
    if (!record) {
      await interaction.reply({ content: "That veto is no longer available.", flags: MessageFlags.Ephemeral });
      return;
    }
    if (record.resolvedAt) {
      await interaction.reply({ content: "That veto was already used.", flags: MessageFlags.Ephemeral });
      return;
    }
    const interactingMember = interaction.member instanceof GuildMember ? interaction.member : null;
    const canVeto = interaction.user.id === record.userId || dependencies.isProtectedGuildMember(interactingMember);
    if (!canVeto) {
      await interaction.reply({ content: "Only the flagged user or a mod/admin can veto this.", flags: MessageFlags.Ephemeral });
      return;
    }
    const resolved = dependencies.resolveModerationVetoRecord(vetoId, { vetoedByUserId: interaction.user.id, vetoedByTag: interaction.user.tag });
    if (!resolved) {
      await interaction.reply({ content: "That veto was already used.", flags: MessageFlags.Ephemeral });
      return;
    }
    const guild = dependencies.client.guilds.cache.get(record.guildId) ?? await dependencies.client.guilds.fetch(record.guildId).catch(() => null);
    let timeoutRevoked = false;
    let investigationRoleAssigned = false;
    let investigationRoleName: string | null = null;
    if (guild) {
      const member = await guild.members.fetch(record.userId).catch(() => null);
      if (member?.moderatable && member.communicationDisabledUntilTimestamp && member.communicationDisabledUntilTimestamp > Date.now()) {
        timeoutRevoked = await member.timeout(null, `Moderation veto by ${interaction.user.tag}`).then(() => true).catch(() => false);
      }
      const guildSettings = await dependencies.getGuildSettings(guild.id);
      if (member && guildSettings.investigationRoleId) {
        const role = guild.roles.cache.get(guildSettings.investigationRoleId) ?? await guild.roles.fetch(guildSettings.investigationRoleId).catch(() => null);
        if (role) {
          investigationRoleName = role.name;
          investigationRoleAssigned = await member.roles.add(role.id, `Moderation veto by ${interaction.user.tag}`).then(() => true).catch(() => false);
        }
      }
    }
    const updatedEmbed = new EmbedBuilder()
      .setColor(Colors.Green)
      .setTitle("Flagged image vetoed")
      .setDescription([
        `**User:** <@${resolved.userId}>`,
        `**Vetoed by:** <@${interaction.user.id}>`,
        `**Timeout revoked:** ${timeoutRevoked ? "yes" : "no"}`,
        `**Investigation role:** ${investigationRoleAssigned ? (investigationRoleName ?? "assigned") : "not assigned"}`,
        "**Status:** images stay removed while the case waits for admin review"
      ].join("\n"))
      .addFields({
        name: "Original reason",
        value: resolved.reason.length > 900 ? `${resolved.reason.slice(0, 897)}...` : resolved.reason
      })
      .setFooter({
        text: "Discrod moderation • veto recorded"
      });
    const components = [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(`${dependencies.vetoPrefix}${resolved.id}`).setLabel("Vetoed").setStyle(ButtonStyle.Secondary).setDisabled(true))];
    await interaction.update({
      content: "https://tenor.com/view/doakes-im-watching-you-gif-16773151899168519026",
      embeds: [updatedEmbed],
      components
    });
    if (interaction.channel && dependencies.canSendMessages(interaction.channel)) {
      await dependencies.sendChunkedToTarget(interaction.channel, `Veto accepted for <@${resolved.userId}> by <@${interaction.user.id}>.` + ` Timeout revoked: ${timeoutRevoked ? "yes" : "no"}.` + ` Investigation role assigned: ${investigationRoleAssigned ? "yes" : "no"}.` + " The removed images will stay removed while admins review it.");
    }
    dependencies.recordAction("moderation:veto", `${interaction.user.tag} vetoed flagged image moderation for ${resolved.username}. timeoutRevoked=${timeoutRevoked} investigationRoleAssigned=${investigationRoleAssigned}`);
  }

  return {
    handleModerationVeto
  };
}
