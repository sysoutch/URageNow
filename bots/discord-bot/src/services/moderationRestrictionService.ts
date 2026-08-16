import type { Message } from "discord.js";
import type { SendableTarget } from "./discordMessageUtils.js";
import type { ModerationEvent } from "@urage/shared/dashboard/runtimeContracts";

type ModerationRestrictionServiceDependencies = {
  getGuildSettings: (guildId: string) => Promise<{ investigationRoleId: string | null; temporaryImageBlockRoleId: string | null }>;
  canSendMessages: (channel: unknown) => boolean;
  sendChunkedToTarget: (targetChannel: SendableTarget, content: string) => Promise<void>;
  recordModeration: (entry: Omit<ModerationEvent, "id" | "createdAt">) => void;
};

type ModerationRestrictionService = {
  containsRestrictedLinkContent: (content: string) => boolean;
  enforceModerationRoleRestrictions: (message: Message) => Promise<boolean>;
};

function containsRestrictedLinkContent(content: string): boolean {
  return /(?:https?:\/\/|www\.|discord\.gg\/|discord\.com\/invite\/)/i.test(content);
}

export function createModerationRestrictionService(dependencies: ModerationRestrictionServiceDependencies): ModerationRestrictionService {
  async function enforceModerationRoleRestrictions(message: Message): Promise<boolean> {
    if (!message.guild || !message.member || message.author.bot) {
      return false;
    }
    const settings = await dependencies.getGuildSettings(message.guild.id);
    const hasInvestigationRole = !!settings.investigationRoleId && message.member.roles.cache.has(settings.investigationRoleId);
    const hasTemporaryImageBlockRole = !!settings.temporaryImageBlockRoleId && message.member.roles.cache.has(settings.temporaryImageBlockRoleId);
    if (!hasInvestigationRole && !hasTemporaryImageBlockRole) {
      return false;
    }
    const hasImageAttachment = [...message.attachments.values()].some(attachment => {
      if (attachment.contentType?.startsWith("image/")) {
        return true;
      }
      return /\.(png|jpe?g|gif|webp|bmp)$/i.test(attachment.name ?? "");
    });
    const hasRestrictedLinks = containsRestrictedLinkContent(message.content);
    const shouldBlock = hasInvestigationRole || hasImageAttachment || hasRestrictedLinks;
    if (!shouldBlock) {
      return false;
    }
    const deleted = await message.delete().then(() => true).catch(() => false);
    if (dependencies.canSendMessages(message.channel)) {
      const restrictionSummary = hasInvestigationRole ? "messages" : [hasImageAttachment ? "images" : null, hasRestrictedLinks ? "links" : null].filter(Boolean).join(" and ");
      await dependencies.sendChunkedToTarget(
        message.channel as SendableTarget,
        hasInvestigationRole
          ? `<@${message.author.id}>, your message was removed because your account is under investigation and cannot post ${restrictionSummary} until an admin clears it.`
          : `<@${message.author.id}>, your message was removed because your account is temporarily blocked from posting ${restrictionSummary} while image moderation is still deciding.`
      );
    }
    dependencies.recordModeration({
      type: "investigation-role",
      userId: message.author.id,
      username: message.author.tag,
      channels: [message.channelId],
      timedOut: false,
      deletedCount: deleted ? 1 : 0,
      imageUrls: hasImageAttachment
        ? [...message.attachments.values()]
          .filter(attachment => attachment.contentType?.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp)$/i.test(attachment.name ?? ""))
          .map(attachment => attachment.url)
        : [],
      reason: hasInvestigationRole
        ? "Investigation role restriction blocked message posting."
        : `Temporary image block role restriction blocked ${hasImageAttachment && hasRestrictedLinks ? "images and links" : hasImageAttachment ? "images" : "links"}.`
    });
    return true;
  }

  return {
    containsRestrictedLinkContent,
    enforceModerationRoleRestrictions
  };
}
