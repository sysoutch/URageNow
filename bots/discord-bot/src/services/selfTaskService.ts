export const safeSelfTaskPermissionNames = [
  "ViewChannel",
  "SendMessages",
  "SendMessagesInThreads",
  "ReadMessageHistory",
  "AttachFiles",
  "EmbedLinks",
  "AddReactions",
  "Connect",
  "Speak",
  "CreateInstantInvite",
  "CreatePublicThreads",
  "CreatePrivateThreads",
  "ManageMessages",
  "ManageThreads"
] as const;

export type SafeSelfTaskPermissionName = typeof safeSelfTaskPermissionNames[number];

function sanitizePermissionName(value: unknown): SafeSelfTaskPermissionName | null {
  if (typeof value !== "string") {
    return null;
  }

  return safeSelfTaskPermissionNames.find(entry => entry === value.trim()) ?? null;
}

function sanitizePermissionList(value: unknown): SafeSelfTaskPermissionName[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value
    .map(entry => sanitizePermissionName(entry))
    .filter((entry): entry is SafeSelfTaskPermissionName => entry !== null))];
}

function sanitizeStringList(value: unknown, maxLength: number): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value
    .map(entry => sanitizeText(entry, maxLength))
    .filter(Boolean))];
}

export type SelfTaskAction =
  | {
    type: "create_channel";
    name: string;
    channelType: "category" | "text" | "announcement" | "voice";
    parentName?: string | null;
    topic?: string | null;
  }
  | {
    type: "send_message";
    channelName: string;
    content: string;
  }
  | {
    type: "create_thread";
    channelName: string;
    name: string;
    starterMessage: string;
    autoArchiveDuration?: 60 | 1440 | 4320 | 10080;
  }
  | {
    type: "create_post";
    channelName: string;
    title?: string | null;
    content: string;
  }
  | {
    type: "edit_bot_message";
    channelName: string;
    matchText: string;
    newContent: string;
  }
  | {
    type: "create_role";
    name: string;
    colorHex?: string | null;
    hoist?: boolean;
    mentionable?: boolean;
    permissions: SafeSelfTaskPermissionName[];
  }
  | {
    type: "set_channel_role_permissions";
    channelName: string;
    roleName: string;
    allowPermissions: SafeSelfTaskPermissionName[];
    denyPermissions: SafeSelfTaskPermissionName[];
  }
  | {
    type: "rename_role";
    roleName: string;
    newName: string;
  }
  | {
    type: "assign_roles";
    roleNames: string[];
    targetUser: string;
  }
  | {
    type: "assign_role";
    roleName: string;
    targetUser: string;
  }
  | {
    type: "remove_roles";
    roleNames: string[];
    targetUser: string;
  }
  | {
    type: "remove_role";
    roleName: string;
    targetUser: string;
  }
  | {
    type: "move_channel";
    channelName: string;
    parentName?: string | null;
    position?: number | null;
  }
  | {
    type: "rename_channel";
    channelName: string;
    newName: string;
  }
  | {
    type: "update_channel_settings";
    channelName: string;
    topic?: string | null;
    nsfw?: boolean;
    slowmodeSeconds?: number | null;
    defaultAutoArchiveDuration?: 60 | 1440 | 4320 | 10080 | null;
    parentName?: string | null;
  }
  | {
    type: "list_roles";
  }
  | {
    type: "list_channels";
    channelKind?: "all" | "text" | "announcement" | "voice" | "thread" | "category";
  }
  | {
    type: "list_members";
    roleName?: string | null;
    query?: string | null;
    limit?: number | null;
  }
  | {
    type: "list_invites";
  }
  | {
    type: "create_invite";
    channelName: string;
    maxAgeSeconds?: number | null;
    maxUses?: number | null;
    temporary?: boolean;
    unique?: boolean;
  }
  | {
    type: "delete_invite";
    code: string;
  }
  | {
    type: "replace_invite";
    code: string;
    channelName: string;
    maxAgeSeconds?: number | null;
    maxUses?: number | null;
    temporary?: boolean;
    unique?: boolean;
  }
  | {
    type: "set_channel_slowmode";
    channelName: string;
    slowmodeSeconds: number;
  }
  | {
    type: "archive_thread";
    channelName: string;
    locked?: boolean;
  }
  | {
    type: "lock_thread";
    channelName: string;
    archived?: boolean;
  }
  | {
    type: "set_welcome_message";
    message: string;
    enable?: boolean;
  }
  | {
    type: "set_welcome_channel";
    channelName: string;
  }
  | {
    type: "set_member_counter";
    channelName: string;
    template?: string | null;
  }
  | {
    type: "set_chat_mode";
    channelName: string;
    enabled: boolean;
    requireMentionOrReply?: boolean;
    cooldownSeconds?: number | null;
    allowedRoleNames?: string[];
    allowedUsers?: string[];
    systemPrompt?: string | null;
  }
  | {
    type: "explain_channel_permissions";
    channelName: string;
    subject: "bot" | "role" | "user";
    roleName?: string | null;
    targetUser?: string | null;
  };

export interface PlannedSelfTaskBatch {
  summary: string;
  actions: SelfTaskAction[];
}

export interface PendingSelfTaskBatch extends PlannedSelfTaskBatch {
  id: string;
  reviewId?: string;
  guildId: string;
  currentChannelId: string | null;
  requestedByUserId: string;
  requestedByTag: string;
  requestText: string;
  createdAt: string;
  allowedActionTypes: string[];
  dryRunOnly: boolean;
}

function sanitizeText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function stripCodeFences(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  return fenced?.[1]?.trim() ?? trimmed;
}

function parseAction(entry: unknown): SelfTaskAction | null {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const action = entry as Record<string, unknown>;
  const operation = sanitizeText(action.operation, 40).toLowerCase();
  const resource = sanitizeText(action.resource, 60).toLowerCase();

  if (operation && resource) {
    const params = typeof action.params === "object" && action.params !== null
      ? action.params as Record<string, unknown>
      : {};

    if (operation === "create" && resource === "channel") {
      return parseAction({
        type: "create_channel",
        name: params.name,
        channelType: params.channelType ?? params.kind,
        parentName: params.parentName,
        topic: params.topic
      });
    }

    if (operation === "send" && (resource === "message" || resource === "reply")) {
      return parseAction({
        type: "send_message",
        channelName: params.channelName,
        content: params.content
      });
    }

    if (operation === "create" && resource === "thread") {
      return parseAction({
        type: "create_thread",
        channelName: params.channelName,
        name: params.name,
        starterMessage: params.starterMessage,
        autoArchiveDuration: params.autoArchiveDuration
      });
    }

    if (operation === "create" && resource === "post") {
      return parseAction({
        type: "create_post",
        channelName: params.channelName,
        title: params.title,
        content: params.content
      });
    }

    if ((operation === "edit" || operation === "update") && (resource === "bot_message" || resource === "message")) {
      return parseAction({
        type: "edit_bot_message",
        channelName: params.channelName,
        matchText: params.matchText,
        newContent: params.newContent
      });
    }

    if (operation === "create" && resource === "role") {
      return parseAction({
        type: "create_role",
        name: params.name,
        colorHex: params.colorHex,
        hoist: params.hoist,
        mentionable: params.mentionable,
        permissions: params.permissions
      });
    }

    if ((operation === "set" || operation === "update") && resource === "channel_role_permissions") {
      return parseAction({
        type: "set_channel_role_permissions",
        channelName: params.channelName,
        roleName: params.roleName,
        allowPermissions: params.allowPermissions,
        denyPermissions: params.denyPermissions
      });
    }

    if ((operation === "rename" || operation === "update") && resource === "role") {
      return parseAction({
        type: "rename_role",
        roleName: params.roleName,
        newName: params.newName
      });
    }

    if (operation === "assign" && resource === "roles") {
      return parseAction({
        type: "assign_roles",
        roleNames: params.roleNames ?? params.roles,
        targetUser: params.targetUser
      });
    }

    if (operation === "assign" && resource === "role") {
      return parseAction({
        type: "assign_role",
        roleName: params.roleName,
        targetUser: params.targetUser
      });
    }

    if (operation === "remove" && resource === "roles") {
      return parseAction({
        type: "remove_roles",
        roleNames: params.roleNames ?? params.roles,
        targetUser: params.targetUser
      });
    }

    if (operation === "remove" && resource === "role") {
      return parseAction({
        type: "remove_role",
        roleName: params.roleName,
        targetUser: params.targetUser
      });
    }

    if (operation === "move" && resource === "channel") {
      return parseAction({
        type: "move_channel",
        channelName: params.channelName,
        parentName: params.parentName,
        position: params.position
      });
    }

    if ((operation === "rename" || operation === "update") && resource === "channel") {
      return parseAction({
        type: "rename_channel",
        channelName: params.channelName,
        newName: params.newName
      });
    }

    if ((operation === "set" || operation === "update") && resource === "channel_settings") {
      return parseAction({
        type: "update_channel_settings",
        channelName: params.channelName,
        topic: params.topic,
        nsfw: params.nsfw,
        slowmodeSeconds: params.slowmodeSeconds,
        defaultAutoArchiveDuration: params.defaultAutoArchiveDuration,
        parentName: params.parentName
      });
    }

    if (operation === "list" && resource === "roles") {
      return parseAction({
        type: "list_roles"
      });
    }

    if (operation === "list" && (resource === "channels" || resource === "channel_list")) {
      return parseAction({
        type: "list_channels",
        channelKind: params.channelKind ?? params.kind
      });
    }

    if (operation === "list" && resource === "members") {
      return parseAction({
        type: "list_members",
        roleName: params.roleName,
        query: params.query,
        limit: params.limit
      });
    }

    if (operation === "list" && resource === "invites") {
      return parseAction({
        type: "list_invites"
      });
    }

    if (operation === "create" && resource === "invite") {
      return parseAction({
        type: "create_invite",
        channelName: params.channelName,
        maxAgeSeconds: params.maxAgeSeconds,
        maxUses: params.maxUses,
        temporary: params.temporary,
        unique: params.unique
      });
    }

    if ((operation === "delete" || operation === "remove") && resource === "invite") {
      return parseAction({
        type: "delete_invite",
        code: params.code
      });
    }

    if ((operation === "replace" || operation === "update") && resource === "invite") {
      return parseAction({
        type: "replace_invite",
        code: params.code,
        channelName: params.channelName,
        maxAgeSeconds: params.maxAgeSeconds,
        maxUses: params.maxUses,
        temporary: params.temporary,
        unique: params.unique
      });
    }

    if (
      ((operation === "set" || operation === "update") && resource === "channel_slowmode")
      || (operation === "slowmode" && resource === "channel")
    ) {
      return parseAction({
        type: "set_channel_slowmode",
        channelName: params.channelName,
        slowmodeSeconds: params.slowmodeSeconds ?? params.seconds
      });
    }

    if (operation === "archive" && resource === "thread") {
      return parseAction({
        type: "archive_thread",
        channelName: params.channelName,
        locked: params.locked
      });
    }

    if (operation === "lock" && resource === "thread") {
      return parseAction({
        type: "lock_thread",
        channelName: params.channelName,
        archived: params.archived
      });
    }

    if ((operation === "set" || operation === "update") && resource === "welcome_channel") {
      return parseAction({
        type: "set_welcome_channel",
        channelName: params.channelName
      });
    }

    if ((operation === "set" || operation === "update") && resource === "welcome_message") {
      return parseAction({
        type: "set_welcome_message",
        message: params.message,
        enable: params.enable
      });
    }

    if ((operation === "set" || operation === "update") && resource === "member_counter") {
      return parseAction({
        type: "set_member_counter",
        channelName: params.channelName,
        template: params.template
      });
    }

    if ((operation === "set" || operation === "update") && resource === "chat_mode") {
      return parseAction({
        type: "set_chat_mode",
        channelName: params.channelName,
        enabled: params.enabled,
        requireMentionOrReply: params.requireMentionOrReply,
        cooldownSeconds: params.cooldownSeconds,
        allowedRoleNames: params.allowedRoleNames ?? params.roles,
        allowedUsers: params.allowedUsers ?? params.users,
        systemPrompt: params.systemPrompt
      });
    }

    if ((operation === "explain" || operation === "inspect" || operation === "check") && resource === "channel_permissions") {
      return parseAction({
        type: "explain_channel_permissions",
        channelName: params.channelName,
        subject: params.subject,
        roleName: params.roleName,
        targetUser: params.targetUser
      });
    }
  }

  if (action.type === "create_channel") {
    const name = sanitizeText(action.name, 100);
    const channelType = action.channelType === "category"
      || action.channelType === "text"
      || action.channelType === "announcement"
      || action.channelType === "voice"
      ? action.channelType
      : null;
    if (!name || !channelType) {
      return null;
    }

    return {
      type: "create_channel",
      name,
      channelType,
      parentName: sanitizeText(action.parentName, 100) || null,
      topic: sanitizeText(action.topic, 1024) || null
    };
  }

  if (action.type === "send_message") {
    const channelName = sanitizeText(action.channelName, 100);
    const content = sanitizeText(action.content, 6000);
    if (!channelName || !content) {
      return null;
    }

    return {
      type: "send_message",
      channelName,
      content
    };
  }

  if (action.type === "create_thread") {
    const channelName = sanitizeText(action.channelName, 100);
    const name = sanitizeText(action.name, 100);
    const starterMessage = sanitizeText(action.starterMessage, 4000);
    const autoArchiveDuration = action.autoArchiveDuration === 60
      || action.autoArchiveDuration === 1440
      || action.autoArchiveDuration === 4320
      || action.autoArchiveDuration === 10080
      ? action.autoArchiveDuration
      : undefined;
    if (!channelName || !name || !starterMessage) {
      return null;
    }

    return {
      type: "create_thread",
      channelName,
      name,
      starterMessage,
      autoArchiveDuration
    };
  }

  if (action.type === "create_post") {
    const channelName = sanitizeText(action.channelName, 100);
    const content = sanitizeText(action.content, 4000);
    if (!channelName || !content) {
      return null;
    }

    return {
      type: "create_post",
      channelName,
      title: sanitizeText(action.title, 200) || null,
      content
    };
  }

  if (action.type === "edit_bot_message") {
    const channelName = sanitizeText(action.channelName, 100);
    const matchText = sanitizeText(action.matchText, 200);
    const newContent = sanitizeText(action.newContent, 2000);
    if (!channelName || !matchText || !newContent) {
      return null;
    }

    return {
      type: "edit_bot_message",
      channelName,
      matchText,
      newContent
    };
  }

  if (action.type === "create_role") {
    const name = sanitizeText(action.name, 100);
    if (!name) {
      return null;
    }

    const colorHex = sanitizeText(action.colorHex, 16);
    return {
      type: "create_role",
      name,
      colorHex: /^#?[0-9a-f]{6}$/i.test(colorHex) ? (colorHex.startsWith("#") ? colorHex : `#${colorHex}`) : null,
      hoist: action.hoist === true,
      mentionable: action.mentionable === true,
      permissions: sanitizePermissionList(action.permissions)
    };
  }

  if (action.type === "set_channel_role_permissions") {
    const channelName = sanitizeText(action.channelName, 100);
    const roleName = sanitizeText(action.roleName, 100);
    if (!channelName || !roleName) {
      return null;
    }

    return {
      type: "set_channel_role_permissions",
      channelName,
      roleName,
      allowPermissions: sanitizePermissionList(action.allowPermissions),
      denyPermissions: sanitizePermissionList(action.denyPermissions)
    };
  }

  if (action.type === "rename_role") {
    const roleName = sanitizeText(action.roleName, 100);
    const newName = sanitizeText(action.newName, 100);
    if (!roleName || !newName) {
      return null;
    }

    return {
      type: "rename_role",
      roleName,
      newName
    };
  }

  if (action.type === "assign_roles" || action.type === "remove_roles") {
    const targetUser = sanitizeText(action.targetUser, 120);
    const roleNames = sanitizeStringList(action.roleNames, 100);
    if (!targetUser || roleNames.length === 0) {
      return null;
    }

    return {
      type: action.type,
      roleNames,
      targetUser
    };
  }

  if (action.type === "assign_role" || action.type === "remove_role") {
    const roleName = sanitizeText(action.roleName, 100);
    const targetUser = sanitizeText(action.targetUser, 120);
    if (!roleName || !targetUser) {
      return null;
    }

    return {
      type: action.type,
      roleName,
      targetUser
    };
  }

  if (action.type === "move_channel") {
    const channelName = sanitizeText(action.channelName, 100);
    if (!channelName) {
      return null;
    }

    return {
      type: "move_channel",
      channelName,
      parentName: sanitizeText(action.parentName, 100) || null,
      position: typeof action.position === "number" ? Math.max(0, Math.round(action.position)) : null
    };
  }

  if (action.type === "rename_channel") {
    const channelName = sanitizeText(action.channelName, 100);
    const newName = sanitizeText(action.newName, 100);
    if (!channelName || !newName) {
      return null;
    }

    return {
      type: "rename_channel",
      channelName,
      newName
    };
  }

  if (action.type === "update_channel_settings") {
    const channelName = sanitizeText(action.channelName, 100);
    if (!channelName) {
      return null;
    }

    const autoArchive = action.defaultAutoArchiveDuration === 60
      || action.defaultAutoArchiveDuration === 1440
      || action.defaultAutoArchiveDuration === 4320
      || action.defaultAutoArchiveDuration === 10080
      ? action.defaultAutoArchiveDuration
      : null;

    return {
      type: "update_channel_settings",
      channelName,
      topic: sanitizeText(action.topic, 1024) || null,
      nsfw: typeof action.nsfw === "boolean" ? action.nsfw : undefined,
      slowmodeSeconds: typeof action.slowmodeSeconds === "number"
        ? Math.max(0, Math.min(21600, Math.round(action.slowmodeSeconds)))
        : null,
      defaultAutoArchiveDuration: autoArchive,
      parentName: sanitizeText(action.parentName, 100) || null
    };
  }

  if (action.type === "list_roles") {
    return {
      type: "list_roles"
    };
  }

  if (action.type === "list_channels") {
    const channelKind = action.channelKind === "text"
      || action.channelKind === "announcement"
      || action.channelKind === "voice"
      || action.channelKind === "thread"
      || action.channelKind === "category"
      || action.channelKind === "all"
      ? action.channelKind
      : undefined;

    return {
      type: "list_channels",
      channelKind
    };
  }

  if (action.type === "list_members") {
    return {
      type: "list_members",
      roleName: sanitizeText(action.roleName, 100) || null,
      query: sanitizeText(action.query, 120) || null,
      limit: typeof action.limit === "number" ? Math.max(1, Math.min(50, Math.round(action.limit))) : null
    };
  }

  if (action.type === "list_invites") {
    return {
      type: "list_invites"
    };
  }

  if (action.type === "create_invite") {
    const channelName = sanitizeText(action.channelName, 100);
    if (!channelName) {
      return null;
    }

    return {
      type: "create_invite",
      channelName,
      maxAgeSeconds: typeof action.maxAgeSeconds === "number" ? Math.max(0, Math.round(action.maxAgeSeconds)) : null,
      maxUses: typeof action.maxUses === "number" ? Math.max(0, Math.round(action.maxUses)) : null,
      temporary: action.temporary === true,
      unique: action.unique !== false
    };
  }

  if (action.type === "delete_invite") {
    const code = sanitizeText(action.code, 40);
    if (!code) {
      return null;
    }

    return {
      type: "delete_invite",
      code
    };
  }

  if (action.type === "replace_invite") {
    const code = sanitizeText(action.code, 40);
    const channelName = sanitizeText(action.channelName, 100);
    if (!code || !channelName) {
      return null;
    }

    return {
      type: "replace_invite",
      code,
      channelName,
      maxAgeSeconds: typeof action.maxAgeSeconds === "number" ? Math.max(0, Math.round(action.maxAgeSeconds)) : null,
      maxUses: typeof action.maxUses === "number" ? Math.max(0, Math.round(action.maxUses)) : null,
      temporary: action.temporary === true,
      unique: action.unique !== false
    };
  }

  if (action.type === "set_channel_slowmode") {
    const channelName = sanitizeText(action.channelName, 100);
    if (!channelName || typeof action.slowmodeSeconds !== "number") {
      return null;
    }

    return {
      type: "set_channel_slowmode",
      channelName,
      slowmodeSeconds: Math.max(0, Math.min(21600, Math.round(action.slowmodeSeconds)))
    };
  }

  if (action.type === "archive_thread") {
    const channelName = sanitizeText(action.channelName, 100);
    if (!channelName) {
      return null;
    }

    return {
      type: "archive_thread",
      channelName,
      locked: action.locked === true
    };
  }

  if (action.type === "lock_thread") {
    const channelName = sanitizeText(action.channelName, 100);
    if (!channelName) {
      return null;
    }

    return {
      type: "lock_thread",
      channelName,
      archived: action.archived !== false
    };
  }

  if (action.type === "set_welcome_channel") {
    const channelName = sanitizeText(action.channelName, 100);
    if (!channelName) {
      return null;
    }

    return {
      type: "set_welcome_channel",
      channelName
    };
  }

  if (action.type === "set_welcome_message") {
    const message = sanitizeText(action.message, 1800);
    if (!message) {
      return null;
    }

    return {
      type: "set_welcome_message",
      message,
      enable: action.enable !== false
    };
  }

  if (action.type === "set_member_counter") {
    const channelName = sanitizeText(action.channelName, 100);
    if (!channelName) {
      return null;
    }

    return {
      type: "set_member_counter",
      channelName,
      template: sanitizeText(action.template, 120) || null
    };
  }

  if (action.type === "set_chat_mode") {
    const channelName = sanitizeText(action.channelName, 100);
    if (!channelName || typeof action.enabled !== "boolean") {
      return null;
    }

    return {
      type: "set_chat_mode",
      channelName,
      enabled: action.enabled,
      requireMentionOrReply: typeof action.requireMentionOrReply === "boolean" ? action.requireMentionOrReply : undefined,
      cooldownSeconds: typeof action.cooldownSeconds === "number"
        ? Math.max(0, Math.min(3600, Math.round(action.cooldownSeconds)))
        : null,
      allowedRoleNames: sanitizeStringList(action.allowedRoleNames, 100),
      allowedUsers: sanitizeStringList(action.allowedUsers, 120),
      systemPrompt: sanitizeText(action.systemPrompt, 1000) || null
    };
  }

  if (action.type === "explain_channel_permissions") {
    const channelName = sanitizeText(action.channelName, 100);
    const subject = action.subject === "bot" || action.subject === "role" || action.subject === "user"
      ? action.subject
      : null;
    if (!channelName || !subject) {
      return null;
    }

    return {
      type: "explain_channel_permissions",
      channelName,
      subject,
      roleName: sanitizeText(action.roleName, 100) || null,
      targetUser: sanitizeText(action.targetUser, 120) || null
    };
  }

  return null;
}

export function parsePlannedSelfTaskBatch(raw: string): PlannedSelfTaskBatch {
  const normalized = stripCodeFences(raw);
  const parsed = JSON.parse(normalized) as Record<string, unknown>;
  const actions = Array.isArray(parsed.actions)
    ? parsed.actions.map(parseAction).filter((item): item is SelfTaskAction => item !== null)
    : [];
  const summary = sanitizeText(parsed.summary, 400) || "Rod prepared a task batch.";
  return {
    summary,
    actions
  };
}

export function buildSelfTaskPlannerPrompt(input: {
  guildName: string;
  currentChannelName: string | null;
  requestText: string;
  channels: Array<{ name: string; kind: string; parentName: string | null }>;
  categories: string[];
  roles?: string[];
  allowedActionTypes?: string[];
  dryRunOnly?: boolean;
}): string {
  const channelLines = input.channels
    .slice(0, 120)
    .map(channel => `- ${channel.name} | ${channel.kind}${channel.parentName ? ` | category=${channel.parentName}` : ""}`)
    .join("\n");
  const categoryLines = input.categories.slice(0, 50).map(name => `- ${name}`).join("\n");
  const roleLines = (input.roles ?? []).slice(0, 80).map(name => `- ${name}`).join("\n");

  return [
    "You are LazyDev planning safe Discord bot self_task actions.",
    "Return strict JSON only. No markdown fences, no explanations outside JSON.",
    "Allowed action types: create_channel, send_message.",
    "Also allowed: create_thread, create_post, edit_bot_message, create_role, set_channel_role_permissions, rename_role, assign_role, assign_roles, remove_role, remove_roles, move_channel, rename_channel, update_channel_settings, list_roles, list_channels, list_members, list_invites, create_invite, delete_invite, replace_invite, set_channel_slowmode, archive_thread, lock_thread, set_welcome_channel, set_welcome_message, set_member_counter, set_chat_mode, explain_channel_permissions.",
    "Never use any other action type.",
    `Only use these permission names when needed: ${safeSelfTaskPermissionNames.join(", ")}.`,
    `Server allowlist: ${(input.allowedActionTypes && input.allowedActionTypes.length > 0 ? input.allowedActionTypes.join(", ") : "none")}.`,
    input.dryRunOnly ? "This server is currently in dry-run-only mode. You can still plan, but execution will stay preview-only." : "This server can execute allowed self tasks after approval.",
    "Only produce actions that a bot account can safely do on its own.",
    "Do not impersonate a human account.",
    "If the request is ambiguous, keep actions empty and explain in summary.",
    "Prefer the generic self_task schema below. Legacy type-specific actions are still accepted, but the generic shape is preferred.",
    "{",
    '  "summary": "short summary",',
    '  "actions": [',
    '    { "operation": "create|send|edit|update|assign|remove|move|list|delete|replace|archive|lock|slowmode|set|explain|inspect|check", "resource": "channel|thread|post|role|roles|channels|members|invite|welcome_channel|welcome_message|member_counter|chat_mode|channel_settings|channel_permissions|channel_role_permissions|channel_slowmode|bot_message", "params": { "..." : "..." } },',
    '    { "type": "create_channel", "name": "name", "channelType": "text|voice|announcement|category", "parentName": "optional category name", "topic": "optional topic" },',
    '    { "type": "send_message", "channelName": "existing channel name or __CURRENT_CHANNEL__", "content": "message content" },',
    '    { "type": "create_thread", "channelName": "existing text channel name or __CURRENT_CHANNEL__", "name": "thread name", "starterMessage": "thread starter", "autoArchiveDuration": 1440 },',
    '    { "type": "create_post", "channelName": "existing channel name or __CURRENT_CHANNEL__", "title": "optional title", "content": "post content" },',
    '    { "type": "edit_bot_message", "channelName": "existing channel name or __CURRENT_CHANNEL__", "matchText": "short text to find the recent bot message", "newContent": "replacement content" },',
    '    { "type": "create_role", "name": "role name", "colorHex": "#5865F2", "hoist": false, "mentionable": false, "permissions": ["ViewChannel", "SendMessages"] },',
    '    { "type": "set_channel_role_permissions", "channelName": "existing channel name or __CURRENT_CHANNEL__", "roleName": "existing role name", "allowPermissions": ["ViewChannel"], "denyPermissions": ["SendMessages"] },',
    '    { "type": "rename_role", "roleName": "old role", "newName": "new role" },',
    '    { "type": "assign_roles", "roleNames": ["role one", "role two"], "targetUser": "username or tag or id" },',
    '    { "type": "assign_role", "roleName": "member role", "targetUser": "username or tag or id" },',
    '    { "type": "remove_roles", "roleNames": ["role one", "role two"], "targetUser": "username or tag or id" },',
    '    { "type": "remove_role", "roleName": "member role", "targetUser": "username or tag or id" },',
    '    { "type": "move_channel", "channelName": "existing channel", "parentName": "optional category", "position": 0 },',
    '    { "type": "rename_channel", "channelName": "old-channel", "newName": "new-channel" },',
    '    { "type": "update_channel_settings", "channelName": "existing text channel", "topic": "optional topic", "nsfw": false, "slowmodeSeconds": 30, "defaultAutoArchiveDuration": 1440, "parentName": "optional category" },',
    '    { "type": "list_roles" },',
    '    { "type": "list_channels", "channelKind": "all|text|announcement|voice|thread|category" },',
    '    { "type": "list_members", "roleName": "optional role", "query": "optional search text", "limit": 20 },',
    '    { "type": "list_invites" },',
    '    { "type": "create_invite", "channelName": "existing channel", "maxAgeSeconds": 3600, "maxUses": 0, "temporary": false, "unique": true },',
    '    { "type": "delete_invite", "code": "abc123" },',
    '    { "type": "replace_invite", "code": "abc123", "channelName": "existing channel", "maxAgeSeconds": 3600, "maxUses": 0, "temporary": false, "unique": true },',
    '    { "type": "set_channel_slowmode", "channelName": "existing text channel", "slowmodeSeconds": 30 },',
    '    { "type": "archive_thread", "channelName": "existing thread", "locked": true },',
    '    { "type": "lock_thread", "channelName": "existing thread", "archived": true },',
    '    { "type": "set_welcome_channel", "channelName": "welcome" },',
    '    { "type": "set_welcome_message", "message": "Welcome {user} to **{server}**!", "enable": true },',
    '    { "type": "set_member_counter", "channelName": "Members: 0", "template": "Members: {count}" },',
    '    { "type": "set_chat_mode", "channelName": "__CURRENT_CHANNEL__", "enabled": true, "requireMentionOrReply": true, "cooldownSeconds": 30, "allowedRoleNames": ["Moderator"], "allowedUsers": [], "systemPrompt": "Short helpful replies only." },',
    '    { "type": "explain_channel_permissions", "channelName": "__CURRENT_CHANNEL__", "subject": "bot|role|user", "roleName": "optional role", "targetUser": "optional user" }',
    "  ]",
    "}",
    `Server: ${input.guildName}`,
    `Current channel: ${input.currentChannelName ?? "none"}`,
    "Existing roles:",
    roleLines || "- none",
    "Existing categories:",
    categoryLines || "- none",
    "Existing accessible channels:",
    channelLines || "- none",
    `User request: ${input.requestText}`
  ].join("\n");
}

export function describeSelfTaskAction(action: SelfTaskAction): string {
  if (action.type === "create_channel") {
    return `Create ${action.channelType} channel \`${action.name}\`${action.parentName ? ` in ${action.parentName}` : ""}`;
  }

  if (action.type === "send_message") {
    return `Send message to \`${action.channelName}\``;
  }

  if (action.type === "create_thread") {
    return `Create thread \`${action.name}\` in \`${action.channelName}\``;
  }

  if (action.type === "create_post") {
    return `Create post in \`${action.channelName}\`${action.title ? ` with title \`${action.title}\`` : ""}`;
  }

  if (action.type === "create_role") {
    return `Create role \`${action.name}\`${action.permissions.length > 0 ? ` with ${action.permissions.join(", ")}` : ""}`;
  }

  if (action.type === "set_channel_role_permissions") {
    return `Set role access for \`${action.roleName}\` in \`${action.channelName}\``;
  }

  if (action.type === "rename_role") {
    return `Rename role \`${action.roleName}\` to \`${action.newName}\``;
  }

  if (action.type === "assign_roles") {
    return `Assign roles ${action.roleNames.map(name => `\`${name}\``).join(", ")} to \`${action.targetUser}\``;
  }

  if (action.type === "assign_role") {
    return `Assign \`${action.roleName}\` to \`${action.targetUser}\``;
  }

  if (action.type === "remove_roles") {
    return `Remove roles ${action.roleNames.map(name => `\`${name}\``).join(", ")} from \`${action.targetUser}\``;
  }

  if (action.type === "remove_role") {
    return `Remove \`${action.roleName}\` from \`${action.targetUser}\``;
  }

  if (action.type === "move_channel") {
    return `Move channel \`${action.channelName}\`${action.parentName ? ` to ${action.parentName}` : ""}`;
  }

  if (action.type === "rename_channel") {
    return `Rename channel \`${action.channelName}\` to \`${action.newName}\``;
  }

  if (action.type === "update_channel_settings") {
    return `Update settings for \`${action.channelName}\``;
  }

  if (action.type === "list_roles") {
    return "List current server roles";
  }

  if (action.type === "list_channels") {
    return `List current server channels${action.channelKind && action.channelKind !== "all" ? ` (${action.channelKind})` : ""}`;
  }

  if (action.type === "list_members") {
    return `List members${action.roleName ? ` with role \`${action.roleName}\`` : ""}${action.query ? ` matching \`${action.query}\`` : ""}`;
  }

  if (action.type === "list_invites") {
    return "List current server invites";
  }

  if (action.type === "create_invite") {
    return `Create invite for \`${action.channelName}\``;
  }

  if (action.type === "delete_invite") {
    return `Delete invite \`${action.code}\``;
  }

  if (action.type === "replace_invite") {
    return `Replace invite \`${action.code}\` for \`${action.channelName}\``;
  }

  if (action.type === "set_channel_slowmode") {
    return `Set slowmode in \`${action.channelName}\` to ${action.slowmodeSeconds}s`;
  }

  if (action.type === "archive_thread") {
    return `Archive thread \`${action.channelName}\`${action.locked ? " and lock it" : ""}`;
  }

  if (action.type === "lock_thread") {
    return `Lock thread \`${action.channelName}\`${action.archived ? " and archive it" : ""}`;
  }

  if (action.type === "set_welcome_channel") {
    return `Set welcome channel to \`${action.channelName}\``;
  }

  if (action.type === "set_welcome_message") {
    return `Set welcome message${action.enable === false ? " without enabling it" : ""}`;
  }

  if (action.type === "set_member_counter") {
    return `Set member counter to \`${action.channelName}\`${action.template ? ` using template \`${action.template}\`` : ""}`;
  }

  if (action.type === "set_chat_mode") {
    return `${action.enabled ? "Enable" : "Disable"} chat mode for \`${action.channelName}\``;
  }

  if (action.type === "explain_channel_permissions") {
    return `Explain ${action.subject} permissions in \`${action.channelName}\``;
  }

  return `Edit recent bot message in \`${action.channelName}\` matching \`${action.matchText}\``;
}

export interface ChatSelfTaskIntent {
  shouldUseSelfTask: boolean;
  confidence: number;
  requestText: string;
  reason: string;
}

export function parseChatSelfTaskIntent(raw: string): ChatSelfTaskIntent {
  const normalized = stripCodeFences(raw);
  const parsed = JSON.parse(normalized) as Record<string, unknown>;
  return {
    shouldUseSelfTask: parsed.shouldUseSelfTask === true,
    confidence: typeof parsed.confidence === "number"
      ? Math.min(1, Math.max(0, parsed.confidence))
      : 0,
    requestText: sanitizeText(parsed.requestText, 500),
    reason: sanitizeText(parsed.reason, 300) || "No reason provided."
  };
}

export function buildChatSelfTaskIntentPrompt(input: {
  guildName: string;
  channelName: string;
  authorTag: string;
  authorContext?: string | null;
  messageContent: string;
  repliedContent?: string | null;
  allowedActionTypes: string[];
}): string {
  return [
    "You are LazyDev deciding whether a Discord message is actually a server-management request that should use self_task handling.",
    "Return strict JSON only.",
    "{",
    '  "shouldUseSelfTask": true,',
    '  "confidence": 0.0,',
    '  "requestText": "cleaned task request for the planner",',
    '  "reason": "short reason"',
    "}",
    "Only set shouldUseSelfTask to true when the message is clearly asking the bot to make a server change or perform an operational bot action.",
    "Examples: create channel, create role, update permissions, post a message somewhere, create a thread, edit a bot message, list roles/channels/members/invites, create or replace an invite, change slowmode, archive or lock a thread, set the welcome channel or welcome message, configure chat mode, explain channel permissions, or set the member counter channel.",
    "Do not trigger self_task for normal conversation, brainstorming, opinions, questions, or vague discussion.",
    `Allowed action types for this server: ${input.allowedActionTypes.join(", ") || "none"}.`,
    `Server: ${input.guildName}`,
    `Channel: #${input.channelName}`,
    `Member: ${input.authorTag}`,
    input.authorContext ? `Member context: ${input.authorContext}` : null,
    input.repliedContent ? `Replied bot message: ${input.repliedContent}` : null,
    `Incoming message: ${input.messageContent}`
  ].filter(Boolean).join("\n");
}
