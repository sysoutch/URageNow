import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Colors,
  EmbedBuilder,
  MessageFlags,
  type ButtonInteraction,
  type Client,
  type GuildTextBasedChannel
} from "discord.js";
import { RuntimeState } from "@urage/server/runtime/runtimeState";

type HoneypotVerificationServiceDependencies = {
  client: Client;
  runtimeState: RuntimeState;
  verifyPrefix: string;
  canSendMessages: (channel: unknown) => boolean;
  sendChunkedToTarget: (target: any, content: string) => Promise<void>;
  persistRuntimeState: () => Promise<void>;
  recordAction: (type: string, summary: string) => void;
};

export const HONEYPOT_VERIFY_CUSTOM_ID_PREFIX = "honeypot-verify:";

function buildDisabledVerifyComponents(customId: string): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(customId)
        .setLabel("Verified")
        .setStyle(ButtonStyle.Success)
        .setDisabled(true)
    )
  ];
}

async function resolveReviewChannel(client: Client, channelId: string | null): Promise<GuildTextBasedChannel | null> {
  if (!channelId) {
    return null;
  }
  try {
    const channel = await client.channels.fetch(channelId);
    return channel?.isTextBased() && "send" in channel && typeof channel.send === "function"
      ? channel as GuildTextBasedChannel
      : null;
  } catch {
    return null;
  }
}

async function postReviewUpdate(
  dependencies: HoneypotVerificationServiceDependencies,
  input: {
    guildId: string;
    reviewChannelId: string | null;
    title: string;
    description: string;
    color: number;
  }
): Promise<void> {
  const channel = await resolveReviewChannel(dependencies.client, input.reviewChannelId);
  if (!channel || !dependencies.canSendMessages(channel)) {
    return;
  }
  await channel.send({
    embeds: [
      new EmbedBuilder()
        .setColor(input.color)
        .setTitle(input.title)
        .setDescription(input.description)
        .setFooter({ text: `Discrod honeypot • guild ${input.guildId}` })
    ]
  }).catch(() => undefined);
}

export function createHoneypotVerificationService(dependencies: HoneypotVerificationServiceDependencies) {
  async function handleHoneypotVerify(interaction: ButtonInteraction): Promise<void> {
    const recordId = interaction.customId.slice(dependencies.verifyPrefix.length).trim();
    const record = dependencies.runtimeState.getHoneypotPendingVerification(recordId);
    if (!record) {
      await interaction.reply({ content: "That verification request is no longer available.", flags: MessageFlags.Ephemeral });
      return;
    }
    if (record.resolvedAt) {
      await interaction.reply({ content: "That verification request was already resolved.", flags: MessageFlags.Ephemeral });
      return;
    }
    if (interaction.user.id !== record.userId) {
      await interaction.reply({ content: "Only the flagged user can verify this request.", flags: MessageFlags.Ephemeral });
      return;
    }

    const resolved = dependencies.runtimeState.resolveHoneypotPendingVerification(recordId, {
      verifiedByUserId: interaction.user.id,
      verifiedByTag: interaction.user.tag
    });
    if (!resolved) {
      await interaction.reply({ content: "That verification request was already resolved.", flags: MessageFlags.Ephemeral });
      return;
    }

    const guild = dependencies.client.guilds.cache.get(record.guildId)
      ?? await dependencies.client.guilds.fetch(record.guildId).catch(() => null);
    let timeoutRemoved = false;
    let unbanned = false;
    if (guild) {
      if (record.postVerifyAction === "remove-timeout") {
        const member = await guild.members.fetch(record.userId).catch(() => null);
        if (member?.moderatable && member.communicationDisabledUntilTimestamp && member.communicationDisabledUntilTimestamp > Date.now()) {
          timeoutRemoved = await member.timeout(null, `Honeypot verification by ${interaction.user.tag}`).then(() => true).catch(() => false);
        }
      } else if (record.postVerifyAction === "unban") {
        unbanned = await guild.bans.remove(record.userId, `Honeypot verification by ${interaction.user.tag}`).then(() => true).catch(() => false);
      }
    }

    await dependencies.persistRuntimeState();

    await postReviewUpdate(dependencies, {
      guildId: record.guildId,
      reviewChannelId: record.reviewChannelId,
      title: "Honeypot verification completed",
      description: [
        `**User:** <@${record.userId}> (${record.username})`,
        `**Verified by:** <@${interaction.user.id}>`,
        `**Post action:** ${record.postVerifyAction}`,
        `**Timeout removed:** ${timeoutRemoved ? "yes" : "no"}`,
        `**Unbanned:** ${unbanned ? "yes" : "no"}`,
        `**Source channel:** <#${record.sourceChannelId}>`
      ].join("\n"),
      color: Colors.Green
    });

    const components = buildDisabledVerifyComponents(`${dependencies.verifyPrefix}${record.id}`);
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content: "Verification received.", flags: MessageFlags.Ephemeral }).catch(() => undefined);
    } else {
      await interaction.update({
        content: "Verification received. The server staff have been notified.",
        components
      }).catch(async () => {
        await interaction.reply({ content: "Verification received.", flags: MessageFlags.Ephemeral }).catch(() => undefined);
      });
    }

    dependencies.recordAction(
      "moderation:honeypot-verify",
      `${interaction.user.tag} verified honeypot case for ${record.username}. timeoutRemoved=${timeoutRemoved} unbanned=${unbanned}`
    );
  }

  async function processExpiredHoneypotVerifications(): Promise<void> {
    const expired = dependencies.runtimeState.listExpiredHoneypotPendingVerifications();
    for (const record of expired) {
      const guild = dependencies.client.guilds.cache.get(record.guildId)
        ?? await dependencies.client.guilds.fetch(record.guildId).catch(() => null);
      let finalActionTaken: "none" | "kick" | "ban" = "none";
      if (guild && record.unverifiedAction === "kick") {
        const member = await guild.members.fetch(record.userId).catch(() => null);
        if (member) {
          finalActionTaken = await member.kick("Honeypot verification window expired").then(() => "kick" as const).catch(() => "none" as const);
        }
      } else if (guild && record.unverifiedAction === "ban") {
        finalActionTaken = await guild.members.ban(record.userId, { reason: "Honeypot verification window expired" }).then(() => "ban" as const).catch(() => "none" as const);
      }

      const resolved = dependencies.runtimeState.finalizeExpiredHoneypotPendingVerification(record.id, finalActionTaken);
      if (!resolved) {
        continue;
      }

      await dependencies.persistRuntimeState();
      await postReviewUpdate(dependencies, {
        guildId: record.guildId,
        reviewChannelId: record.reviewChannelId,
        title: "Honeypot verification expired",
        description: [
          `**User:** <@${record.userId}> (${record.username})`,
          `**Configured final action:** ${record.unverifiedAction}`,
          `**Applied final action:** ${finalActionTaken}`,
          `**Source channel:** <#${record.sourceChannelId}>`
        ].join("\n"),
        color: Colors.Red
      });
      dependencies.recordAction(
        "moderation:honeypot-expired",
        `Expired honeypot case for ${record.username}. configured=${record.unverifiedAction} applied=${finalActionTaken}`
      );
    }
  }

  return {
    handleHoneypotVerify,
    processExpiredHoneypotVerifications
  };
}
