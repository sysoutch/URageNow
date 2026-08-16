import type { Message } from "discord.js";
import type { ChatModeChannelSettings, GuildSettings } from "./guildSettingsStore.js";

type CooldownMap = Map<string, number>;

const chatCooldowns: CooldownMap = new Map();
const autonomousHeartbeatRuns = new Map<string, number>();

export interface ChatModeDecision {
  shouldRespond: boolean;
  status: "ignored" | "responded";
  reason: string;
}

function getChannelSettings(settings: GuildSettings, channelId: string): ChatModeChannelSettings | null {
  const channelSettings = settings.chatModeChannels[channelId];
  return channelSettings?.enabled ? channelSettings : null;
}

export function getChatModeChannelSettings(
  settings: GuildSettings,
  channelId: string
): ChatModeChannelSettings | null {
  return getChannelSettings(settings, channelId);
}

export async function evaluateChatModeMessage(message: Message, settings: GuildSettings): Promise<ChatModeDecision> {
  if (!message.guild || !message.member || message.author.bot) {
    return {
      shouldRespond: false,
      status: "ignored",
      reason: "message is not an eligible guild user message"
    };
  }

  const channelSettings = getChannelSettings(settings, message.channelId);
  if (!channelSettings) {
    return {
      shouldRespond: false,
      status: "ignored",
      reason: "chat mode is disabled for this channel"
    };
  }

  const hasAllowedUser = channelSettings.allowedUserIds.includes(message.author.id);
  const hasAllowedRole = channelSettings.allowedRoleIds.some(roleId => message.member?.roles.cache.has(roleId));
  if (!hasAllowedUser && !hasAllowedRole) {
    return {
      shouldRespond: false,
      status: "ignored",
      reason: "member is not on the allowlist for this channel"
    };
  }

  const requireMention = channelSettings.requireMentionOrReply || settings.botSafetyRequireMentionOrReply;
  if (requireMention) {
    const mentionedBot = message.mentions.users.has(message.client.user?.id ?? "");
    let replyToBot = false;
    if (message.reference?.messageId) {
      try {
        const reference = await message.fetchReference();
        replyToBot = reference.author.id === message.client.user?.id;
      } catch {
        replyToBot = false;
      }
    }
    if (!mentionedBot && !replyToBot) {
      return {
        shouldRespond: false,
        status: "ignored",
        reason: "a mention or reply to the bot is required"
      };
    }
  }

  const cooldownKey = `${message.guild.id}:${message.channelId}:${message.author.id}`;
  const lastReplyAt = chatCooldowns.get(cooldownKey) ?? 0;
  if (Date.now() - lastReplyAt < channelSettings.cooldownSeconds * 1000) {
    return {
      shouldRespond: false,
      status: "ignored",
      reason: "channel cooldown is still active for this member"
    };
  }

  chatCooldowns.set(cooldownKey, Date.now());
  return {
    shouldRespond: true,
    status: "responded",
    reason: "message passed channel chat-mode checks"
  };
}

export async function shouldRespondInChatMode(message: Message, settings: GuildSettings): Promise<boolean> {
  const decision = await evaluateChatModeMessage(message, settings);
  return decision.shouldRespond;
}

export function buildChatModeSystemPrompt(
  settings: GuildSettings,
  channelSettings: ChatModeChannelSettings,
  input: {
    guildName: string;
    channelName: string;
  }
): string {
  const modeGuidance = settings.botMode === "act-on-user-behalf"
    ? [
      `You are Discrod, a Discord bot operating in safe proxy mode for a ${settings.botActingPreset}.`,
      "You must never claim to literally be that human or imply you control their real account.",
      "You may match the tone and confidence of that role, but you are still the bot."
    ]
    : settings.botMode === "act-on-itself"
      ? [
        "You are Discrod in autonomous server assistant mode.",
        "Be concise, observant, and operationally useful.",
        settings.botSafetySuggestOnly
          ? "You may suggest server changes and moderation ideas, but do not claim that changes already happened."
          : "You may propose concrete next actions, but do not impersonate staff or claim hidden authority."
      ]
      : [
        "You are Discrod, a helpful Discord bot.",
        "Reply naturally and briefly."
      ];
  const safetyLines = [
    "Safety rules:",
    "Do not impersonate a real user account.",
    "Do not claim staff decisions are final.",
    "Do not encourage policy-breaking, harassment, scams, or unsafe behavior.",
    settings.botSafetyAllowRoleSuggestions
      ? "You may suggest role changes if helpful, but frame them as suggestions."
      : "Do not suggest role changes.",
    settings.botSafetyAllowChannelSuggestions
      ? "You may suggest channel or category changes if helpful."
      : "Do not suggest channel changes.",
    settings.botSafetyAllowPromotionSuggestions
      ? "You may suggest promotions, but present them as admin-review ideas only."
      : "Do not suggest promotions.",
    channelSettings.systemPrompt.trim().length > 0
      ? `Channel instructions: ${channelSettings.systemPrompt.trim()}`
      : "Channel instructions: none."
  ];
  return [
    ...modeGuidance,
    ...safetyLines,
    `Server: ${input.guildName}`,
    `Channel: #${input.channelName}`,
    "Reply as Discrod in under 8 short lines."
  ].join("\n");
}
export function buildChatModeUserPrompt(input: {
  authorTag: string;
  authorContext?: string | null;
  messageContent: string;
  repliedContent?: string | null;
}): string {
  return [
    `Member: ${input.authorTag}`,
    input.authorContext ? `Member context: ${input.authorContext}` : null,
    input.repliedContent ? `Replied bot message: ${input.repliedContent}` : null,
    `Incoming message: ${input.messageContent}`
  ].filter(Boolean).join("\n");
}
export function buildChatModePrompt(
  settings: GuildSettings,
  channelSettings: ChatModeChannelSettings,
  input: {
    guildName: string;
    channelName: string;
    authorTag: string;
    authorContext?: string | null;
    messageContent: string;
    repliedContent?: string | null;
  }
): string {
  return [
    buildChatModeSystemPrompt(settings, channelSettings, {
      guildName: input.guildName,
      channelName: input.channelName
    }),
    buildChatModeUserPrompt({
      authorTag: input.authorTag,
      authorContext: input.authorContext,
      messageContent: input.messageContent,
      repliedContent: input.repliedContent
    })
  ].join("\n");
}

export function shouldRunAutonomousHeartbeat(settings: GuildSettings): boolean {
  return settings.botMode === "act-on-itself"
    && settings.autonomousHeartbeatEnabled
    && !!settings.autonomousStatusChannelId;
}

export function getHeartbeatDueGuildIds(
  entries: Array<{ guildId: string; settings: GuildSettings }>
): string[] {
  const now = Date.now();
  const due: string[] = [];

  for (const entry of entries) {
    if (!shouldRunAutonomousHeartbeat(entry.settings)) {
      continue;
    }

    const key = entry.guildId;
    const intervalMs = Math.max(1, entry.settings.autonomousHeartbeatMinutes) * 60_000;
    const lastRunAt = autonomousHeartbeatRuns.get(key) ?? 0;
    if (now - lastRunAt >= intervalMs) {
      due.push(key);
      autonomousHeartbeatRuns.set(key, now);
    }
  }

  return due;
}

export function shouldPostAutonomousHeartbeatForSignals(input: {
  settings: GuildSettings;
  signalCount: number;
}): boolean {
  return shouldRunAutonomousHeartbeat(input.settings) && input.signalCount > 0;
}
