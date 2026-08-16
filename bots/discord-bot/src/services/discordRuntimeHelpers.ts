import { ChannelType } from "discord.js";

export type SendableChannel = {
  send: (content: string | import("discord.js").MessagePayload | import("discord.js").MessageCreateOptions) => Promise<unknown>;
};

export function canSendMessages<T>(channel: T): channel is T & SendableChannel {
  return typeof channel === "object"
    && channel !== null
    && "send" in channel
    && typeof (channel as { send?: unknown }).send === "function";
}

export function isVoiceChannelType(type: ChannelType): boolean {
  return type === ChannelType.GuildVoice || type === ChannelType.GuildStageVoice;
}

export function isEditableTextChannelType(type: ChannelType): boolean {
  return type === ChannelType.GuildText || type === ChannelType.GuildAnnouncement;
}

export function describeChannelKind(type: ChannelType): string {
  switch (type) {
    case ChannelType.GuildText:
      return "Text";
    case ChannelType.GuildAnnouncement:
      return "Announcements";
    case ChannelType.GuildForum:
      return "Forum";
    case ChannelType.PublicThread:
      return "Thread";
    case ChannelType.PrivateThread:
      return "Private Thread";
    case ChannelType.AnnouncementThread:
      return "News Thread";
    case ChannelType.GuildVoice:
      return "Voice";
    case ChannelType.GuildStageVoice:
      return "Stage";
    default:
      return type.toString();
  }
}

export function summarizeText(content: string, maxLength = 80): string {
  const normalized = content.trim().replace(/\s+/g, " ");
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 1)}...`;
}

export function mergeContentBlocks(parts: Array<string | undefined>): string | undefined {
  const merged = parts
    .map(part => part?.trim() ?? "")
    .filter(Boolean)
    .join("\n\n")
    .trim();
  return merged || undefined;
}

export function mergePromptCandidates(parts: Array<string | undefined>): string {
  const merged = Array.from(new Set(
    parts.map(part => part?.trim() ?? "").filter(Boolean)
  ));
  return merged.join("\n\n").trim();
}

export function normalizeLookupName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^#/, "")
    .replace(/\s+/g, "-");
}
