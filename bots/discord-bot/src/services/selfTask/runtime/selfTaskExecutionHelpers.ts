import { ChannelType, PermissionFlagsBits, type Guild, type GuildMember, type PermissionsBitField } from "discord.js";
import type { SafeSelfTaskPermissionName } from "../../selfTaskService.js";

type SelfTaskExecutionHelpersDependencies = {
  normalizeLookupName: (value: string) => string;
  canSendMessages: (channel: unknown) => boolean;
  requireGuildBotMember: (guildId: string) => Promise<GuildMember>;
  describeChannel: (channel: unknown) => string;
};

type ExplainChannelPermissionsInput = {
  guild: Guild;
  channelId: string;
  subject: "bot" | "role" | "user";
  roleName?: string | null;
  targetUser?: string | null;
};

type SelfTaskExecutionHelpers = {
  resolveGuildCategoryId: (guild: Guild, reference: string | null | undefined) => string | null;
  resolveGuildTextChannelId: (guild: Guild, reference: string, currentChannelId: string | null) => string | null;
  resolveGuildChannelId: (guild: Guild, reference: string | null | undefined, currentChannelId: string | null) => string | null;
  resolveGuildRoleId: (guild: Guild, reference: string | null | undefined) => string | null;
  resolveGuildMemberId: (guild: Guild, reference: string | null | undefined) => Promise<string | null>;
  formatPermissionFlags: (permissions: PermissionsBitField) => string[];
  explainChannelPermissionsForTarget: (input: ExplainChannelPermissionsInput) => Promise<string>;
  resolveSelfTaskPermissions: (permissionNames: SafeSelfTaskPermissionName[]) => bigint[];
};

const selfTaskPermissionFlagMap: Record<SafeSelfTaskPermissionName, bigint> = {
  ViewChannel: PermissionFlagsBits.ViewChannel,
  SendMessages: PermissionFlagsBits.SendMessages,
  SendMessagesInThreads: PermissionFlagsBits.SendMessagesInThreads,
  ReadMessageHistory: PermissionFlagsBits.ReadMessageHistory,
  AttachFiles: PermissionFlagsBits.AttachFiles,
  EmbedLinks: PermissionFlagsBits.EmbedLinks,
  AddReactions: PermissionFlagsBits.AddReactions,
  Connect: PermissionFlagsBits.Connect,
  Speak: PermissionFlagsBits.Speak,
  CreateInstantInvite: PermissionFlagsBits.CreateInstantInvite,
  CreatePublicThreads: PermissionFlagsBits.CreatePublicThreads,
  CreatePrivateThreads: PermissionFlagsBits.CreatePrivateThreads,
  ManageMessages: PermissionFlagsBits.ManageMessages,
  ManageThreads: PermissionFlagsBits.ManageThreads
};

export function createSelfTaskExecutionHelpers(dependencies: SelfTaskExecutionHelpersDependencies): SelfTaskExecutionHelpers {
  function resolveGuildCategoryId(guild: Guild, reference: string | null | undefined): string | null {
    const normalizedReference = dependencies.normalizeLookupName(reference ?? "");
    if (!normalizedReference) {
      return null;
    }
    for (const channel of guild.channels.cache.values()) {
      if (channel?.type !== ChannelType.GuildCategory) {
        continue;
      }
      const channelName = "name" in channel && typeof channel.name === "string" ? channel.name : channel.id;
      if (dependencies.normalizeLookupName(channelName) === normalizedReference) {
        return channel.id;
      }
    }
    return null;
  }

  function resolveGuildTextChannelId(guild: Guild, reference: string, currentChannelId: string | null): string | null {
    if (reference === "__CURRENT_CHANNEL__") {
      return currentChannelId;
    }
    const normalizedReference = dependencies.normalizeLookupName(reference);
    if (!normalizedReference) {
      return null;
    }
    for (const channel of guild.channels.cache.values()) {
      if (!channel?.isTextBased() || !dependencies.canSendMessages(channel)) {
        continue;
      }
      const channelName = "name" in channel && typeof channel.name === "string" ? channel.name : channel.id;
      if (dependencies.normalizeLookupName(channelName) === normalizedReference) {
        return channel.id;
      }
    }
    return null;
  }

  function resolveGuildChannelId(guild: Guild, reference: string | null | undefined, currentChannelId: string | null): string | null {
    if ((reference ?? "") === "__CURRENT_CHANNEL__") {
      return currentChannelId;
    }
    const normalizedReference = dependencies.normalizeLookupName(reference ?? "");
    if (!normalizedReference) {
      return null;
    }
    for (const channel of guild.channels.cache.values()) {
      if (!channel) {
        continue;
      }
      const channelName = "name" in channel && typeof channel.name === "string" ? channel.name : channel.id;
      if (dependencies.normalizeLookupName(channelName) === normalizedReference) {
        return channel.id;
      }
    }
    return null;
  }

  function resolveGuildRoleId(guild: Guild, reference: string | null | undefined): string | null {
    const normalizedReference = dependencies.normalizeLookupName(reference ?? "");
    if (!normalizedReference) {
      return null;
    }
    for (const role of guild.roles.cache.values()) {
      if (dependencies.normalizeLookupName(role.name) === normalizedReference) {
        return role.id;
      }
    }
    return null;
  }

  async function resolveGuildMemberId(guild: Guild, reference: string | null | undefined): Promise<string | null> {
    const trimmedReference = (reference ?? "").trim();
    if (!trimmedReference) {
      return null;
    }
    const mentionMatch = trimmedReference.match(/^<@!?(\d{16,20})>$/);
    const explicitId = mentionMatch?.[1] ?? (/^\d{16,20}$/.test(trimmedReference) ? trimmedReference : null);
    if (explicitId) {
      const fetchedById = await guild.members.fetch(explicitId).catch(() => null);
      if (fetchedById) {
        return fetchedById.id;
      }
    }
    const normalizedReference = trimmedReference.toLowerCase();
    const normalizedLooseReference = normalizedReference.replace(/^@+/, "").replace(/[<>\[\]\(\)]/g, "").replace(/\s+/g, " ").trim();
    for (const member of guild.members.cache.values()) {
      const candidateValues = [member.id, member.user.tag, member.user.username, member.displayName].map(value => value.toLowerCase());
      if (candidateValues.includes(normalizedReference) || candidateValues.some(value => value.replace(/^@+/, "") === normalizedLooseReference)) {
        return member.id;
      }
    }
    const searchedMembers = await guild.members.search({ query: normalizedLooseReference || trimmedReference, limit: 10 }).catch(() => null);
    if (!searchedMembers) {
      return null;
    }
    const exact = searchedMembers.find(member =>
      member.user.tag.toLowerCase() === normalizedReference
      || member.user.username.toLowerCase() === normalizedReference
      || member.displayName.toLowerCase() === normalizedReference
      || member.user.tag.toLowerCase().replace(/^@+/, "") === normalizedLooseReference
      || member.user.username.toLowerCase().replace(/^@+/, "") === normalizedLooseReference
      || member.displayName.toLowerCase().replace(/^@+/, "") === normalizedLooseReference
    );
    return exact?.id ?? searchedMembers.first()?.id ?? null;
  }

  function formatPermissionFlags(permissions: PermissionsBitField): string[] {
    const checks = [
      { label: "View Channel", flag: PermissionFlagsBits.ViewChannel, critical: true },
      { label: "Send Messages", flag: PermissionFlagsBits.SendMessages, critical: true },
      { label: "Read History", flag: PermissionFlagsBits.ReadMessageHistory, critical: false },
      { label: "Attach Files", flag: PermissionFlagsBits.AttachFiles, critical: false },
      { label: "Embed Links", flag: PermissionFlagsBits.EmbedLinks, critical: false },
      { label: "Manage Messages", flag: PermissionFlagsBits.ManageMessages, critical: false },
      { label: "Create Public Threads", flag: PermissionFlagsBits.CreatePublicThreads, critical: false },
      { label: "Send In Threads", flag: PermissionFlagsBits.SendMessagesInThreads, critical: false },
      { label: "Manage Threads", flag: PermissionFlagsBits.ManageThreads, critical: false },
      { label: "Connect", flag: PermissionFlagsBits.Connect, critical: false },
      { label: "Speak", flag: PermissionFlagsBits.Speak, critical: false }
    ];
    return checks.map(check => `${permissions.has(check.flag) ? "yes" : "no"} ${check.label}${check.critical ? " (critical)" : ""}`);
  }

  async function explainChannelPermissionsForTarget(input: ExplainChannelPermissionsInput): Promise<string> {
    const channel = await input.guild.channels.fetch(input.channelId);
    if (!channel || !("permissionsFor" in channel) || typeof channel.permissionsFor !== "function") {
      throw new Error("That channel does not expose Discord permission checks.");
    }
    if (input.subject === "bot") {
      const member = await dependencies.requireGuildBotMember(input.guild.id);
      const permissions = channel.permissionsFor(member);
      if (!permissions) {
        throw new Error("Could not inspect the bot's permissions in that channel.");
      }
      const summary = formatPermissionFlags(permissions);
      const overwrite = "permissionOverwrites" in channel ? channel.permissionOverwrites.cache.get(member.id) ?? null : null;
      const overwriteSummary = overwrite
        ? [
          overwrite.allow.bitfield !== 0n ? `member overwrite allow=${overwrite.allow.toArray().join(", ")}` : null,
          overwrite.deny.bitfield !== 0n ? `member overwrite deny=${overwrite.deny.toArray().join(", ")}` : null
        ].filter(Boolean).join(" | ")
        : null;
      return [
        `Bot permissions in ${dependencies.describeChannel(channel)}:`,
        ...summary,
        overwriteSummary ? `Direct overwrite: ${overwriteSummary}` : null
      ].filter(Boolean).join("\n");
    }
    if (input.subject === "role") {
      const roleId = resolveGuildRoleId(input.guild, input.roleName);
      if (!roleId) {
        throw new Error(`Could not resolve role "${input.roleName}".`);
      }
      const role = input.guild.roles.cache.get(roleId) ?? await input.guild.roles.fetch(roleId).catch(() => null);
      if (!role) {
        throw new Error(`Role "${input.roleName}" was not found.`);
      }
      const permissions = channel.permissionsFor(role);
      if (!permissions) {
        throw new Error("Could not inspect that role's permissions in the channel.");
      }
      const overwrite = "permissionOverwrites" in channel ? channel.permissionOverwrites.cache.get(role.id) ?? null : null;
      const overwriteSummary = overwrite
        ? [
          overwrite.allow.bitfield !== 0n ? `overwrite allow=${overwrite.allow.toArray().join(", ")}` : null,
          overwrite.deny.bitfield !== 0n ? `overwrite deny=${overwrite.deny.toArray().join(", ")}` : null
        ].filter(Boolean).join(" | ")
        : "no direct overwrite for this role";
      return [
        `Role permissions for ${role.name} in ${dependencies.describeChannel(channel)}:`,
        ...formatPermissionFlags(permissions),
        `Overwrite details: ${overwriteSummary}`
      ].join("\n");
    }
    const memberId = await resolveGuildMemberId(input.guild, input.targetUser);
    if (!memberId) {
      throw new Error(`Could not resolve member "${input.targetUser}".`);
    }
    const member = input.guild.members.cache.get(memberId) ?? await input.guild.members.fetch(memberId).catch(() => null);
    if (!member) {
      throw new Error("Member was not found.");
    }
    const permissions = channel.permissionsFor(member);
    if (!permissions) {
      throw new Error("Could not inspect that member's permissions in the channel.");
    }
    return [
      `User permissions for ${member.user.tag} in ${dependencies.describeChannel(channel)}:`,
      `Roles: ${[...member.roles.cache.values()].filter(role => role.id !== input.guild.id).map(role => role.name).join(", ") || "none"}`,
      ...formatPermissionFlags(permissions)
    ].join("\n");
  }

  function resolveSelfTaskPermissions(permissionNames: SafeSelfTaskPermissionName[]): bigint[] {
    return permissionNames.map(name => selfTaskPermissionFlagMap[name]).filter((value): value is bigint => typeof value === "bigint");
  }

  return {
    resolveGuildCategoryId,
    resolveGuildTextChannelId,
    resolveGuildChannelId,
    resolveGuildRoleId,
    resolveGuildMemberId,
    formatPermissionFlags,
    explainChannelPermissionsForTarget,
    resolveSelfTaskPermissions
  };
}

