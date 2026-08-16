import {
  ChannelType,
  OAuth2Scopes,
  PermissionFlagsBits,
  PermissionsBitField,
  type Client,
  type GuildMember,
  type PermissionsBitField as DiscordPermissionsBitField
} from "discord.js";
import {
  canSendMessages,
  describeChannelKind,
  isEditableTextChannelType,
  isVoiceChannelType
} from "./discordRuntimeHelpers.js";

type GuildChannelServiceDependencies = {
  client: Client;
  appClientId: string | null | undefined;
  requireGuildBotMember: (guildId: string) => Promise<GuildMember>;
  ensureGuildPermission: (member: GuildMember, permission: bigint, label: string) => void;
  ensureChannelPermission: (
    member: GuildMember,
    channel: { permissionsFor: (member: GuildMember) => DiscordPermissionsBitField | null },
    permission: bigint,
    label: string
  ) => void;
  getConnectedVoiceChannelId: (guildId: string) => string | null;
};

type DashboardListChannel = {
  id: string;
  name: string;
  kind: string;
  parentId: string | null;
  parentName: string | null;
  settingsEditable: boolean;
  canSendMessages: boolean;
  isVoice: boolean;
  botConnected: boolean;
  connectedMembers: Array<{ id: string; displayName: string; tag: string; isBot: boolean }>;
};

type DashboardChannelSettings = {
  guildId: string;
  channelId: string;
  kind: string;
  name: string;
  topic: string;
  nsfw: boolean;
  slowmodeSeconds: number;
  defaultAutoArchiveDuration: number;
  parentId: string | null;
  canEdit: boolean;
  availableCategories: Array<{ id: string; name: string }>;
};

type DashboardInvite = {
  code: string;
  url: string;
  channelId: string | null;
  channelName: string | null;
  inviterTag: string | null;
  uses: number | null;
  maxUses: number;
  maxAgeSeconds: number;
  temporary: boolean;
  createdAt: string | null;
  expiresAt: string | null;
};

type GuildChannelService = {
  listGuilds: () => Promise<Array<{
    id: string;
    name: string;
    iconUrl: string | null;
    description: string | null;
    memberCount: number;
    channelCount: number;
    textChannelCount: number;
    voiceChannelCount: number;
  }>>;
  buildBotInviteUrl: (guildId?: string | null) => string;
  listChannels: (guildId: string) => Promise<DashboardListChannel[]>;
  reorderGuildChannelInGuild: (
    guildId: string,
    input: { kind: "channel" | "category"; channelId: string; parentId?: string | null; position: number; }
  ) => Promise<void>;
  getChannelSettingsForGuild: (guildId: string, channelId: string) => Promise<DashboardChannelSettings>;
  saveChannelSettingsForGuild: (
    guildId: string,
    channelId: string,
    update: {
      name?: string;
      topic?: string;
      nsfw?: boolean;
      slowmodeSeconds?: number;
      defaultAutoArchiveDuration?: number;
      parentId?: string | null;
    }
  ) => Promise<DashboardChannelSettings>;
  createGuildChannelInGuild: (
    guildId: string,
    input: { name: string; type: "category" | "text" | "announcement" | "voice"; topic?: string; parentId?: string | null; }
  ) => Promise<{ id: string; name: string; kind: string }>;
  createThreadInGuild: (
    guildId: string,
    input: { channelId: string; name: string; starterMessage: string; autoArchiveDuration?: number; }
  ) => Promise<{ id: string; name: string }>;
  createPostInGuild: (guildId: string, input: { channelId: string; title?: string; content: string; }) => Promise<{ id: string }>;
  listGuildInvitesForGuild: (guildId: string) => Promise<DashboardInvite[]>;
  createGuildInviteForGuild: (
    guildId: string,
    input: { channelId: string; maxAgeSeconds?: number; maxUses?: number; temporary?: boolean; unique?: boolean; }
  ) => Promise<DashboardInvite>;
  deleteGuildInviteForGuild: (guildId: string, code: string) => Promise<boolean>;
  replaceGuildInviteForGuild: (
    guildId: string,
    code: string,
    input: { channelId: string; maxAgeSeconds?: number; maxUses?: number; temporary?: boolean; unique?: boolean; }
  ) => Promise<DashboardInvite>;
};

type ListChannelInternal = DashboardListChannel & { parentPosition: number; rawPosition: number };

function mapInvite(invite: {
  code: string;
  url: string;
  channel?: { id: string; name?: string | null } | null;
  inviter?: { tag: string } | null;
  uses?: number | null;
  maxUses?: number | null;
  maxAge?: number | null;
  temporary?: boolean | null;
  createdAt?: Date | null;
  expiresAt?: Date | null;
}): DashboardInvite {
  const channelName = invite.channel && typeof invite.channel.name === "string" ? invite.channel.name : null;
  return {
    code: invite.code,
    url: invite.url,
    channelId: invite.channel?.id ?? null,
    channelName,
    inviterTag: invite.inviter?.tag ?? null,
    uses: typeof invite.uses === "number" ? invite.uses : null,
    maxUses: invite.maxUses ?? 0,
    maxAgeSeconds: invite.maxAge ?? 0,
    temporary: invite.temporary ?? false,
    createdAt: invite.createdAt?.toISOString() ?? null,
    expiresAt: invite.expiresAt?.toISOString() ?? null
  };
}

function resolveGuild(dependencies: GuildChannelServiceDependencies, guildId: string) {
  const guild = dependencies.client.guilds.cache.get(guildId);
  if (!guild) {
    throw new Error("Guild not found.");
  }
  return guild;
}

function ensureAppClientId(appClientId: string | null | undefined): string {
  const clientId = appClientId?.trim() ?? "";
  if (!clientId) {
    throw new Error("DISCORD_CLIENT_ID is not configured.");
  }
  return clientId;
}

export function createGuildChannelService(dependencies: GuildChannelServiceDependencies): GuildChannelService {
  async function listGuilds(): Promise<Array<{
    id: string;
    name: string;
    iconUrl: string | null;
    description: string | null;
    memberCount: number;
    channelCount: number;
    textChannelCount: number;
    voiceChannelCount: number;
  }>> {
    return [...dependencies.client.guilds.cache.values()]
      .map(guild => {
        const channels = [...guild.channels.cache.values()];
        const textChannelCount = channels.filter(channel =>
          channel.type === ChannelType.GuildText
          || channel.type === ChannelType.GuildAnnouncement
          || channel.type === ChannelType.GuildForum
          || channel.type === ChannelType.GuildMedia
        ).length;
        const voiceChannelCount = channels.filter(channel =>
          channel.type === ChannelType.GuildVoice
          || channel.type === ChannelType.GuildStageVoice
        ).length;
        return {
          id: guild.id,
          name: guild.name,
          iconUrl: guild.iconURL({ size: 128, extension: "png" }) ?? null,
          description: typeof guild.description === "string" && guild.description.trim().length > 0 ? guild.description.trim() : null,
          memberCount: guild.memberCount,
          channelCount: textChannelCount + voiceChannelCount,
          textChannelCount,
          voiceChannelCount
        };
      })
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  function buildBotInviteUrl(guildId?: string | null): string {
    const permissions = new PermissionsBitField([
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.SendMessagesInThreads,
      PermissionFlagsBits.AttachFiles,
      PermissionFlagsBits.EmbedLinks,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.CreatePublicThreads,
      PermissionFlagsBits.CreatePrivateThreads,
      PermissionFlagsBits.ManageMessages,
      PermissionFlagsBits.ModerateMembers,
      PermissionFlagsBits.ManageRoles,
      PermissionFlagsBits.ManageChannels,
      PermissionFlagsBits.Connect,
      PermissionFlagsBits.Speak
    ]);
    const url = new URL("https://discord.com/oauth2/authorize");
    url.searchParams.set("client_id", ensureAppClientId(dependencies.appClientId));
    url.searchParams.set("scope", `${OAuth2Scopes.Bot} ${OAuth2Scopes.ApplicationsCommands}`);
    url.searchParams.set("permissions", permissions.bitfield.toString());
    if (guildId) {
      url.searchParams.set("guild_id", guildId);
      url.searchParams.set("disable_guild_select", "false");
    }
    return url.toString();
  }

  async function listChannels(guildId: string): Promise<DashboardListChannel[]> {
    const guild = resolveGuild(dependencies, guildId);
    const channels = guild.channels.cache.size > 0 ? guild.channels.cache : await guild.channels.fetch();
    const botVoiceChannelId = guild.members.me?.voice.channelId ?? dependencies.getConnectedVoiceChannelId(guildId);
    const items: ListChannelInternal[] = [];
    for (const channel of channels.values()) {
      if (!channel) {
        continue;
      }
      const isVoice = isVoiceChannelType(channel.type);
      const isForum = channel.type === ChannelType.GuildForum;
      const canSend = channel.isTextBased() && canSendMessages(channel);
      if (!isVoice && !isForum && !canSend) {
        continue;
      }
      const channelName = "name" in channel && typeof channel.name === "string" ? channel.name : channel.id;
      const parentName = "parent" in channel ? channel.parent?.name ?? null : null;
      let connectedMembers: Array<{ id: string; displayName: string; tag: string; isBot: boolean }> = [];
      if (channel.type === ChannelType.GuildVoice || channel.type === ChannelType.GuildStageVoice) {
        connectedMembers = [...channel.members.values()]
          .map(member => ({ id: member.id, displayName: member.displayName, tag: member.user.tag, isBot: member.user.bot }))
          .sort((left, right) => left.displayName.localeCompare(right.displayName));
      }
      items.push({
        id: channel.id,
        name: channelName,
        kind: describeChannelKind(channel.type),
        parentId: "parentId" in channel && typeof channel.parentId === "string" ? channel.parentId : null,
        parentName,
        settingsEditable: isEditableTextChannelType(channel.type),
        canSendMessages: canSend,
        isVoice,
        botConnected: isVoice && botVoiceChannelId === channel.id,
        connectedMembers,
        parentPosition: "parent" in channel ? channel.parent?.rawPosition ?? -1 : -1,
        rawPosition: "rawPosition" in channel && typeof channel.rawPosition === "number" ? channel.rawPosition : 0
      });
    }
    return items
      .sort((left, right) => {
        const parentPositionCompare = left.parentPosition - right.parentPosition;
        if (parentPositionCompare !== 0) {
          return parentPositionCompare;
        }
        const parentCompare = (left.parentName ?? "").localeCompare(right.parentName ?? "");
        if (parentCompare !== 0) {
          return parentCompare;
        }
        if (left.isVoice !== right.isVoice) {
          return left.isVoice ? 1 : -1;
        }
        const rawPositionCompare = left.rawPosition - right.rawPosition;
        if (rawPositionCompare !== 0) {
          return rawPositionCompare;
        }
        return left.name.localeCompare(right.name);
      })
      .map(({ parentPosition: _parentPosition, rawPosition: _rawPosition, ...item }) => item);
  }

  async function reorderGuildChannelInGuild(guildId: string, input: {
    kind: "channel" | "category";
    channelId: string;
    parentId?: string | null;
    position: number;
  }): Promise<void> {
    const guild = resolveGuild(dependencies, guildId);
    dependencies.ensureGuildPermission(await dependencies.requireGuildBotMember(guildId), PermissionFlagsBits.ManageChannels, "Manage Channels");
    const channel = await guild.channels.fetch(input.channelId);
    if (!channel) {
      throw new Error("Channel not found.");
    }
    const nextPosition = Math.max(0, input.position);
    if (input.kind === "category") {
      if (channel.type !== ChannelType.GuildCategory || !("setPosition" in channel) || typeof channel.setPosition !== "function") {
        throw new Error("That category cannot be reordered.");
      }
      await channel.setPosition(nextPosition, { relative: false });
      return;
    }
    if ("setParent" in channel && typeof channel.setParent === "function" && input.parentId !== undefined) {
      const currentParentId = "parentId" in channel && typeof channel.parentId === "string" ? channel.parentId : null;
      if (currentParentId !== input.parentId) {
        await channel.setParent(input.parentId ?? null, { lockPermissions: false });
      }
    }
    if (!("setPosition" in channel) || typeof channel.setPosition !== "function") {
      throw new Error("That channel cannot be reordered.");
    }
    await channel.setPosition(nextPosition, { relative: false });
  }

  async function getChannelSettingsForGuild(guildId: string, channelId: string): Promise<DashboardChannelSettings> {
    const guild = resolveGuild(dependencies, guildId);
    dependencies.ensureGuildPermission(await dependencies.requireGuildBotMember(guildId), PermissionFlagsBits.ManageChannels, "Manage Channels");
    const channels = guild.channels.cache.size > 0 ? guild.channels.cache : await guild.channels.fetch();
    const targetChannel = channels.get(channelId) ?? await guild.channels.fetch(channelId);
    if (!targetChannel) {
      throw new Error("Channel not found.");
    }
    const availableCategories = [...channels.values()]
      .filter(channel => channel?.type === ChannelType.GuildCategory)
      .map(channel => ({ id: channel.id, name: "name" in channel && typeof channel.name === "string" ? channel.name : channel.id }))
      .sort((left, right) => left.name.localeCompare(right.name));
    const canEdit = isEditableTextChannelType(targetChannel.type) && "edit" in targetChannel;
    return {
      guildId,
      channelId,
      kind: describeChannelKind(targetChannel.type),
      name: "name" in targetChannel && typeof targetChannel.name === "string" ? targetChannel.name : "",
      topic: "topic" in targetChannel && typeof targetChannel.topic === "string" ? targetChannel.topic : "",
      nsfw: "nsfw" in targetChannel && typeof targetChannel.nsfw === "boolean" ? targetChannel.nsfw : false,
      slowmodeSeconds: "rateLimitPerUser" in targetChannel && typeof targetChannel.rateLimitPerUser === "number" ? targetChannel.rateLimitPerUser : 0,
      defaultAutoArchiveDuration: "defaultAutoArchiveDuration" in targetChannel && typeof targetChannel.defaultAutoArchiveDuration === "number" ? targetChannel.defaultAutoArchiveDuration : 1440,
      parentId: "parentId" in targetChannel && typeof targetChannel.parentId === "string" ? targetChannel.parentId : null,
      canEdit,
      availableCategories
    };
  }

  async function saveChannelSettingsForGuild(guildId: string, channelId: string, update: {
    name?: string;
    topic?: string;
    nsfw?: boolean;
    slowmodeSeconds?: number;
    defaultAutoArchiveDuration?: number;
    parentId?: string | null;
  }): Promise<DashboardChannelSettings> {
    const guild = resolveGuild(dependencies, guildId);
    dependencies.ensureGuildPermission(await dependencies.requireGuildBotMember(guildId), PermissionFlagsBits.ManageChannels, "Manage Channels");
    const targetChannel = await guild.channels.fetch(channelId);
    if (!targetChannel) {
      throw new Error("Channel not found.");
    }
    if (!isEditableTextChannelType(targetChannel.type) || !("edit" in targetChannel)) {
      throw new Error("This channel does not expose editable Discord settings here.");
    }
    const autoArchive = typeof update.defaultAutoArchiveDuration === "number" && [60, 1440, 4320, 10080].includes(update.defaultAutoArchiveDuration)
      ? update.defaultAutoArchiveDuration as 60 | 1440 | 4320 | 10080
      : undefined;
    await targetChannel.edit({
      name: typeof update.name === "string" ? update.name.trim() : undefined,
      topic: typeof update.topic === "string" ? update.topic : undefined,
      nsfw: typeof update.nsfw === "boolean" ? update.nsfw : undefined,
      rateLimitPerUser: typeof update.slowmodeSeconds === "number" ? Math.max(0, update.slowmodeSeconds) : undefined,
      defaultAutoArchiveDuration: autoArchive,
      parent: update.parentId === undefined ? undefined : update.parentId === null ? null : update.parentId.trim() || null,
      reason: "Updated from Discrod channel settings"
    });
    return getChannelSettingsForGuild(guildId, channelId);
  }

  async function createGuildChannelInGuild(guildId: string, input: {
    name: string;
    type: "category" | "text" | "announcement" | "voice";
    topic?: string;
    parentId?: string | null;
  }): Promise<{ id: string; name: string; kind: string }> {
    const guild = resolveGuild(dependencies, guildId);
    dependencies.ensureGuildPermission(await dependencies.requireGuildBotMember(guildId), PermissionFlagsBits.ManageChannels, "Manage Channels");
    const name = input.name.trim();
    if (!name) {
      throw new Error("Channel name is required.");
    }
    const type = input.type === "category"
      ? ChannelType.GuildCategory
      : input.type === "voice"
        ? ChannelType.GuildVoice
        : input.type === "announcement"
          ? ChannelType.GuildAnnouncement
          : ChannelType.GuildText;
    const created = await guild.channels.create({
      name,
      type,
      parent: type === ChannelType.GuildCategory ? undefined : input.parentId === undefined ? undefined : input.parentId === null ? null : input.parentId.trim() || null,
      topic: type === ChannelType.GuildText || type === ChannelType.GuildAnnouncement ? input.topic?.trim() || undefined : undefined,
      reason: "Created from Discrod web UI"
    });
    return {
      id: created.id,
      name: "name" in created && typeof created.name === "string" ? created.name : name,
      kind: describeChannelKind(created.type)
    };
  }

  async function createThreadInGuild(guildId: string, input: {
    channelId: string;
    name: string;
    starterMessage: string;
    autoArchiveDuration?: number;
  }): Promise<{ id: string; name: string }> {
    const guild = resolveGuild(dependencies, guildId);
    const parentChannel = await guild.channels.fetch(input.channelId);
    if (!parentChannel || !parentChannel.isTextBased() || !canSendMessages(parentChannel)) {
      throw new Error("Select a text or announcement channel first.");
    }
    dependencies.ensureChannelPermission(await dependencies.requireGuildBotMember(guildId), parentChannel, PermissionFlagsBits.SendMessages, "Send Messages");
    if (parentChannel.type !== ChannelType.GuildText && parentChannel.type !== ChannelType.GuildAnnouncement) {
      throw new Error("Threads can only be created from text or announcement channels here.");
    }
    const threadName = input.name.trim();
    const starterMessage = input.starterMessage.trim();
    if (!threadName || !starterMessage) {
      throw new Error("Thread name and starter message are required.");
    }
    const starter = await parentChannel.send(starterMessage);
    const thread = await starter.startThread({
      name: threadName,
      autoArchiveDuration: [60, 1440, 4320, 10080].includes(input.autoArchiveDuration ?? 1440)
        ? input.autoArchiveDuration as 60 | 1440 | 4320 | 10080
        : 1440,
      reason: "Created from Discrod web UI"
    });
    return {
      id: thread.id,
      name: thread.name
    };
  }

  async function createPostInGuild(guildId: string, input: { channelId: string; title?: string; content: string; }): Promise<{ id: string }> {
    const guild = resolveGuild(dependencies, guildId);
    const channel = await guild.channels.fetch(input.channelId);
    if (!channel || !channel.isTextBased() || !canSendMessages(channel)) {
      throw new Error("Select a sendable text channel first.");
    }
    dependencies.ensureChannelPermission(await dependencies.requireGuildBotMember(guildId), channel, PermissionFlagsBits.SendMessages, "Send Messages");
    const content = input.content.trim();
    if (!content) {
      throw new Error("Post content is required.");
    }
    const title = input.title?.trim();
    const body = title ? `## ${title}\n${content}` : content;
    const sent = await channel.send(body);
    return { id: sent.id };
  }

  async function listGuildInvitesForGuild(guildId: string): Promise<DashboardInvite[]> {
    const guild = resolveGuild(dependencies, guildId);
    dependencies.ensureGuildPermission(await dependencies.requireGuildBotMember(guildId), PermissionFlagsBits.CreateInstantInvite, "Create Invites");
    const invites = await guild.invites.fetch();
    return [...invites.values()]
      .map(invite => mapInvite(invite))
      .sort((left, right) => (right.createdAt ?? "").localeCompare(left.createdAt ?? ""));
  }

  async function createGuildInviteForGuild(guildId: string, input: {
    channelId: string;
    maxAgeSeconds?: number;
    maxUses?: number;
    temporary?: boolean;
    unique?: boolean;
  }): Promise<DashboardInvite> {
    const guild = resolveGuild(dependencies, guildId);
    const channel = await guild.channels.fetch(input.channelId);
    if (!channel || !("createInvite" in channel) || typeof channel.createInvite !== "function") {
      throw new Error("Selected channel does not support invites.");
    }
    const invite = await channel.createInvite({
      maxAge: typeof input.maxAgeSeconds === "number" ? Math.max(0, input.maxAgeSeconds) : 0,
      maxUses: typeof input.maxUses === "number" ? Math.max(0, input.maxUses) : 0,
      temporary: input.temporary === true,
      unique: input.unique === true,
      reason: "Created from Discrod web UI"
    });
    return mapInvite(invite);
  }

  async function deleteGuildInviteForGuild(guildId: string, code: string): Promise<boolean> {
    const guild = resolveGuild(dependencies, guildId);
    const invite = await guild.invites.fetch(code).catch(() => null);
    if (!invite) {
      return false;
    }
    await invite.delete("Deleted from Discrod web UI").catch(() => undefined);
    return true;
  }

  async function replaceGuildInviteForGuild(guildId: string, code: string, input: {
    channelId: string;
    maxAgeSeconds?: number;
    maxUses?: number;
    temporary?: boolean;
    unique?: boolean;
  }): Promise<DashboardInvite> {
    await deleteGuildInviteForGuild(guildId, code);
    return createGuildInviteForGuild(guildId, input);
  }

  return {
    listGuilds,
    buildBotInviteUrl,
    listChannels,
    reorderGuildChannelInGuild,
    getChannelSettingsForGuild,
    saveChannelSettingsForGuild,
    createGuildChannelInGuild,
    createThreadInGuild,
    createPostInGuild,
    listGuildInvitesForGuild,
    createGuildInviteForGuild,
    deleteGuildInviteForGuild,
    replaceGuildInviteForGuild
  };
}
