import {
  ChannelType,
  PermissionFlagsBits,
  type Client,
  type GuildMember,
  type PermissionsBitField
} from "discord.js";
import type { SendableChannel } from "./discordRuntimeHelpers.js";

type DiscordTextOpsDependencies = {
  client: Client;
  canSendMessages: (channel: unknown) => boolean;
  requireGuildBotMember: (guildId: string) => Promise<GuildMember>;
  ensureChannelPermission: (
    member: GuildMember,
    channel: { permissionsFor: (member: GuildMember) => PermissionsBitField | null },
    permission: bigint,
    label: string
  ) => void;
  sendChunkedToTarget: (targetChannel: SendableChannel, content: string) => Promise<void>;
  summarizeText: (content: string, maxLength: number) => string;
};

type BotMessageSummary = {
  id: string;
  content: string;
  createdAt: string;
  editedAt: string | null;
};

type DirectMessageSummary = {
  channelId: string;
  userId: string | null;
  displayName: string;
  tag: string;
  lastMessagePreview: string;
  lastMessageAt: string | null;
};

type DirectMessageEntry = {
  id: string;
  authorId: string;
  authorTag: string;
  content: string;
  attachments: string[];
  createdAt: string;
};

export type DiscordTextOpsService = {
  describeChannel: (channel: unknown) => string;
  sendChunkedToChannel: (channel: SendableChannel, content: string) => Promise<void>;
  requireSendableChannel: (channelId: string) => Promise<SendableChannel>;
  sendMessageToChannel: (channelId: string, content: string) => Promise<void>;
  sendDirectMessage: (userId: string, content: string) => Promise<void>;
  listRecentBotMessages: (channelId: string) => Promise<BotMessageSummary[]>;
  editBotAuthoredMessage: (channelId: string, messageId: string, content: string) => Promise<BotMessageSummary>;
  listDirectMessages: () => Promise<DirectMessageSummary[]>;
  getDirectMessageEntries: (channelId: string) => Promise<DirectMessageEntry[]>;
};

function describeChannel(channel: unknown): string {
  if (typeof channel === "object" && channel !== null && "name" in channel && typeof channel.name === "string") {
    return `#${channel.name}`;
  }
  if (typeof channel === "object" && channel !== null && "id" in channel && typeof channel.id === "string") {
    return channel.id;
  }
  return "unknown-channel";
}

function previewMessageContent(content: string, attachments: number, summarizeText: (value: string, maxLength: number) => string): string {
  const trimmed = content.trim();
  if (trimmed.length > 0) {
    return summarizeText(trimmed, 60);
  }
  if (attachments > 0) {
    return attachments === 1 ? "[1 attachment]" : `[${attachments} attachments]`;
  }
  return "[empty message]";
}

export function createDiscordTextOpsService(dependencies: DiscordTextOpsDependencies): DiscordTextOpsService {
  async function sendChunkedToChannel(channel: SendableChannel, content: string): Promise<void> {
    await dependencies.sendChunkedToTarget(channel, content);
  }

  async function requireSendableChannel(channelId: string): Promise<SendableChannel> {
    const targetChannel = await dependencies.client.channels.fetch(channelId);
    if (!targetChannel?.isTextBased() || !dependencies.canSendMessages(targetChannel)) {
      throw new Error("Could not find a sendable text channel.");
    }
    if ("guildId" in targetChannel && typeof targetChannel.guildId === "string") {
      const member = await dependencies.requireGuildBotMember(targetChannel.guildId);
      dependencies.ensureChannelPermission(member, targetChannel, PermissionFlagsBits.ViewChannel, "View Channels");
      dependencies.ensureChannelPermission(member, targetChannel, PermissionFlagsBits.SendMessages, "Send Messages");
    }
    return targetChannel as SendableChannel;
  }

  async function sendMessageToChannel(channelId: string, content: string): Promise<void> {
    const channel = await requireSendableChannel(channelId);
    await sendChunkedToChannel(channel, content);
  }

  async function sendDirectMessage(userId: string, content: string): Promise<void> {
    const user = await dependencies.client.users.fetch(userId);
    const dmChannel = await user.createDM();
    await sendChunkedToChannel(dmChannel, content);
  }

  async function listRecentBotMessages(channelId: string): Promise<BotMessageSummary[]> {
    const channel = await dependencies.client.channels.fetch(channelId);
    if (!channel?.isTextBased() || !("messages" in channel) || typeof channel.messages?.fetch !== "function") {
      throw new Error("Could not fetch messages for that channel.");
    }
    const botUserId = dependencies.client.user?.id;
    if (!botUserId) {
      throw new Error("Bot identity is not ready yet.");
    }
    const messages = await channel.messages.fetch({ limit: 25 });
    return [...messages.values()]
      .filter(message => message.author.id === botUserId)
      .sort((left, right) => right.createdTimestamp - left.createdTimestamp)
      .map(message => ({
        id: message.id,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
        editedAt: message.editedAt?.toISOString() ?? null
      }));
  }

  async function editBotAuthoredMessage(channelId: string, messageId: string, content: string): Promise<BotMessageSummary> {
    const nextContent = content.trim();
    if (!nextContent) {
      throw new Error("Edited message content is required.");
    }
    if (nextContent.length > 2000) {
      throw new Error("Edited message content must stay within Discord's 2000 character limit.");
    }
    const channel = await dependencies.client.channels.fetch(channelId);
    if (!channel?.isTextBased() || !("messages" in channel) || typeof channel.messages?.fetch !== "function") {
      throw new Error("Could not fetch messages for that channel.");
    }
    const botUserId = dependencies.client.user?.id;
    if (!botUserId) {
      throw new Error("Bot identity is not ready yet.");
    }
    const message = await channel.messages.fetch(messageId).catch(() => null);
    if (!message) {
      throw new Error("That bot message could not be found.");
    }
    if (message.author.id !== botUserId) {
      throw new Error("Only messages authored by this bot can be edited here.");
    }
    const edited = await message.edit(nextContent);
    return {
      id: edited.id,
      content: edited.content,
      createdAt: edited.createdAt.toISOString(),
      editedAt: edited.editedAt?.toISOString() ?? null
    };
  }

  async function listDirectMessages(): Promise<DirectMessageSummary[]> {
    const channels = [...dependencies.client.channels.cache.values()].filter(channel => channel.type === ChannelType.DM);
    const items = await Promise.all(channels.map(async channel => {
      const recipient = "recipient" in channel ? channel.recipient : null;
      const messages = await channel.messages.fetch({ limit: 1 });
      const latest = messages.first() ?? null;
      return {
        channelId: channel.id,
        userId: recipient?.id ?? null,
        displayName: recipient?.displayName ?? recipient?.username ?? "Unknown user",
        tag: recipient?.tag ?? "unknown",
        lastMessagePreview: latest ? previewMessageContent(latest.content, latest.attachments.size, dependencies.summarizeText) : "No messages yet.",
        lastMessageAt: latest?.createdAt.toISOString() ?? null
      };
    }));
    return items.sort((left, right) => {
      const leftTime = left.lastMessageAt ?? "";
      const rightTime = right.lastMessageAt ?? "";
      return rightTime.localeCompare(leftTime);
    });
  }

  async function getDirectMessageEntries(channelId: string): Promise<DirectMessageEntry[]> {
    const channel = await dependencies.client.channels.fetch(channelId);
    if (!channel || channel.type !== ChannelType.DM) {
      throw new Error("Direct message channel not found.");
    }
    const messages = await channel.messages.fetch({ limit: 50 });
    return [...messages.values()]
      .sort((left, right) => left.createdTimestamp - right.createdTimestamp)
      .map(message => ({
        id: message.id,
        authorId: message.author.id,
        authorTag: message.author.tag,
        content: message.content,
        attachments: [...message.attachments.values()].map(attachment => attachment.url),
        createdAt: message.createdAt.toISOString()
      }));
  }

  return {
    describeChannel,
    sendChunkedToChannel,
    requireSendableChannel,
    sendMessageToChannel,
    sendDirectMessage,
    listRecentBotMessages,
    editBotAuthoredMessage,
    listDirectMessages,
    getDirectMessageEntries
  };
}
