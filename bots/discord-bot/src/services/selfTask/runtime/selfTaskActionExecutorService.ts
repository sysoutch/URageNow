import {
  ChannelType,
  PermissionFlagsBits,
  PermissionsBitField,
  type Client,
  type Guild,
  type GuildMember,
  type PermissionsBitField as DiscordPermissionsBitField
} from "discord.js";
import type { SelfTaskAction, SafeSelfTaskPermissionName } from "../../selfTaskService.js";
import type { SendableChannel } from "../../discordRuntimeHelpers.js";

type ChatModeChannelSettings = {
  enabled: boolean;
  allowedRoleIds: string[];
  allowedUserIds: string[];
  requireMentionOrReply: boolean;
  cooldownSeconds: number;
  systemPrompt: string;
};

type GuildSettingsForExecution = {
  chatModeChannels: Record<string, ChatModeChannelSettings>;
};

type SelfTaskActionExecutorDependencies = {
  client: Client;
  requireGuildBotMember: (guildId: string) => Promise<GuildMember>;
  ensureGuildPermission: (member: GuildMember, permission: bigint, label: string) => void;
  ensureChannelPermission: (
    member: GuildMember,
    channel: { permissionsFor: (member: GuildMember) => DiscordPermissionsBitField | null },
    permission: bigint,
    label: string
  ) => void;
  requireSendableChannel: (channelId: string) => Promise<SendableChannel>;
  sendChunkedToChannel: (channel: SendableChannel, content: string) => Promise<void>;
  describeChannel: (channel: unknown) => string;
  describeChannelKind: (value: number) => string;
  canSendMessages: (channel: unknown) => boolean;
  resolveGuildCategoryId: (guild: Guild, reference: string | null | undefined) => string | null;
  resolveGuildTextChannelId: (guild: Guild, reference: string, currentChannelId: string | null) => string | null;
  resolveGuildChannelId: (guild: Guild, reference: string | null | undefined, currentChannelId: string | null) => string | null;
  resolveGuildRoleId: (guild: Guild, reference: string | null | undefined) => string | null;
  resolveGuildMemberId: (guild: Guild, reference: string | null | undefined) => Promise<string | null>;
  resolveSelfTaskPermissions: (permissionNames: SafeSelfTaskPermissionName[]) => bigint[];
  explainChannelPermissionsForTarget: (input: {
    guild: Guild;
    channelId: string;
    subject: "bot" | "role" | "user";
    roleName?: string | null;
    targetUser?: string | null;
  }) => Promise<string>;
  createGuildChannelInGuild: (guildId: string, input: {
    name: string;
    type: "category" | "text" | "announcement" | "voice";
    topic?: string;
    parentId?: string | null;
  }) => Promise<{ id: string; name: string; kind: string }>;
  createThreadInGuild: (guildId: string, input: {
    channelId: string;
    name: string;
    starterMessage: string;
    autoArchiveDuration?: number;
  }) => Promise<{ id: string; name: string }>;
  createPostInGuild: (guildId: string, input: {
    channelId: string;
    title?: string;
    content: string;
  }) => Promise<{ id: string }>;
  saveChannelSettingsForGuild: (guildId: string, channelId: string, update: {
    topic?: string;
    nsfw?: boolean;
    slowmodeSeconds?: number;
    defaultAutoArchiveDuration?: number;
    parentId?: string | null;
  }) => Promise<{ name: string; slowmodeSeconds: number }>;
  reorderGuildChannelInGuild: (guildId: string, input: {
    kind: "channel" | "category";
    channelId: string;
    parentId?: string | null;
    position: number;
  }) => Promise<void>;
  listRoles: (guildId: string) => Promise<Array<{ id: string; name: string; colorHex: string | null }>>;
  searchCachedGuildUsers: (guildId: string, query: string, limit?: number) => Promise<Array<{ displayName: string; tag: string; lastSeenAt: string }>>;
  listGuildInvitesForGuild: (guildId: string) => Promise<Array<{
    code: string;
    channelName: string | null;
    uses: number | null;
    maxUses: number;
    maxAgeSeconds: number;
  }>>;
  createGuildInviteForGuild: (guildId: string, input: {
    channelId: string;
    maxAgeSeconds?: number;
    maxUses?: number;
    temporary?: boolean;
    unique?: boolean;
  }) => Promise<{ code: string; channelName: string | null }>;
  deleteGuildInviteForGuild: (guildId: string, code: string) => Promise<boolean>;
  replaceGuildInviteForGuild: (guildId: string, code: string, input: {
    channelId: string;
    maxAgeSeconds?: number;
    maxUses?: number;
    temporary?: boolean;
    unique?: boolean;
  }) => Promise<{ code: string; channelName: string | null }>;
  updateGuildSettings: (guildId: string, update: Record<string, unknown>) => Promise<unknown>;
  updateMemberCounterChannelForGuild: (guildId: string) => Promise<void>;
  getGuildSettings: (guildId: string) => Promise<GuildSettingsForExecution>;
  listRecentBotMessages: (channelId: string) => Promise<Array<{ id: string; content: string }>>;
  editBotAuthoredMessage: (channelId: string, messageId: string, content: string) => Promise<unknown>;
};

type SelfTaskActionExecutorService = {
  executeSelfTaskAction: (guildId: string, currentChannelId: string | null, action: SelfTaskAction) => Promise<string>;
};

function resolveGuild(client: Client, guildId: string): Guild {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) {
    throw new Error("Guild not found.");
  }
  return guild;
}

export function createSelfTaskActionExecutorService(dependencies: SelfTaskActionExecutorDependencies): SelfTaskActionExecutorService {
  async function executeSelfTaskAction(guildId: string, currentChannelId: string | null, action: SelfTaskAction): Promise<string> {
    const guild = resolveGuild(dependencies.client, guildId);
    if (action.type === "create_channel") {
      const parentId = dependencies.resolveGuildCategoryId(guild, action.parentName);
      if (action.parentName && !parentId) {
        throw new Error(`Could not resolve category "${action.parentName}".`);
      }
      const created = await dependencies.createGuildChannelInGuild(guildId, {
        name: action.name,
        type: action.channelType,
        parentId,
        topic: action.topic ?? undefined
      });
      return `Created ${created.kind.toLowerCase()} ${created.name}.`;
    }
    if (action.type === "create_role") {
      dependencies.ensureGuildPermission(await dependencies.requireGuildBotMember(guildId), PermissionFlagsBits.ManageRoles, "Manage Roles");
      const permissions = new PermissionsBitField(dependencies.resolveSelfTaskPermissions(action.permissions));
      const roleColor = action.colorHex ? Number.parseInt(action.colorHex.replace("#", ""), 16) : undefined;
      const createdRole = await guild.roles.create({
        name: action.name,
        color: Number.isFinite(roleColor) ? roleColor : undefined,
        hoist: action.hoist === true,
        mentionable: action.mentionable === true,
        permissions,
        reason: "Created from Discrod self task"
      });
      return `Created role ${createdRole.name}.`;
    }
    if (action.type === "rename_role") {
      dependencies.ensureGuildPermission(await dependencies.requireGuildBotMember(guildId), PermissionFlagsBits.ManageRoles, "Manage Roles");
      const roleId = dependencies.resolveGuildRoleId(guild, action.roleName);
      if (!roleId) {
        throw new Error(`Could not resolve role "${action.roleName}".`);
      }
      const role = guild.roles.cache.get(roleId) ?? await guild.roles.fetch(roleId).catch(() => null);
      if (!role) {
        throw new Error(`Role "${action.roleName}" was not found.`);
      }
      await role.edit({ name: action.newName, reason: "Renamed from Discrod self task" });
      return `Renamed role ${action.roleName} to ${action.newName}.`;
    }
    if (action.type === "assign_roles" || action.type === "remove_roles") {
      dependencies.ensureGuildPermission(await dependencies.requireGuildBotMember(guildId), PermissionFlagsBits.ManageRoles, "Manage Roles");
      const memberId = await dependencies.resolveGuildMemberId(guild, action.targetUser);
      if (!memberId) {
        throw new Error(`Could not resolve member "${action.targetUser}".`);
      }
      const member = await guild.members.fetch(memberId);
      const resolvedRoleIds = action.roleNames.map(roleName => {
        const roleId = dependencies.resolveGuildRoleId(guild, roleName);
        if (!roleId) {
          throw new Error(`Could not resolve role "${roleName}".`);
        }
        return roleId;
      });
      if (action.type === "assign_roles") {
        await member.roles.add(resolvedRoleIds, "Assigned from Discrod self task");
        return `Assigned ${action.roleNames.join(", ")} to ${member.user.tag}.`;
      }
      await member.roles.remove(resolvedRoleIds, "Removed from Discrod self task");
      return `Removed ${action.roleNames.join(", ")} from ${member.user.tag}.`;
    }
    if (action.type === "assign_role" || action.type === "remove_role") {
      dependencies.ensureGuildPermission(await dependencies.requireGuildBotMember(guildId), PermissionFlagsBits.ManageRoles, "Manage Roles");
      const roleId = dependencies.resolveGuildRoleId(guild, action.roleName);
      if (!roleId) {
        throw new Error(`Could not resolve role "${action.roleName}".`);
      }
      const memberId = await dependencies.resolveGuildMemberId(guild, action.targetUser);
      if (!memberId) {
        throw new Error(`Could not resolve member "${action.targetUser}".`);
      }
      const member = await guild.members.fetch(memberId);
      if (action.type === "assign_role") {
        await member.roles.add(roleId, "Assigned from Discrod self task");
        return `Assigned ${action.roleName} to ${member.user.tag}.`;
      }
      await member.roles.remove(roleId, "Removed from Discrod self task");
      return `Removed ${action.roleName} from ${member.user.tag}.`;
    }

    const channelId = "channelName" in action ? dependencies.resolveGuildChannelId(guild, action.channelName, currentChannelId) : null;
    if (action.type === "send_message") {
      if (!channelId) {
        throw new Error(`Could not resolve target channel "${action.channelName}".`);
      }
      const channel = await dependencies.requireSendableChannel(channelId);
      await dependencies.sendChunkedToChannel(channel, action.content);
      return `Sent a message to ${dependencies.describeChannel(channel)}.`;
    }
    if (action.type === "create_thread") {
      if (!channelId) {
        throw new Error(`Could not resolve target channel "${action.channelName}".`);
      }
      const created = await dependencies.createThreadInGuild(guildId, {
        channelId,
        name: action.name,
        starterMessage: action.starterMessage,
        autoArchiveDuration: action.autoArchiveDuration
      });
      return `Created thread ${created.name}.`;
    }
    if (action.type === "create_post") {
      if (!channelId) {
        throw new Error(`Could not resolve target channel "${action.channelName}".`);
      }
      await dependencies.createPostInGuild(guildId, {
        channelId,
        title: action.title ?? undefined,
        content: action.content
      });
      return `Created a post in ${action.channelName}.`;
    }
    if (action.type === "set_channel_role_permissions") {
      if (!channelId) {
        throw new Error(`Could not resolve target channel "${action.channelName}".`);
      }
      dependencies.ensureGuildPermission(await dependencies.requireGuildBotMember(guildId), PermissionFlagsBits.ManageRoles, "Manage Roles");
      const roleId = dependencies.resolveGuildRoleId(guild, action.roleName);
      if (!roleId) {
        throw new Error(`Could not resolve role "${action.roleName}".`);
      }
      const channel = await guild.channels.fetch(channelId);
      if (!channel || !("permissionOverwrites" in channel)) {
        throw new Error("That channel does not support permission overwrites.");
      }
      const overwrite: Record<string, boolean> = {};
      for (const permissionName of action.allowPermissions) {
        overwrite[permissionName] = true;
      }
      for (const permissionName of action.denyPermissions) {
        overwrite[permissionName] = false;
      }
      await channel.permissionOverwrites.edit(roleId, overwrite, { reason: "Updated from Discrod self task" });
      return `Updated ${action.roleName} access in ${action.channelName}.`;
    }
    if (action.type === "move_channel") {
      if (!channelId) {
        throw new Error(`Could not resolve target channel "${action.channelName}".`);
      }
      const parentId = action.parentName ? dependencies.resolveGuildCategoryId(guild, action.parentName) : null;
      if (action.parentName && !parentId) {
        throw new Error(`Could not resolve category "${action.parentName}".`);
      }
      await dependencies.reorderGuildChannelInGuild(guildId, {
        channelId,
        kind: "channel",
        position: action.position ?? 0,
        parentId: action.parentName ? parentId : undefined
      });
      return `Moved ${action.channelName}.`;
    }
    if (action.type === "rename_channel") {
      if (!channelId) {
        throw new Error(`Could not resolve target channel "${action.channelName}".`);
      }
      dependencies.ensureGuildPermission(await dependencies.requireGuildBotMember(guildId), PermissionFlagsBits.ManageChannels, "Manage Channels");
      const channel = await guild.channels.fetch(channelId);
      if (!channel || !("edit" in channel) || typeof channel.edit !== "function") {
        throw new Error("That channel cannot be renamed.");
      }
      await channel.edit({ name: action.newName, reason: "Renamed from Discrod self task" });
      return `Renamed ${action.channelName} to ${action.newName}.`;
    }
    if (action.type === "update_channel_settings") {
      if (!channelId) {
        throw new Error(`Could not resolve target channel "${action.channelName}".`);
      }
      const parentId = action.parentName ? dependencies.resolveGuildCategoryId(guild, action.parentName) : undefined;
      if (action.parentName && !parentId) {
        throw new Error(`Could not resolve category "${action.parentName}".`);
      }
      const updated = await dependencies.saveChannelSettingsForGuild(guildId, channelId, {
        topic: action.topic ?? undefined,
        nsfw: typeof action.nsfw === "boolean" ? action.nsfw : undefined,
        slowmodeSeconds: typeof action.slowmodeSeconds === "number" ? action.slowmodeSeconds : undefined,
        defaultAutoArchiveDuration: action.defaultAutoArchiveDuration ?? undefined,
        parentId
      });
      return `Updated settings for ${updated.name}.`;
    }
    if (action.type === "list_roles") {
      const roles = await dependencies.listRoles(guildId);
      if (roles.length === 0) {
        return "No non-managed server roles were found.";
      }
      return roles.slice(0, 25).map(role => `${role.name}${role.colorHex ? ` (${role.colorHex})` : ""}`).join("\n");
    }
    if (action.type === "list_channels") {
      const channels = guild.channels.cache.size > 0
        ? [...guild.channels.cache.values()]
        : [...(await guild.channels.fetch()).values()].filter((entry): entry is NonNullable<typeof entry> => entry !== null);
      const filtered = channels.filter(channel => {
        if (!channel) {
          return false;
        }
        if (!action.channelKind || action.channelKind === "all") {
          return true;
        }
        if (action.channelKind === "text") {
          return channel.type === ChannelType.GuildText;
        }
        if (action.channelKind === "announcement") {
          return channel.type === ChannelType.GuildAnnouncement;
        }
        if (action.channelKind === "voice") {
          return channel.type === ChannelType.GuildVoice || channel.type === ChannelType.GuildStageVoice;
        }
        if (action.channelKind === "thread") {
          return channel.isThread();
        }
        if (action.channelKind === "category") {
          return channel.type === ChannelType.GuildCategory;
        }
        return true;
      });
      if (filtered.length === 0) {
        return "No matching channels were found.";
      }
      return filtered
        .slice(0, 30)
        .map(channel => {
          const channelName = "name" in channel && typeof channel.name === "string" ? channel.name : channel.id;
          const parentName = "parent" in channel ? channel.parent?.name ?? null : null;
          return `${dependencies.describeChannelKind(channel.type)}: ${parentName ? `${parentName} / ` : ""}${channelName}`;
        })
        .join("\n");
    }
    if (action.type === "list_members") {
      const limit = action.limit ?? 20;
      if (action.roleName) {
        const roleId = dependencies.resolveGuildRoleId(guild, action.roleName);
        if (!roleId) {
          throw new Error(`Could not resolve role "${action.roleName}".`);
        }
        const members = [...guild.members.cache.values()]
          .filter(member => member.roles.cache.has(roleId))
          .filter(member => {
            if (!action.query) {
              return true;
            }
            const query = action.query.toLowerCase();
            return member.user.tag.toLowerCase().includes(query)
              || member.user.username.toLowerCase().includes(query)
              || member.displayName.toLowerCase().includes(query)
              || member.id.includes(query);
          })
          .sort((left, right) => left.displayName.localeCompare(right.displayName))
          .slice(0, limit);
        if (members.length === 0) {
          return `No cached members were found for role ${action.roleName}.`;
        }
        return members.map(member => `${member.displayName} (${member.user.tag})`).join("\n");
      }
      const cachedUsers = await dependencies.searchCachedGuildUsers(guildId, action.query ?? "", limit);
      if (cachedUsers.length === 0) {
        return "No cached members matched that request.";
      }
      return cachedUsers.map(user => `${user.displayName} (${user.tag}) | seen ${new Date(user.lastSeenAt).toLocaleString()}`).join("\n");
    }
    if (action.type === "list_invites") {
      const invites = await dependencies.listGuildInvitesForGuild(guildId);
      if (invites.length === 0) {
        return "No active invites were found.";
      }
      return invites
        .slice(0, 10)
        .map(invite => {
          const bits = [
            invite.code,
            invite.channelName ? `channel=${invite.channelName}` : null,
            invite.uses !== null ? `uses=${invite.uses}` : null,
            invite.maxUses > 0 ? `maxUses=${invite.maxUses}` : "maxUses=unlimited",
            invite.maxAgeSeconds > 0 ? `maxAge=${invite.maxAgeSeconds}s` : "maxAge=unlimited"
          ].filter(Boolean);
          return bits.join(" | ");
        })
        .join("\n");
    }
    if (action.type === "create_invite") {
      if (!channelId) {
        throw new Error(`Could not resolve target channel "${action.channelName}".`);
      }
      const invite = await dependencies.createGuildInviteForGuild(guildId, {
        channelId,
        maxAgeSeconds: action.maxAgeSeconds ?? undefined,
        maxUses: action.maxUses ?? undefined,
        temporary: action.temporary === true,
        unique: action.unique !== false
      });
      return `Created invite ${invite.code} for ${invite.channelName ?? action.channelName}.`;
    }
    if (action.type === "delete_invite") {
      const deleted = await dependencies.deleteGuildInviteForGuild(guildId, action.code);
      return deleted ? `Deleted invite ${action.code}.` : `Invite ${action.code} was not found.`;
    }
    if (action.type === "replace_invite") {
      if (!channelId) {
        throw new Error(`Could not resolve target channel "${action.channelName}".`);
      }
      const invite = await dependencies.replaceGuildInviteForGuild(guildId, action.code, {
        channelId,
        maxAgeSeconds: action.maxAgeSeconds ?? undefined,
        maxUses: action.maxUses ?? undefined,
        temporary: action.temporary === true,
        unique: action.unique !== false
      });
      return `Replaced invite ${action.code} with ${invite.code} for ${invite.channelName ?? action.channelName}.`;
    }
    if (action.type === "set_channel_slowmode") {
      if (!channelId) {
        throw new Error(`Could not resolve target channel "${action.channelName}".`);
      }
      const updated = await dependencies.saveChannelSettingsForGuild(guildId, channelId, {
        slowmodeSeconds: action.slowmodeSeconds
      });
      return `Set slowmode in ${updated.name} to ${updated.slowmodeSeconds}s.`;
    }
    if (action.type === "archive_thread" || action.type === "lock_thread") {
      if (!channelId) {
        throw new Error(`Could not resolve target channel "${action.channelName}".`);
      }
      dependencies.ensureGuildPermission(await dependencies.requireGuildBotMember(guildId), PermissionFlagsBits.ManageThreads, "Manage Threads");
      const channel = await guild.channels.fetch(channelId);
      if (!channel || !channel.isThread()) {
        throw new Error(`"${action.channelName}" is not a thread.`);
      }
      if (action.type === "archive_thread") {
        await channel.setArchived(true, "Archived from Discrod self task");
        if (action.locked === true) {
          await channel.setLocked(true, "Locked from Discrod self task");
        }
        return `Archived thread ${channel.name}${action.locked ? " and locked it" : ""}.`;
      }
      await channel.setLocked(true, "Locked from Discrod self task");
      if (action.archived !== false) {
        await channel.setArchived(true, "Archived from Discrod self task");
      }
      return `Locked thread ${channel.name}${action.archived !== false ? " and archived it" : ""}.`;
    }
    if (action.type === "set_welcome_channel") {
      const welcomeChannelId = dependencies.resolveGuildTextChannelId(guild, action.channelName, currentChannelId);
      if (!welcomeChannelId) {
        throw new Error(`Could not resolve welcome channel "${action.channelName}".`);
      }
      const channel = await guild.channels.fetch(welcomeChannelId);
      if (!channel || !channel.isTextBased() || !dependencies.canSendMessages(channel)) {
        throw new Error(`"${action.channelName}" cannot be used as a welcome channel.`);
      }
      dependencies.ensureChannelPermission(await dependencies.requireGuildBotMember(guildId), channel, PermissionFlagsBits.SendMessages, "Send Messages");
      await dependencies.updateGuildSettings(guildId, {
        welcomeEnabled: true,
        welcomeChannelId
      });
      return `Set welcome channel to ${dependencies.describeChannel(channel)}.`;
    }
    if (action.type === "set_welcome_message") {
      await dependencies.updateGuildSettings(guildId, {
        welcomeEnabled: action.enable !== false,
        welcomeMessage: action.message
      });
      return `Updated the welcome message${action.enable === false ? " and left welcomes disabled" : " and enabled welcomes"}.`;
    }
    if (action.type === "set_member_counter") {
      const counterChannelId = dependencies.resolveGuildChannelId(guild, action.channelName, currentChannelId);
      if (!counterChannelId) {
        throw new Error(`Could not resolve member counter channel "${action.channelName}".`);
      }
      dependencies.ensureGuildPermission(await dependencies.requireGuildBotMember(guildId), PermissionFlagsBits.ManageChannels, "Manage Channels");
      await dependencies.updateGuildSettings(guildId, {
        memberCounterChannelId: counterChannelId,
        memberCounterTemplate: action.template?.trim() || "Members: {count}"
      });
      await dependencies.updateMemberCounterChannelForGuild(guildId);
      const channel = await guild.channels.fetch(counterChannelId).catch(() => null);
      const channelName = channel && "name" in channel && typeof channel.name === "string" ? channel.name : action.channelName;
      return `Set member counter channel to ${channelName}.`;
    }
    if (action.type === "set_chat_mode") {
      const targetChannelId = dependencies.resolveGuildTextChannelId(guild, action.channelName, currentChannelId);
      if (!targetChannelId) {
        throw new Error(`Could not resolve chat mode channel "${action.channelName}".`);
      }
      const settings = await dependencies.getGuildSettings(guildId);
      const existing = settings.chatModeChannels[targetChannelId] ?? {
        enabled: false,
        allowedRoleIds: [],
        allowedUserIds: [],
        requireMentionOrReply: true,
        cooldownSeconds: 30,
        systemPrompt: ""
      };
      const resolvedRoleIds = action.allowedRoleNames && action.allowedRoleNames.length > 0
        ? action.allowedRoleNames.map(roleName => {
          const roleId = dependencies.resolveGuildRoleId(guild, roleName);
          if (!roleId) {
            throw new Error(`Could not resolve role "${roleName}".`);
          }
          return roleId;
        })
        : action.enabled
          ? [guild.id]
          : existing.allowedRoleIds;
      const resolvedUserIds = action.allowedUsers && action.allowedUsers.length > 0
        ? await Promise.all(action.allowedUsers.map(async userRef => {
          const memberId = await dependencies.resolveGuildMemberId(guild, userRef);
          if (!memberId) {
            throw new Error(`Could not resolve member "${userRef}".`);
          }
          return memberId;
        }))
        : existing.allowedUserIds;
      await dependencies.updateGuildSettings(guildId, {
        chatModeChannels: {
          ...settings.chatModeChannels,
          [targetChannelId]: {
            enabled: action.enabled,
            allowedRoleIds: [...new Set(resolvedRoleIds)],
            allowedUserIds: [...new Set(resolvedUserIds)],
            requireMentionOrReply: typeof action.requireMentionOrReply === "boolean" ? action.requireMentionOrReply : existing.requireMentionOrReply,
            cooldownSeconds: typeof action.cooldownSeconds === "number" ? action.cooldownSeconds : existing.cooldownSeconds,
            systemPrompt: action.systemPrompt ?? existing.systemPrompt
          }
        }
      });
      return `${action.enabled ? "Enabled" : "Disabled"} chat mode for ${action.channelName}.`;
    }
    if (action.type === "explain_channel_permissions") {
      if (!channelId) {
        throw new Error(`Could not resolve target channel "${action.channelName}".`);
      }
      return dependencies.explainChannelPermissionsForTarget({
        guild,
        channelId,
        subject: action.subject,
        roleName: action.roleName,
        targetUser: action.targetUser
      });
    }
    if (!channelId) {
      throw new Error(`Could not resolve target channel "${action.channelName}".`);
    }
    const messages = await dependencies.listRecentBotMessages(channelId);
    const normalizedMatchText = action.matchText.trim().toLowerCase();
    const message = messages.find(entry => entry.content.toLowerCase().includes(normalizedMatchText));
    if (!message) {
      throw new Error(`Could not find a recent bot message in "${action.channelName}" matching "${action.matchText}".`);
    }
    await dependencies.editBotAuthoredMessage(channelId, message.id, action.newContent);
    return `Edited a recent bot message in ${action.channelName}.`;
  }

  return {
    executeSelfTaskAction
  };
}

