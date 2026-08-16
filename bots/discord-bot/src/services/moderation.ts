import {
  ActionRowBuilder,
  Attachment,
  ButtonBuilder,
  ButtonStyle,
  Client,
  Colors,
  EmbedBuilder,
  GuildMember,
  Message,
  type TextBasedChannel
} from "discord.js";
import type { GuildDashboardSettings } from "@urage/shared/dashboard/runtimeContracts";
import {
  findConfiguredRuleMatch,
  shouldFlagImageAnalysis
} from "./moderationEvaluator.js";
import { sendChunkedToTarget } from "./discordMessageUtils.js";
import { RuntimeState } from "@urage/server/runtime/runtimeState";
import { analyzeImagesWithLlava } from "@urage/server/services/llm/ollama";

interface DuplicateSpamDependencies {
  client: Client;
  runtimeState: RuntimeState;
  persistRuntimeState: () => Promise<void>;
  isProtectedMember: (message: Message) => boolean;
  getProtectedMemberReasons: (message: Message) => string[];
  getGuildModerationRoles: (guildId: string) => Promise<{
    investigationRoleId: string | null;
    temporaryImageBlockRoleId: string | null;
  }>;
}

interface ObservedMessage {
  message: Message;
  createdAt: number;
  key: string;
  channelsKey: string;
  imageAttachments: Attachment[];
}

interface LlavaSpamClassification {
  isSpam: boolean;
  isNsfw: boolean;
  isCryptoSpam: boolean;
  showsCryptoImage: boolean;
  reason: string;
}

interface TemporaryInvestigationHoldState {
  guildId: string;
  userId: string;
  roleId: string;
  pendingCount: number;
  holdUntil: number;
  assignedByHold: boolean;
  keepRole: boolean;
  releaseTimer: ReturnType<typeof setTimeout> | null;
}

export const MODERATION_VETO_CUSTOM_ID_PREFIX = "moderation-veto:";
export const HONEYPOT_VERIFY_CUSTOM_ID_PREFIX = "honeypot-verify:";
const honeypotLinkPattern = /\b(?:https?:\/\/|www\.|discord\.gg\/)\S+/i;

function normalizeContent(content: string): string {
  return content.trim().replace(/\s+/g, " ").toLowerCase();
}

function isImageAttachment(attachment: Attachment): boolean {
  if (attachment.contentType?.startsWith("image/")) {
    return true;
  }

  return /\.(png|jpe?g|gif|webp|bmp)$/i.test(attachment.name ?? "");
}

function buildFingerprint(message: Message): { key: string; imageAttachments: Attachment[] } | null {
  const text = normalizeContent(message.content);
  const attachments = [...message.attachments.values()];
  const imageAttachments = attachments.filter(isImageAttachment);
  const attachmentSignature = imageAttachments
    .map(attachment => `${attachment.name ?? "unknown"}:${attachment.size}`)
    .join("|");

  if (!text && !attachmentSignature) {
    return null;
  }

  return {
    key: `${message.author.id}::${text}::${attachmentSignature}`,
    imageAttachments
  };
}

async function safeDelete(message: Message): Promise<boolean> {
  try {
    await message.delete();
    return true;
  } catch {
    return false;
  }
}

async function safeTimeout(member: GuildMember | null, timeoutMs: number, reason: string): Promise<boolean> {
  if (!member?.moderatable) {
    return false;
  }

  try {
    await member.timeout(timeoutMs, reason);
    return true;
  } catch {
    return false;
  }
}

async function analyzeFlaggedImages(imageUrls: string[]): Promise<LlavaSpamClassification> {
  return analyzeImagesWithLlava(imageUrls);
}

function truncateReason(reason: string, maxLength = 900): string {
  const trimmed = reason.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength - 3)}...`;
}

function buildImageModerationEmbed(input: {
  noticePrefix: string;
  message: Message;
  analysis: LlavaSpamClassification;
  deletedCount: number;
  timedOut: boolean;
  imageCount: number;
  isProtected: boolean;
  vetoedByTag?: string | null;
}): EmbedBuilder {
  const lines = [
    `**User:** <@${input.message.author.id}>`,
    `**Removed:** ${input.deletedCount} message(s)`,
    `**Timeout applied:** ${input.timedOut ? "yes" : "no"}`,
    "**Veto:** the flagged user can click the button if this was a mistake"
  ];

  if (input.isProtected) {
    lines.push("**Protected member:** timeout skipped only cause ur a mod/admin");
  }

  if (input.vetoedByTag) {
    lines.push(`**Vetoed by:** ${input.vetoedByTag}`);
  }

  return new EmbedBuilder()
    .setColor(input.vetoedByTag ? Colors.Green : input.isProtected ? Colors.Orange : Colors.Red)
    .setTitle(input.noticePrefix)
    .setDescription(lines.join("\n"))
    .addFields(
      {
        name: "Reason",
        value: truncateReason(input.analysis.reason)
      },
      {
        name: "Images",
        value: `${input.imageCount}`,
        inline: true
      }
    )
    .setFooter({
      text: input.vetoedByTag
        ? "Discrod moderation • veto recorded"
        : "Discrod moderation"
    });
}

function buildAlertEmbed(input: {
  title: string;
  message: Message;
  analysisReason: string;
  deletedCount: number;
  timedOut: boolean;
  imageUrls: string[];
  content: string;
}): EmbedBuilder {
  const trimmedContent = input.content.trim();
  return new EmbedBuilder()
    .setColor(Colors.Blurple)
    .setTitle(input.title)
    .setDescription([
      `**User:** <@${input.message.author.id}> (${input.message.author.tag})`,
      `**Channel:** <#${input.message.channelId}>`,
      `**Deleted:** ${input.deletedCount} message(s)`,
      `**Timeout applied:** ${input.timedOut ? "yes" : "no"}`
    ].join("\n"))
    .addFields(
      {
        name: "Reason",
        value: truncateReason(input.analysisReason)
      },
      {
        name: "Message copy",
        value: trimmedContent.length > 0 ? truncateReason(trimmedContent, 900) : "*Attachment-only message*"
      },
      {
        name: "Image links",
        value: input.imageUrls.length > 0
          ? truncateReason(input.imageUrls.join("\n"), 900)
          : "*No image links*"
      }
    )
    .setFooter({
      text: "Discrod moderation alert"
    });
}

function buildImageModerationComponents(input: {
  vetoId: string | null;
  vetoResolved: boolean;
}): ActionRowBuilder<ButtonBuilder> {
  const row = new ActionRowBuilder<ButtonBuilder>();

  if (input.vetoId) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`${MODERATION_VETO_CUSTOM_ID_PREFIX}${input.vetoId}`)
        .setLabel(input.vetoResolved ? "Vetoed" : "Veto")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(input.vetoResolved)
    );
  }

  return row;
}

function buildHoneypotVerifyComponents(recordId: string): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`${HONEYPOT_VERIFY_CUSTOM_ID_PREFIX}${recordId}`)
        .setLabel("Verify")
        .setStyle(ButtonStyle.Success)
    )
  ];
}

export function createDuplicateSpamGuard(dependencies: DuplicateSpamDependencies): {
  inspectMessage: (message: Message) => Promise<void>;
} {
  const byKey = new Map<string, ObservedMessage[]>();
  const handledUntil = new Map<string, number>();
  const imageChecksInFlightByUser = new Set<string>();
  const temporaryInvestigationHolds = new Map<string, TemporaryInvestigationHoldState>();

  function getTemporaryHoldKey(guildId: string, userId: string): string {
    return `${guildId}:${userId}`;
  }

  function clearTemporaryInvestigationHoldTimer(state: TemporaryInvestigationHoldState): void {
    if (state.releaseTimer) {
      clearTimeout(state.releaseTimer);
      state.releaseTimer = null;
    }
  }

  async function removeTemporaryInvestigationRole(state: TemporaryInvestigationHoldState): Promise<void> {
    try {
      const guild = dependencies.client.guilds.cache.get(state.guildId)
        ?? await dependencies.client.guilds.fetch(state.guildId);
      const member = guild.members.cache.get(state.userId)
        ?? await guild.members.fetch(state.userId).catch(() => null);
      if (!member?.roles.cache.has(state.roleId)) {
        return;
      }

      await member.roles.remove(state.roleId, "Temporary image moderation hold expired");
    } catch {
      // Ignore cleanup failures; the hold is best-effort.
    }
  }

  async function settleTemporaryInvestigationHold(key: string): Promise<void> {
    const state = temporaryInvestigationHolds.get(key);
    if (!state) {
      return;
    }

    clearTemporaryInvestigationHoldTimer(state);

    if (state.pendingCount > 0) {
      return;
    }

    if (state.keepRole || !state.assignedByHold) {
      temporaryInvestigationHolds.delete(key);
      return;
    }

    const remainingMs = state.holdUntil - Date.now();
    if (remainingMs > 0) {
      state.releaseTimer = setTimeout(() => {
        void settleTemporaryInvestigationHold(key);
      }, remainingMs);
      return;
    }

    temporaryInvestigationHolds.delete(key);
    await removeTemporaryInvestigationRole(state);
  }

  async function acquireTemporaryInvestigationHold(
    message: Message,
    settings: GuildDashboardSettings
  ): Promise<{ release: (keepRole?: boolean) => Promise<void> }> {
    if (
      !settings.antiSpamTemporaryInvestigationHoldEnabled
      || settings.antiSpamTemporaryInvestigationHoldMs < 0
      || !message.guild
      || !message.member
      || dependencies.isProtectedMember(message)
    ) {
      return {
        release: async () => undefined
      };
    }

    const moderationRoles = await dependencies.getGuildModerationRoles(message.guild.id);
    const roleId = moderationRoles.temporaryImageBlockRoleId;
    if (!roleId) {
      return {
        release: async () => undefined
      };
    }

    const key = getTemporaryHoldKey(message.guild.id, message.author.id);
    let state = temporaryInvestigationHolds.get(key);
    if (!state) {
      state = {
        guildId: message.guild.id,
        userId: message.author.id,
        roleId,
        pendingCount: 0,
        holdUntil: 0,
        assignedByHold: false,
        keepRole: false,
        releaseTimer: null
      };
      temporaryInvestigationHolds.set(key, state);
    }

    state.roleId = roleId;
    state.pendingCount += 1;
    state.holdUntil = Math.max(state.holdUntil, Date.now() + settings.antiSpamTemporaryInvestigationHoldMs);
    clearTemporaryInvestigationHoldTimer(state);

    const alreadyHasRole = message.member.roles.cache.has(roleId);
    if (!alreadyHasRole) {
      try {
        await message.member.roles.add(roleId, "Temporary image moderation hold");
        state.assignedByHold = true;
      } catch {
        // Best-effort; moderation can continue even if the temporary hold role cannot be applied.
      }
    }

    return {
      release: async (keepRole = false) => {
        const currentState = temporaryInvestigationHolds.get(key);
        if (!currentState) {
          return;
        }

        currentState.pendingCount = Math.max(0, currentState.pendingCount - 1);
        if (keepRole) {
          currentState.keepRole = true;
        }

        await settleTemporaryInvestigationHold(key);
      }
    };
  }

  async function analyzeImagesForUser(
    message: Message,
    imageAttachments: Attachment[]
  ): Promise<
    | { status: "completed"; analysis: LlavaSpamClassification }
    | { status: "skipped"; reason: string }
  > {
    const userId = message.author.id;
    if (imageChecksInFlightByUser.has(userId)) {
      return {
        status: "skipped",
        reason: "Skipped Llava analysis because another image set from this user is still waiting on a model response."
      };
    }

    imageChecksInFlightByUser.add(userId);
    try {
      return {
        status: "completed",
        analysis: await analyzeFlaggedImages(imageAttachments.map(attachment => attachment.url))
      };
    } finally {
      imageChecksInFlightByUser.delete(userId);
    }
  }

  function cleanup(now: number, duplicateWindowMs: number): void {
    for (const [key, entries] of byKey.entries()) {
      const filtered = entries.filter(entry => now - entry.createdAt <= duplicateWindowMs);
      if (filtered.length === 0) {
        byKey.delete(key);
        continue;
      }

      byKey.set(key, filtered);
    }

    for (const [key, expiresAt] of handledUntil.entries()) {
      if (expiresAt <= now) {
        handledUntil.delete(key);
      }
    }
  }

  async function sendModerationAlertCopy(input: {
    title: string;
    sourceMessage: Message;
    analysisReason: string;
    deletedCount: number;
    timedOut: boolean;
    imageUrls: string[];
  }): Promise<void> {
    const guildId = input.sourceMessage.guild?.id;
    if (!guildId) {
      return;
    }

    const alertChannelId = dependencies.runtimeState
      .getGuildDashboardSettings(guildId)
      .antiSpamAlertChannelId;
    if (!alertChannelId || alertChannelId === input.sourceMessage.channelId) {
      return;
    }

    let channel: TextBasedChannel | null = null;
    try {
      const fetched = await dependencies.client.channels.fetch(alertChannelId);
      if (fetched?.isTextBased() && "send" in fetched && typeof fetched.send === "function") {
        channel = fetched;
      }
    } catch {
      channel = null;
    }

    if (!channel) {
      return;
    }

    await channel.send({
      embeds: [
        buildAlertEmbed({
          title: input.title,
          message: input.sourceMessage,
          analysisReason: input.analysisReason,
          deletedCount: input.deletedCount,
          timedOut: input.timedOut,
          imageUrls: input.imageUrls,
          content: input.sourceMessage.content
        })
      ]
    });
  }

  async function resolveTextChannel(channelId: string | null): Promise<any | null> {
    if (!channelId) {
      return null;
    }
    try {
      const fetched = await dependencies.client.channels.fetch(channelId);
      return fetched?.isTextBased() && "send" in fetched && typeof fetched.send === "function"
        ? fetched
        : null;
    } catch {
      return null;
    }
  }

  function shouldTriggerHoneypot(message: Message, settings: GuildDashboardSettings): boolean {
    if (!settings.honeypotEnabled || settings.honeypotChannelId !== message.channelId) {
      return false;
    }
    if (settings.honeypotExcludedChannelIds.includes(message.channelId)) {
      return false;
    }
    if (
      message.member
      && settings.honeypotExcludedRoleIds.length > 0
      && settings.honeypotExcludedRoleIds.some(roleId => message.member!.roles.cache.has(roleId))
    ) {
      return false;
    }
    const hasText = settings.honeypotTriggerOnText && message.content.trim().length > 0;
    const hasFiles = settings.honeypotTriggerOnFiles && message.attachments.size > 0;
    const hasLinks = settings.honeypotTriggerOnLinks && honeypotLinkPattern.test(message.content);
    return hasText || hasFiles || hasLinks;
  }

  async function safeKick(member: GuildMember | null, reason: string): Promise<boolean> {
    if (!member?.kickable) {
      return false;
    }
    try {
      await member.kick(reason);
      return true;
    } catch {
      return false;
    }
  }

  async function safeBan(member: GuildMember | null, reason: string): Promise<boolean> {
    if (!member?.bannable) {
      return false;
    }
    try {
      await member.ban({ reason });
      return true;
    } catch {
      return false;
    }
  }

  async function sendHoneypotBackupCopy(message: Message, settings: GuildDashboardSettings): Promise<void> {
    const channel = await resolveTextChannel(settings.honeypotBackupChannelId);
    if (!channel || settings.honeypotBackupChannelId === message.channelId) {
      return;
    }
    const attachmentLines = [...message.attachments.values()].map(attachment => attachment.url);
    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(Colors.Orange)
          .setTitle("Honeypot trigger backup")
          .setDescription([
            `**User:** <@${message.author.id}> (${message.author.tag})`,
            `**Channel:** <#${message.channelId}>`,
            `**Message:** ${message.content.trim() ? truncateReason(message.content, 900) : "*Attachment-only message*"}`,
            `**Attachments:** ${attachmentLines.length > 0 ? truncateReason(attachmentLines.join("\n"), 900) : "*None*"}`
          ].join("\n"))
          .setFooter({ text: "Discrod honeypot backup" })
      ]
    }).catch(() => undefined);
  }

  async function sendHoneypotReviewNotice(input: {
    message: Message;
    settings: GuildDashboardSettings;
    actionLabel: string;
    verifyRecordId?: string | null;
    dmDelivered: boolean;
    finalAction?: string;
  }): Promise<void> {
    const channel = await resolveTextChannel(input.settings.honeypotReviewChannelId);
    if (!channel) {
      return;
    }
    const description = [
      `**User:** <@${input.message.author.id}> (${input.message.author.tag})`,
      `**Channel:** <#${input.message.channelId}>`,
      `**Immediate action:** ${input.actionLabel}`,
      `**DM delivered:** ${input.dmDelivered ? "yes" : "no"}`,
      `**Verification record:** ${input.verifyRecordId || "none"}`,
      `**Message copy:** ${input.message.content.trim() ? truncateReason(input.message.content, 900) : "*Attachment-only message*"}`
    ];
    if (input.finalAction) {
      description.push(`**Final action:** ${input.finalAction}`);
    }
    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(Colors.Red)
          .setTitle("Honeypot triggered")
          .setDescription(description.join("\n"))
          .setFooter({ text: "Discrod honeypot review" })
      ]
    }).catch(() => undefined);
  }

  async function sendHoneypotVerificationDm(message: Message, settings: GuildDashboardSettings, actionLabel: string): Promise<{ recordId: string | null; delivered: boolean }> {
    if (!settings.honeypotDmEnabled) {
      return {recordId: null, delivered: false};
    }
    const record = dependencies.runtimeState.createHoneypotPendingVerification({
      guildId: message.guild!.id,
      userId: message.author.id,
      username: message.author.tag,
      honeypotChannelId: settings.honeypotChannelId || message.channelId,
      sourceChannelId: message.channelId,
      sourceMessageId: message.id,
      sourceContent: message.content,
      sourceAttachmentUrls: [...message.attachments.values()].map(attachment => attachment.url),
      immediateAction: settings.honeypotImmediateAction,
      postVerifyAction: settings.honeypotPostVerifyAction,
      unverifiedAction: settings.honeypotUnverifiedAction,
      verifyByAt: new Date(Date.now() + settings.honeypotVerificationWindowMs).toISOString(),
      reviewChannelId: settings.honeypotReviewChannelId
    });
    try {
      const dm = await message.author.createDM();
      const sent = await dm.send({
        content: `${settings.honeypotDmMessage || "Your message triggered the server honeypot."}\n\nImmediate action: ${actionLabel}\nVerification expires: <t:${Math.floor(new Date(record.verifyByAt).getTime() / 1000)}:R>`,
        components: buildHoneypotVerifyComponents(record.id)
      });
      dependencies.runtimeState.attachHoneypotVerificationMessage(record.id, {
        dmMessageId: sent.id,
        dmChannelId: dm.id
      });
      await dependencies.persistRuntimeState();
      return {recordId: record.id, delivered: true};
    } catch {
      const resolved = dependencies.runtimeState.finalizeExpiredHoneypotPendingVerification(record.id, "none");
      if (resolved) {
        await dependencies.persistRuntimeState();
      }
      return {recordId: null, delivered: false};
    }
  }

  async function applyHoneypotAction(message: Message, settings: GuildDashboardSettings): Promise<{ actionLabel: string; timedOut: boolean }> {
    const reason = "Honeypot channel triggered";
    if (dependencies.isProtectedMember(message)) {
      return {actionLabel: "protected-member-skip", timedOut: false};
    }
    if (settings.honeypotImmediateAction === "kick") {
      const kicked = await safeKick(message.member, reason);
      return {actionLabel: kicked ? "kick" : "kick-failed", timedOut: false};
    }
    if (settings.honeypotImmediateAction === "ban") {
      const banned = await safeBan(message.member, reason);
      return {actionLabel: banned ? "ban" : "ban-failed", timedOut: false};
    }
    const timedOut = await safeTimeout(message.member, settings.honeypotTimeoutMs, reason);
    return {actionLabel: timedOut ? "timeout" : "timeout-failed", timedOut};
  }

  async function handleHoneypotMessage(message: Message, settings: GuildDashboardSettings): Promise<boolean> {
    if (!shouldTriggerHoneypot(message, settings)) {
      return false;
    }
    const isProtected = dependencies.isProtectedMember(message);
    const protectionReasons = isProtected ? dependencies.getProtectedMemberReasons(message) : [];
    if (settings.honeypotBackupChannelId) {
      await sendHoneypotBackupCopy(message, settings);
    }
    let deletedCount = 0;
    if (settings.honeypotRemoveMessage && await safeDelete(message)) {
      deletedCount = 1;
    }
    const dmResult = isProtected
      ? {recordId: null, delivered: false}
      : await sendHoneypotVerificationDm(message, settings, settings.honeypotImmediateAction);
    const actionResult = isProtected
      ? {actionLabel: "protected-member-skip", timedOut: false}
      : await applyHoneypotAction(message, settings);
    await sendHoneypotReviewNotice({
      message,
      settings,
      actionLabel: actionResult.actionLabel,
      verifyRecordId: dmResult.recordId,
      dmDelivered: dmResult.delivered
    });
    dependencies.runtimeState.recordModeration({
      type: "honeypot",
      userId: message.author.id,
      username: message.author.tag,
      channels: [message.channelId],
      timedOut: actionResult.timedOut,
      deletedCount,
      imageUrls: [...message.attachments.values()].map(attachment => attachment.url),
      reason: `Honeypot channel triggered. action=${actionResult.actionLabel} dmDelivered=${dmResult.delivered}`,
      protectionReasons: protectionReasons.length > 0 ? protectionReasons : undefined
    });
    return true;
  }

  async function deleteObservedMessages(entries: ObservedMessage[]): Promise<number> {
    let deletedCount = 0;
    for (const entry of entries) {
      if (await safeDelete(entry.message)) {
        deletedCount += 1;
      }
    }

    return deletedCount;
  }

  async function assignInvestigationRole(message: Message, reason: string): Promise<boolean> {
    if (!message.guild || !message.member) {
      return false;
    }

    const moderationRoles = await dependencies.getGuildModerationRoles(message.guild.id);
    if (!moderationRoles.investigationRoleId || message.member.roles.cache.has(moderationRoles.investigationRoleId)) {
      return !!moderationRoles.investigationRoleId;
    }

    try {
      await message.member.roles.add(moderationRoles.investigationRoleId, `Confirmed flagged image: ${truncateReason(reason, 120)}`);
      return true;
    } catch {
      return false;
    }
  }

  async function handleFlaggedImageMessage(
    message: Message,
    imageAttachments: Attachment[],
    analysis: LlavaSpamClassification,
    type: "duplicate-image" | "image-channel-scan",
    noticePrefix: string,
    options?: {
      relatedObservedMessages?: ObservedMessage[];
      channels?: string[];
    }
  ): Promise<{ investigationRoleAssigned: boolean }> {
    const settings = dependencies.runtimeState.getGuildDashboardSettings(message.guild!.id);
    const isProtected = dependencies.isProtectedMember(message);
    const imageUrls = imageAttachments.map(attachment => attachment.url);
    const relatedObservedMessages = options?.relatedObservedMessages ?? [];
    const channels = options?.channels ?? [message.channelId];
    let noticeMessageId: string | null = null;
    if ("reply" in message && typeof message.reply === "function") {
      const vetoRecord = dependencies.runtimeState.createModerationVetoRecord({
        guildId: message.guild!.id,
        userId: message.author.id,
        username: message.author.tag,
        channelId: message.channelId,
        reason: analysis.reason,
        imageUrls
      });
      const reply = await message.reply({
        embeds: [
          buildImageModerationEmbed({
            noticePrefix,
            message,
            analysis,
            deletedCount: 0,
            timedOut: false,
            imageCount: imageAttachments.length,
            isProtected
          })
        ],
        components: [
          buildImageModerationComponents({
            vetoId: vetoRecord.id,
            vetoResolved: false
          })
        ],
        allowedMentions: {
          repliedUser: true
        }
      });
      noticeMessageId = reply.id;
      dependencies.runtimeState.attachModerationVetoNoticeMessage(vetoRecord.id, reply.id);
    }

    const deletedCount = await deleteObservedMessages(relatedObservedMessages);

    const timedOut = isProtected
      ? false
      : settings.antiSpamApplyTimeouts
        ? await safeTimeout(message.member, settings.antiSpamTimeoutMs, analysis.reason)
        : false;
    const investigationRoleAssigned = isProtected ? false : await assignInvestigationRole(message, analysis.reason);

    if (noticeMessageId) {
      try {
        const noticeMessage = await message.channel.messages.fetch(noticeMessageId);
        await noticeMessage.edit({
          embeds: [
            buildImageModerationEmbed({
              noticePrefix,
              message,
              analysis,
              deletedCount,
              timedOut,
              imageCount: imageAttachments.length,
              isProtected
            })
          ],
          components: noticeMessage.components
        });
      } catch {
        // Leave the original reply as-is if it cannot be edited after deletion.
      }
    }

    await sendModerationAlertCopy({
      title: noticePrefix,
      sourceMessage: message,
      analysisReason: analysis.reason,
      deletedCount,
      timedOut,
      imageUrls
    });

    dependencies.runtimeState.recordModeration({
      type,
      userId: message.author.id,
      username: message.author.tag,
      channels,
      timedOut,
      deletedCount,
      imageUrls,
      reason: `${analysis.reason} (${imageAttachments.length} image${imageAttachments.length === 1 ? "" : "s"}${investigationRoleAssigned ? "; investigation role assigned" : ""})`
    });
    return {
      investigationRoleAssigned
    };
  }

  function recordMonitoredChannelImageScan(
    message: Message,
    imageAttachments: Attachment[],
    input: {
      timedOut: boolean;
      deletedCount: number;
      reason: string;
    }
  ): void {
    dependencies.runtimeState.recordModeration({
      type: "image-channel-scan",
      userId: message.author.id,
      username: message.author.tag,
      channels: [message.channelId],
      timedOut: input.timedOut,
      deletedCount: input.deletedCount,
      imageUrls: imageAttachments.map(attachment => attachment.url),
      reason: `${input.reason} (${imageAttachments.length} image${imageAttachments.length === 1 ? "" : "s"})`
    });
  }

  async function handleFlaggedDuplicateText(
    firstMessage: Message,
    orderedMessages: ObservedMessage[],
    channels: string[],
    reason: string
  ): Promise<void> {
    const settings = dependencies.runtimeState.getGuildDashboardSettings(firstMessage.guild!.id);
    const isProtected = dependencies.isProtectedMember(firstMessage);
    let deletedCount = 0;

    for (const entry of orderedMessages) {
      if (await safeDelete(entry.message)) {
        deletedCount += 1;
      }
    }

    const timedOut = isProtected
      ? false
      : settings.antiSpamApplyTimeouts
        ? await safeTimeout(firstMessage.member, settings.antiSpamTimeoutMs, reason)
        : false;

    if ("send" in firstMessage.channel && typeof firstMessage.channel.send === "function") {
      await sendChunkedToTarget(firstMessage.channel, (
        `Cross-channel duplicate spam detected from <@${firstMessage.author.id}>. `
        + `Removed ${deletedCount} message(s). Timeout applied: ${timedOut}. Reason: ${reason}`
      ));
    }

    dependencies.runtimeState.recordModeration({
      type: "duplicate-text-rule",
      userId: firstMessage.author.id,
      username: firstMessage.author.tag,
      channels,
      timedOut,
      deletedCount,
      imageUrls: [],
      reason
    });
  }

  async function inspectMessage(message: Message): Promise<void> {
    if (!message.guild || message.author.bot) {
      return;
    }

    const settings = dependencies.runtimeState.getGuildDashboardSettings(message.guild!.id);
    if (await handleHoneypotMessage(message, settings)) {
      return;
    }
    if (!settings.antiSpamEnabled) {
      return;
    }

    if (settings.antiSpamExcludedChannelIds.includes(message.channelId)) {
      return;
    }

    if (
      message.member
      && settings.antiSpamExcludedRoleIds.length > 0
      && settings.antiSpamExcludedRoleIds.some(roleId => message.member!.roles.cache.has(roleId))
    ) {
      return;
    }

    const allAttachments = [...message.attachments.values()];
    const imageAttachments = allAttachments.filter(isImageAttachment);
    const fingerprint = buildFingerprint(message);
    const now = Date.now();
    cleanup(now, settings.antiSpamDuplicateWindowMs);
    let existing: ObservedMessage[] = [];
    if (fingerprint) {
      const record: ObservedMessage = {
        message,
        createdAt: now,
        key: fingerprint.key,
        channelsKey: message.channelId,
        imageAttachments: fingerprint.imageAttachments
      };
      existing = byKey.get(fingerprint.key) ?? [];
      existing.push(record);
      byKey.set(fingerprint.key, existing);
    }

    const isProtectedImagePoster = dependencies.isProtectedMember(message);
    if (
      settings.antiSpamImageScanChannelIds.includes(message.channelId)
      && imageAttachments.length > 0
    ) {
      const temporaryHold = await acquireTemporaryInvestigationHold(message, settings);
      let keepTemporaryHold = false;
      try {
        if (!settings.antiSpamAnalyzeImages) {
          recordMonitoredChannelImageScan(message, imageAttachments, {
            timedOut: false,
            deletedCount: 0,
            reason: isProtectedImagePoster
              ? "Image posted in monitored channel by protected member; image analysis is disabled."
              : "Image posted in monitored channel; image analysis is disabled."
          });
        } else {
          try {
            const analysisResult = await analyzeImagesForUser(message, imageAttachments);
            if (analysisResult.status === "skipped") {
              recordMonitoredChannelImageScan(message, imageAttachments, {
                timedOut: false,
                deletedCount: 0,
                reason: analysisResult.reason
              });
              return;
            }

            const analysis = analysisResult.analysis;
            const flagged = shouldFlagImageAnalysis(analysis, settings);
            if (flagged) {
              keepTemporaryHold = true;
              const relatedObservedMessages = fingerprint
                ? [...(byKey.get(fingerprint.key) ?? [])]
                : [{
                  message,
                  createdAt: now,
                  key: "",
                  channelsKey: message.channelId,
                  imageAttachments
                }];
              const relatedChannels = [...new Set(relatedObservedMessages.map(entry => entry.message.channelId))];
              const flaggedResult = await handleFlaggedImageMessage(
                message,
                imageAttachments,
                analysis,
                "image-channel-scan",
                "Flagged image removed in monitored channel",
                {
                  relatedObservedMessages,
                  channels: relatedChannels
                }
              );
              keepTemporaryHold = !flaggedResult.investigationRoleAssigned;
              if (fingerprint) {
                handledUntil.set(fingerprint.key, now + settings.antiSpamDuplicateWindowMs);
                byKey.delete(fingerprint.key);
              }
              return;
            }

            recordMonitoredChannelImageScan(message, imageAttachments, {
              timedOut: false,
              deletedCount: 0,
              reason: isProtectedImagePoster
                ? `Image scanned in monitored channel from protected member and considered safe. ${analysis.reason}`
                : `Image scanned in monitored channel and considered safe. ${analysis.reason}`
            });
          } catch (error) {
            const reason = error instanceof Error ? error.message : "Llava analysis failed.";
            recordMonitoredChannelImageScan(message, imageAttachments, {
              timedOut: false,
              deletedCount: 0,
              reason: `Image was posted in the monitored channel, but analysis failed: ${reason}`
            });
          }
        }
      } finally {
        await temporaryHold.release(keepTemporaryHold);
      }
    }

    if (!fingerprint) {
      return;
    }

    const distinctChannels = new Set(existing.map(entry => entry.channelsKey));
    if (distinctChannels.size < 2) {
      return;
    }

    if (handledUntil.has(fingerprint.key)) {
      return;
    }

    handledUntil.set(fingerprint.key, now + settings.antiSpamDuplicateWindowMs);

    const ordered = [...existing].sort((left, right) => left.createdAt - right.createdAt);
    const first = ordered[0];
    if (!first) {
      return;
    }

    const isProtectedMember = dependencies.isProtectedMember(first.message);
    const configuredRuleMatch = findConfiguredRuleMatch(first.message.content, settings);
    if (configuredRuleMatch?.matched) {
      await handleFlaggedDuplicateText(
        first.message,
        ordered,
        [...distinctChannels],
        configuredRuleMatch.reason
      );
      return;
    }

    if (first.imageAttachments.length > 0) {
      if (!settings.antiSpamAnalyzeImages) {
        dependencies.runtimeState.recordModeration({
          type: "duplicate-image",
          userId: first.message.author.id,
          username: first.message.author.tag,
          channels: [...distinctChannels],
          timedOut: false,
          deletedCount: 0,
          imageUrls: first.imageAttachments.map(attachment => attachment.url),
          reason: "Duplicate image posts were detected, but image analysis is currently disabled."
        });
        return;
      }

      let analysis;
      try {
        const analysisResult = await analyzeImagesForUser(first.message, first.imageAttachments);
        if (analysisResult.status === "skipped") {
          dependencies.runtimeState.recordModeration({
            type: "duplicate-image",
            userId: first.message.author.id,
            username: first.message.author.tag,
            channels: [...distinctChannels],
            timedOut: false,
            deletedCount: 0,
            imageUrls: first.imageAttachments.map(attachment => attachment.url),
            reason: analysisResult.reason
          });
          return;
        }

        analysis = analysisResult.analysis;
      } catch (error) {
        const reason = error instanceof Error ? error.message : "Llava analysis failed.";
        dependencies.runtimeState.recordModeration({
          type: "duplicate-image",
          userId: first.message.author.id,
          username: first.message.author.tag,
          channels: [...distinctChannels],
          timedOut: false,
          deletedCount: 0,
          imageUrls: first.imageAttachments.map(attachment => attachment.url),
          reason: `Duplicate image posts detected, but analysis failed: ${reason}`
        });
        return;
      }

      const flagged = shouldFlagImageAnalysis(analysis, settings);
      if (!flagged) {
        dependencies.runtimeState.recordModeration({
          type: "duplicate-image",
          userId: first.message.author.id,
          username: first.message.author.tag,
          channels: [...distinctChannels],
          timedOut: false,
          deletedCount: 0,
          imageUrls: first.imageAttachments.map(attachment => attachment.url),
          reason: "Duplicate image posts were observed, but Llava did not classify them as spam/nsfw/crypto spam."
        });
        return;
      }

      let deletedCount = 0;
      let noticeMessageId: string | null = null;
      if ("reply" in first.message && typeof first.message.reply === "function") {
        const vetoRecord = dependencies.runtimeState.createModerationVetoRecord({
          guildId: first.message.guild!.id,
          userId: first.message.author.id,
          username: first.message.author.tag,
          channelId: first.message.channelId,
          reason: analysis.reason,
          imageUrls: first.imageAttachments.map(attachment => attachment.url)
        });
        const reply = await first.message.reply({
          embeds: [
            buildImageModerationEmbed({
              noticePrefix: "Cross-channel image spam detected",
              message: first.message,
              analysis,
              deletedCount: 0,
              timedOut: false,
              imageCount: first.imageAttachments.length,
              isProtected: isProtectedMember
            })
        ],
        components: [
          buildImageModerationComponents({
            vetoId: vetoRecord.id,
            vetoResolved: false
          })
        ],
          allowedMentions: {
            repliedUser: true
          }
        });
        noticeMessageId = reply.id;
        dependencies.runtimeState.attachModerationVetoNoticeMessage(vetoRecord.id, reply.id);
      }
      for (const entry of ordered) {
        if (await safeDelete(entry.message)) {
          deletedCount += 1;
        }
      }

      const timedOut = isProtectedMember
        ? false
        : settings.antiSpamApplyTimeouts
          ? await safeTimeout(first.message.member, settings.antiSpamTimeoutMs, `Duplicate image spam detected: ${analysis.reason}`)
          : false;
      if (noticeMessageId) {
        try {
          const noticeMessage = await first.message.channel.messages.fetch(noticeMessageId);
          await noticeMessage.edit({
            embeds: [
              buildImageModerationEmbed({
                noticePrefix: "Cross-channel image spam detected",
                message: first.message,
                analysis,
                deletedCount,
                timedOut,
                imageCount: first.imageAttachments.length,
                isProtected: isProtectedMember
              })
            ],
            components: noticeMessage.components
          });
        } catch {
          // Leave the original reply as-is if it cannot be edited after deletion.
        }
      }

      await sendModerationAlertCopy({
        title: "Cross-channel image spam detected",
        sourceMessage: first.message,
        analysisReason: analysis.reason,
        deletedCount,
        timedOut,
        imageUrls: first.imageAttachments.map(attachment => attachment.url)
      });

      dependencies.runtimeState.recordModeration({
        type: "duplicate-image",
        userId: first.message.author.id,
        username: first.message.author.tag,
        channels: [...distinctChannels],
        timedOut,
        deletedCount,
        imageUrls: first.imageAttachments.map(attachment => attachment.url),
        reason: analysis.reason
      });
      return;
    }

    let deletedCount = 0;
    for (const entry of ordered.slice(1)) {
      if (await safeDelete(entry.message)) {
        deletedCount += 1;
      }
    }

    const timedOut = isProtectedMember
      ? false
      : settings.antiSpamApplyTimeouts
        ? await safeTimeout(first.message.member, settings.antiSpamTimeoutMs, "Duplicate text spam detected across channels.")
        : false;
    if ("send" in first.message.channel && typeof first.message.channel.send === "function") {
      await sendChunkedToTarget(first.message.channel, (
        `Cross-channel duplicate spam detected from <@${first.message.author.id}>. `
        + `Removed ${deletedCount} duplicate message(s) and kept this first post. `
        + `Timeout applied: ${timedOut}.`
      ));
    }

    dependencies.runtimeState.recordModeration({
      type: "duplicate-text",
      userId: first.message.author.id,
      username: first.message.author.tag,
      channels: [...distinctChannels],
      timedOut,
      deletedCount,
      imageUrls: [],
      reason: "Duplicate text spam detected across multiple channels."
    });
  }

  return {
    inspectMessage
  };
}
