import {
  PermissionFlagsBits,
  type Client,
  type GuildMember,
  type PermissionsBitField
} from "discord.js";
import type {
  DashboardChannelPermissionSummary,
  DashboardGuildPermissionSummary
} from "@urage/shared/dashboard/types";
import { describeChannelKind } from "./discordRuntimeHelpers.js";

interface DiscordPermissionHelpersInput {
  client: Client;
}

export function createDiscordPermissionHelpers(input: DiscordPermissionHelpersInput) {
  async function requireGuildBotMember(guildId: string): Promise<GuildMember> {
    const guild = input.client.guilds.cache.get(guildId);
    if (!guild) {
      throw new Error("Guild not found.");
    }
    const member = guild.members.me ?? await guild.members.fetchMe().catch(() => null);
    if (!member) {
      throw new Error("Bot membership details are unavailable for this guild.");
    }
    return member;
  }

  function ensureGuildPermission(member: GuildMember, permission: bigint, label: string): void {
    if (!member.permissions.has(permission)) {
      throw new Error(`Bot is missing the ${label} permission in this server.`);
    }
  }

  function ensureChannelPermission(
    member: GuildMember,
    channel: { permissionsFor: (member: GuildMember) => PermissionsBitField | null },
    permission: bigint,
    label: string
  ): void {
    const permissions = channel.permissionsFor(member);
    if (!permissions?.has(permission)) {
      throw new Error(`Bot is missing the ${label} permission in this channel.`);
    }
  }

  async function getGuildPermissionSummary(guildId: string): Promise<DashboardGuildPermissionSummary> {
    const guild = input.client.guilds.cache.get(guildId);
    if (!guild) {
      throw new Error("Guild not found.");
    }
    const member = await requireGuildBotMember(guildId);
    const checks = [
      { key: "viewChannel", label: "View Channels", permission: PermissionFlagsBits.ViewChannel, critical: true },
      { key: "sendMessages", label: "Send Messages", permission: PermissionFlagsBits.SendMessages, critical: true },
      { key: "embedLinks", label: "Embed Links", permission: PermissionFlagsBits.EmbedLinks, critical: false },
      { key: "attachFiles", label: "Attach Files", permission: PermissionFlagsBits.AttachFiles, critical: false },
      { key: "manageChannels", label: "Manage Channels", permission: PermissionFlagsBits.ManageChannels, critical: false },
      { key: "manageRoles", label: "Manage Roles", permission: PermissionFlagsBits.ManageRoles, critical: false },
      { key: "createInstantInvite", label: "Create Invites", permission: PermissionFlagsBits.CreateInstantInvite, critical: false },
      { key: "moderateMembers", label: "Timeout Members", permission: PermissionFlagsBits.ModerateMembers, critical: false },
      { key: "manageMessages", label: "Manage Messages", permission: PermissionFlagsBits.ManageMessages, critical: false },
      { key: "manageThreads", label: "Manage Threads", permission: PermissionFlagsBits.ManageThreads, critical: false },
      { key: "createPublicThreads", label: "Create Public Threads", permission: PermissionFlagsBits.CreatePublicThreads, critical: false },
      { key: "sendMessagesInThreads", label: "Send In Threads", permission: PermissionFlagsBits.SendMessagesInThreads, critical: false },
      { key: "connect", label: "Connect To Voice", permission: PermissionFlagsBits.Connect, critical: false }
    ];
    const permissions = checks.map(item => ({
      key: item.key,
      label: item.label,
      allowed: member.permissions.has(item.permission)
    }));
    const missingCriticalPermissions = checks
      .filter(item => item.critical && !member.permissions.has(item.permission))
      .map(item => item.label);
    return {
      guildId,
      serverName: guild.name,
      manageable: missingCriticalPermissions.length === 0,
      missingCriticalPermissions,
      permissions
    };
  }

  async function getChannelPermissionSummary(guildId: string, channelId: string): Promise<DashboardChannelPermissionSummary> {
    const guild = input.client.guilds.cache.get(guildId);
    if (!guild) {
      throw new Error("Guild not found.");
    }
    const channel = await guild.channels.fetch(channelId);
    if (!channel) {
      throw new Error("Channel not found.");
    }
    const member = await requireGuildBotMember(guildId);
    const permissions = channel.permissionsFor(member);
    if (!permissions) {
      throw new Error("Could not inspect channel permissions.");
    }
    const checks = [
      { key: "viewChannel", label: "View Channel", permission: PermissionFlagsBits.ViewChannel, critical: true },
      { key: "sendMessages", label: "Send Messages", permission: PermissionFlagsBits.SendMessages, critical: true },
      { key: "embedLinks", label: "Embed Links", permission: PermissionFlagsBits.EmbedLinks, critical: false },
      { key: "attachFiles", label: "Attach Files", permission: PermissionFlagsBits.AttachFiles, critical: false },
      { key: "readHistory", label: "Read History", permission: PermissionFlagsBits.ReadMessageHistory, critical: false },
      { key: "manageMessages", label: "Manage Messages", permission: PermissionFlagsBits.ManageMessages, critical: false },
      { key: "createPublicThreads", label: "Create Public Threads", permission: PermissionFlagsBits.CreatePublicThreads, critical: false },
      { key: "sendInThreads", label: "Send In Threads", permission: PermissionFlagsBits.SendMessagesInThreads, critical: false },
      { key: "connect", label: "Connect", permission: PermissionFlagsBits.Connect, critical: channel.isVoiceBased() },
      { key: "speak", label: "Speak", permission: PermissionFlagsBits.Speak, critical: false }
    ];
    const summaryPermissions = checks.map(item => ({
      key: item.key,
      label: item.label,
      allowed: permissions.has(item.permission)
    }));
    const missingCriticalPermissions = checks
      .filter(item => item.critical && !permissions.has(item.permission))
      .map(item => item.label);
    return {
      guildId,
      channelId,
      channelName: "name" in channel && typeof channel.name === "string" ? channel.name : channel.id,
      channelKind: describeChannelKind(channel.type),
      manageable: missingCriticalPermissions.length === 0,
      missingCriticalPermissions,
      permissions: summaryPermissions
    };
  }

  return {
    requireGuildBotMember,
    ensureGuildPermission,
    ensureChannelPermission,
    getGuildPermissionSummary,
    getChannelPermissionSummary
  };
}
