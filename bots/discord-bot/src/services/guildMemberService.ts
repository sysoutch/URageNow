import { GuildMember, PermissionFlagsBits, type Client } from "discord.js";

type GuildMemberServiceDependencies = {
  client: Client;
  requireGuildBotMember: (guildId: string) => Promise<GuildMember>;
  ensureGuildPermission: (member: GuildMember, permission: bigint, label: string) => void;
  searchCachedGuildUsers: (guildId: string, query: string, limit?: number) => Promise<Array<{
    userId: string;
    username: string;
    displayName: string;
    tag: string;
    lastSeenAt: string;
  }>>;
  upsertCachedGuildUser: (entry: {
    guildId: string;
    userId: string;
    username: string;
    displayName: string;
    tag: string;
    lastSeenAt: string;
  }) => Promise<unknown>;
  upsertCachedGuildUsers: (entries: Array<{
    guildId: string;
    userId: string;
    username: string;
    displayName: string;
    tag: string;
    lastSeenAt: string;
  }>) => Promise<unknown>;
  getGuildSettings: (guildId: string) => Promise<{ memberCounterChannelId: string | null; memberCounterTemplate: string }>;
  renderMemberCounterName: (template: string, memberCount: number) => string;
  updateGuildSettings: (guildId: string, update: { investigationRoleId?: string; temporaryImageBlockRoleId?: string; }) => Promise<unknown>;
};

type DashboardUserSummary = { id: string; username: string; displayName: string; tag: string; lastSeenAt: string };
type DashboardRoleSummary = { id: string; name: string; colorHex: string | null };

type GuildMemberService = {
  searchUsers: (guildId: string, query: string) => Promise<DashboardUserSummary[]>;
  toDashboardUserSummary: (member: GuildMember) => DashboardUserSummary;
  cacheGuildMember: (member: GuildMember) => Promise<void>;
  fetchUsers: (guildId: string, query: string) => Promise<DashboardUserSummary[]>;
  updateMemberCounterChannelForGuild: (guildId: string) => Promise<void>;
  refreshConfiguredMemberCounters: () => Promise<void>;
  listRoles: (guildId: string) => Promise<DashboardRoleSummary[]>;
  assignRoleToUser: (guildId: string, userId: string, roleId: string) => Promise<void>;
  removeRoleFromUser: (guildId: string, userId: string, roleId: string) => Promise<void>;
  createInvestigationRoleForGuild: (guildId: string, roleName?: string) => Promise<DashboardRoleSummary>;
  createTemporaryImageBlockRoleForGuild: (guildId: string, roleName?: string) => Promise<DashboardRoleSummary>;
};

function resolveGuild(client: Client, guildId: string) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) {
    throw new Error("Guild not found.");
  }
  return guild;
}

function roleColorHex(color: number): string | null {
  return color !== 0 ? `#${color.toString(16).padStart(6, "0")}` : null;
}

export function createGuildMemberService(dependencies: GuildMemberServiceDependencies): GuildMemberService {
  function toDashboardUserSummary(member: GuildMember): DashboardUserSummary {
    const now = new Date().toISOString();
    return {
      id: member.user.id,
      username: member.user.username,
      displayName: member.displayName,
      tag: member.user.tag,
      lastSeenAt: now
    };
  }

  async function searchUsers(guildId: string, query: string): Promise<DashboardUserSummary[]> {
    resolveGuild(dependencies.client, guildId);
    const users = await dependencies.searchCachedGuildUsers(guildId, query, 24);
    return users.map(user => ({
      id: user.userId,
      username: user.username,
      displayName: user.displayName,
      tag: user.tag,
      lastSeenAt: user.lastSeenAt
    }));
  }

  async function cacheGuildMember(member: GuildMember): Promise<void> {
    if (member.user.bot) {
      return;
    }
    const summary = toDashboardUserSummary(member);
    await dependencies.upsertCachedGuildUser({
      guildId: member.guild.id,
      userId: summary.id,
      username: summary.username,
      displayName: summary.displayName,
      tag: summary.tag,
      lastSeenAt: summary.lastSeenAt
    });
  }

  async function fetchUsers(guildId: string, query: string): Promise<DashboardUserSummary[]> {
    const guild = resolveGuild(dependencies.client, guildId);
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      return [];
    }
    const members = /^\d{16,22}$/.test(trimmedQuery)
      ? await guild.members.fetch(trimmedQuery).then(member => [member]).catch(() => [])
      : [...(await guild.members.fetch({ query: trimmedQuery, limit: 12 })).values()];
    const filtered = members.filter(member => member instanceof GuildMember && !member.user.bot);
    const summaries = filtered.map(toDashboardUserSummary);
    await dependencies.upsertCachedGuildUsers(summaries.map(summary => ({
      guildId,
      userId: summary.id,
      username: summary.username,
      displayName: summary.displayName,
      tag: summary.tag,
      lastSeenAt: summary.lastSeenAt
    })));
    return summaries.sort((left, right) => left.displayName.localeCompare(right.displayName));
  }

  async function updateMemberCounterChannelForGuild(guildId: string): Promise<void> {
    const guild = dependencies.client.guilds.cache.get(guildId);
    if (!guild) {
      return;
    }
    const settings = await dependencies.getGuildSettings(guildId);
    if (!settings.memberCounterChannelId) {
      return;
    }
    const channel = await guild.channels.fetch(settings.memberCounterChannelId).catch(() => null);
    if (!channel || !("edit" in channel) || typeof channel.edit !== "function" || !("name" in channel)) {
      return;
    }
    const nextName = dependencies.renderMemberCounterName(settings.memberCounterTemplate, guild.memberCount);
    const currentName = typeof channel.name === "string" ? channel.name : "";
    if (currentName === nextName) {
      return;
    }
    await channel.edit({ name: nextName, reason: "Updated Discrod member counter" }).catch(() => undefined);
  }

  async function refreshConfiguredMemberCounters(): Promise<void> {
    await Promise.all(dependencies.client.guilds.cache.map(async guild => {
      await updateMemberCounterChannelForGuild(guild.id).catch(() => undefined);
    }));
  }

  async function listRoles(guildId: string): Promise<DashboardRoleSummary[]> {
    const guild = resolveGuild(dependencies.client, guildId);
    const roles = guild.roles.cache.size > 0 ? guild.roles.cache : await guild.roles.fetch();
    return [...roles.values()]
      .filter(role => role !== null && !role.managed && role.name !== "@everyone")
      .map(role => ({
        id: role.id,
        name: role.name,
        colorHex: roleColorHex(role.color)
      }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  async function assignRoleToUser(guildId: string, userId: string, roleId: string): Promise<void> {
    const guild = resolveGuild(dependencies.client, guildId);
    dependencies.ensureGuildPermission(await dependencies.requireGuildBotMember(guildId), PermissionFlagsBits.ManageRoles, "Manage Roles");
    const member = await guild.members.fetch(userId);
    await member.roles.add(roleId, "Assigned from dashboard");
  }

  async function removeRoleFromUser(guildId: string, userId: string, roleId: string): Promise<void> {
    const guild = resolveGuild(dependencies.client, guildId);
    dependencies.ensureGuildPermission(await dependencies.requireGuildBotMember(guildId), PermissionFlagsBits.ManageRoles, "Manage Roles");
    const member = await guild.members.fetch(userId);
    await member.roles.remove(roleId, "Removed from dashboard");
  }

  async function createInvestigationRoleForGuild(guildId: string, roleName = "Discrod Investigation"): Promise<DashboardRoleSummary> {
    const guild = resolveGuild(dependencies.client, guildId);
    dependencies.ensureGuildPermission(await dependencies.requireGuildBotMember(guildId), PermissionFlagsBits.ManageRoles, "Manage Roles");
    const createdRole = await guild.roles.create({
      name: roleName.trim() || "Discrod Investigation",
      color: 0xe67e22,
      permissions: [],
      reason: "Created from Discrod moderation settings"
    });
    const channels = guild.channels.cache.size > 0 ? guild.channels.cache : await guild.channels.fetch();
    for (const channel of channels.values()) {
      if (!channel || !channel.isTextBased() || !("permissionOverwrites" in channel)) {
        continue;
      }
      try {
        await channel.permissionOverwrites.edit(createdRole.id, {
          SendMessages: false,
          SendMessagesInThreads: false,
          ReadMessageHistory: false,
          AttachFiles: false,
          EmbedLinks: false,
          CreatePublicThreads: false,
          CreatePrivateThreads: false,
          AddReactions: false
        }, { reason: "Restrict posting/history access for investigation role" });
      } catch {
        // Some channel types may reject overrides; bot-side enforcement still covers links/images.
      }
    }
    await dependencies.updateGuildSettings(guildId, { investigationRoleId: createdRole.id });
    return {
      id: createdRole.id,
      name: createdRole.name,
      colorHex: roleColorHex(createdRole.color)
    };
  }

  async function createTemporaryImageBlockRoleForGuild(guildId: string, roleName = "Discrod Temp Image Block"): Promise<DashboardRoleSummary> {
    const guild = resolveGuild(dependencies.client, guildId);
    dependencies.ensureGuildPermission(await dependencies.requireGuildBotMember(guildId), PermissionFlagsBits.ManageRoles, "Manage Roles");
    const createdRole = await guild.roles.create({
      name: roleName.trim() || "Discrod Temp Image Block",
      color: 0x3498db,
      permissions: [],
      reason: "Created from Discrod moderation settings"
    });
    const channels = guild.channels.cache.size > 0 ? guild.channels.cache : await guild.channels.fetch();
    for (const channel of channels.values()) {
      if (!channel || !channel.isTextBased() || !("permissionOverwrites" in channel)) {
        continue;
      }
      try {
        await channel.permissionOverwrites.edit(createdRole.id, {
          AttachFiles: false,
          EmbedLinks: false
        }, { reason: "Restrict image attachments and link previews for temp image block role" });
      } catch {
        // Bot-side enforcement still covers links/images when permissions cannot be set here.
      }
    }
    await dependencies.updateGuildSettings(guildId, { temporaryImageBlockRoleId: createdRole.id });
    return {
      id: createdRole.id,
      name: createdRole.name,
      colorHex: roleColorHex(createdRole.color)
    };
  }

  return {
    searchUsers,
    toDashboardUserSummary,
    cacheGuildMember,
    fetchUsers,
    updateMemberCounterChannelForGuild,
    refreshConfiguredMemberCounters,
    listRoles,
    assignRoleToUser,
    removeRoleFromUser,
    createInvestigationRoleForGuild,
    createTemporaryImageBlockRoleForGuild
  };
}
