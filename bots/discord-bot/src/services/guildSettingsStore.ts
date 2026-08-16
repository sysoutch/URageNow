import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { appConfig } from "@urage/server/config/appConfig";

export interface GuildSettings {
  guildId: string;
  welcomeEnabled: boolean;
  welcomeChannelId: string | null;
  welcomeMessage: string;
  investigationRoleId: string | null;
  temporaryImageBlockRoleId: string | null;
  memberCounterChannelId: string | null;
  memberCounterTemplate: string;
  botMode: "normal" | "act-on-user-behalf" | "act-on-itself";
  botActingPreset: "user" | "mod" | "admin";
  botSafetyRequireMentionOrReply: boolean;
  botSafetySuggestOnly: boolean;
  botSafetyAllowChatSelfTasks: boolean;
  botSafetyChatSelfTasksAdminOnly: boolean;
  botSafetyChatSelfTaskMinConfidence: number;
  botSafetyAllowRoleSuggestions: boolean;
  botSafetyAllowChannelSuggestions: boolean;
  botSafetyAllowPromotionSuggestions: boolean;
  autonomousStatusChannelId: string | null;
  autonomousHeartbeatEnabled: boolean;
  autonomousHeartbeatMinutes: number;
  autonomousReplyToMentions: boolean;
  imagePoolVerifiedRoleIds: string[];
  imagePoolVerifiedUserIds: string[];
  selfTaskDryRunOnly: boolean;
  selfTaskAllowedActionTypes: string[];
  mediaReactionRules: GuildMediaReactionRule[];
  chatModeChannels: Record<string, ChatModeChannelSettings>;
}

export interface GuildMediaReactionRule {
  enabled: boolean;
  sourceChannelId: string;
  resultChannelId: string;
  allowedRoleIds: string[];
  allowedUserIds: string[];
  imageActions: string[];
  modelActions: string[];
}

export interface ChatModeChannelSettings {
  enabled: boolean;
  allowedRoleIds: string[];
  allowedUserIds: string[];
  requireMentionOrReply: boolean;
  cooldownSeconds: number;
  systemPrompt: string;
}

interface StoredGuildSettings {
  guilds: Record<string, GuildSettings>;
}

const dataDirectory = path.resolve(appConfig.dataDirectory);
const storePath = path.join(dataDirectory, "guild-settings.json");
let guildSettingsMutationQueue: Promise<unknown> = Promise.resolve();

const defaultWelcomeMessage = "Welcome {user} to **{server}**.";

function defaultSettings(guildId: string): GuildSettings {
  return {
    guildId,
    welcomeEnabled: false,
    welcomeChannelId: null,
    welcomeMessage: defaultWelcomeMessage,
    investigationRoleId: null,
    temporaryImageBlockRoleId: null,
    memberCounterChannelId: null,
    memberCounterTemplate: "Members: {count}",
    botMode: "normal",
    botActingPreset: "user",
    botSafetyRequireMentionOrReply: true,
    botSafetySuggestOnly: true,
    botSafetyAllowChatSelfTasks: false,
    botSafetyChatSelfTasksAdminOnly: true,
    botSafetyChatSelfTaskMinConfidence: 85,
    botSafetyAllowRoleSuggestions: false,
    botSafetyAllowChannelSuggestions: false,
    botSafetyAllowPromotionSuggestions: false,
    autonomousStatusChannelId: null,
    autonomousHeartbeatEnabled: false,
    autonomousHeartbeatMinutes: 30,
    autonomousReplyToMentions: true,
    imagePoolVerifiedRoleIds: [],
    imagePoolVerifiedUserIds: [],
    selfTaskDryRunOnly: false,
    selfTaskAllowedActionTypes: [
      "create_channel",
      "send_message",
      "create_thread",
      "create_post",
      "edit_bot_message",
      "create_role",
      "set_channel_role_permissions",
      "rename_role",
      "assign_roles",
      "assign_role",
      "remove_roles",
      "remove_role",
      "move_channel",
      "rename_channel",
      "update_channel_settings",
      "list_roles",
      "list_channels",
      "list_members",
      "list_invites",
      "create_invite",
      "delete_invite",
      "replace_invite",
      "set_channel_slowmode",
      "archive_thread",
      "lock_thread",
      "set_welcome_channel",
      "set_welcome_message",
      "set_member_counter"
    ],
    mediaReactionRules: [],
    chatModeChannels: {}
  };
}

function sanitizeIdList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value
    .filter((entry): entry is string => typeof entry === "string")
    .map(entry => entry.trim())
    .filter(Boolean))];
}

function sanitizeChatModeChannelSettings(input: unknown): ChatModeChannelSettings {
  const value = typeof input === "object" && input !== null ? input as Partial<ChatModeChannelSettings> : {};
  return {
    enabled: value.enabled === true,
    allowedRoleIds: sanitizeIdList(value.allowedRoleIds),
    allowedUserIds: sanitizeIdList(value.allowedUserIds),
    requireMentionOrReply: value.requireMentionOrReply !== false,
    cooldownSeconds: typeof value.cooldownSeconds === "number" && value.cooldownSeconds >= 0
      ? Math.min(3600, Math.round(value.cooldownSeconds))
      : 30,
    systemPrompt: typeof value.systemPrompt === "string" ? value.systemPrompt.trim() : ""
  };
}

function sanitizeMediaReactionRules(value: unknown): GuildMediaReactionRule[] {
  if (!Array.isArray(value)) return [];
  return value.map(entry => {
    const raw = typeof entry === "object" && entry !== null ? entry as Partial<GuildMediaReactionRule> : {};
    return {
      enabled: raw.enabled !== false,
      sourceChannelId: typeof raw.sourceChannelId === "string" ? raw.sourceChannelId.trim() : "",
      resultChannelId: typeof raw.resultChannelId === "string" ? raw.resultChannelId.trim() : "",
      allowedRoleIds: sanitizeIdList(raw.allowedRoleIds),
      allowedUserIds: sanitizeIdList(raw.allowedUserIds),
      imageActions: sanitizeIdList(raw.imageActions).filter(action => ["generate-3d-model", "create-pixel-art", "remove-background", "delight-image"].includes(action)),
      modelActions: sanitizeIdList(raw.modelActions).filter(action => ["generate-lowpoly", "generate-highpoly", "auto-rig", "generate-preview-gif"].includes(action))
    };
  }).filter(rule => rule.sourceChannelId && rule.resultChannelId);
}

function sanitizeChatModeChannels(input: unknown): Record<string, ChatModeChannelSettings> {
  if (typeof input !== "object" || input === null) {
    return {};
  }

  const result: Record<string, ChatModeChannelSettings> = {};
  for (const [channelId, settings] of Object.entries(input as Record<string, unknown>)) {
    const trimmedChannelId = channelId.trim();
    if (!trimmedChannelId) {
      continue;
    }

    result[trimmedChannelId] = sanitizeChatModeChannelSettings(settings);
  }
  return result;
}

function sanitizeSelfTaskAllowedActionTypes(input: unknown, fallback: string[]): string[] {
  const filtered = sanitizeIdList(input).filter(actionType =>
    actionType === "create_channel"
    || actionType === "send_message"
    || actionType === "create_thread"
    || actionType === "create_post"
    || actionType === "edit_bot_message"
    || actionType === "create_role"
    || actionType === "set_channel_role_permissions"
    || actionType === "rename_role"
    || actionType === "assign_roles"
    || actionType === "assign_role"
    || actionType === "remove_roles"
    || actionType === "remove_role"
    || actionType === "move_channel"
    || actionType === "rename_channel"
    || actionType === "update_channel_settings"
    || actionType === "list_roles"
    || actionType === "list_channels"
    || actionType === "list_members"
    || actionType === "list_invites"
    || actionType === "create_invite"
    || actionType === "delete_invite"
    || actionType === "replace_invite"
    || actionType === "set_channel_slowmode"
    || actionType === "archive_thread"
    || actionType === "lock_thread"
    || actionType === "set_welcome_channel"
    || actionType === "set_welcome_message"
    || actionType === "set_member_counter"
    || actionType === "set_chat_mode"
    || actionType === "explain_channel_permissions"
  );

  return filtered.length > 0 ? filtered : [...fallback];
}

function sanitizeGuildSettings(guildId: string, input: Partial<GuildSettings>): GuildSettings {
  const defaults = defaultSettings(guildId);
  const merged = {
    ...defaults,
    ...input,
    guildId
  };

  return {
    ...merged,
    botMode: merged.botMode === "act-on-user-behalf" || merged.botMode === "act-on-itself"
      ? merged.botMode
      : "normal",
    botActingPreset: merged.botActingPreset === "mod" || merged.botActingPreset === "admin"
      ? merged.botActingPreset
      : "user",
    botSafetyRequireMentionOrReply: merged.botSafetyRequireMentionOrReply !== false,
    botSafetySuggestOnly: merged.botSafetySuggestOnly !== false,
    botSafetyAllowChatSelfTasks: merged.botSafetyAllowChatSelfTasks === true,
    botSafetyChatSelfTasksAdminOnly: merged.botSafetyChatSelfTasksAdminOnly !== false,
    botSafetyChatSelfTaskMinConfidence: typeof merged.botSafetyChatSelfTaskMinConfidence === "number"
      ? Math.min(100, Math.max(0, Math.round(merged.botSafetyChatSelfTaskMinConfidence)))
      : 85,
    botSafetyAllowRoleSuggestions: merged.botSafetyAllowRoleSuggestions === true,
    botSafetyAllowChannelSuggestions: merged.botSafetyAllowChannelSuggestions === true,
    botSafetyAllowPromotionSuggestions: merged.botSafetyAllowPromotionSuggestions === true,
    autonomousStatusChannelId: typeof merged.autonomousStatusChannelId === "string" && merged.autonomousStatusChannelId.trim().length > 0
      ? merged.autonomousStatusChannelId.trim()
      : null,
    autonomousHeartbeatEnabled: merged.autonomousHeartbeatEnabled === true,
    autonomousHeartbeatMinutes: typeof merged.autonomousHeartbeatMinutes === "number" && merged.autonomousHeartbeatMinutes > 0
      ? Math.min(24 * 60, Math.round(merged.autonomousHeartbeatMinutes))
      : 30,
    autonomousReplyToMentions: merged.autonomousReplyToMentions !== false,
    imagePoolVerifiedRoleIds: sanitizeIdList(merged.imagePoolVerifiedRoleIds),
    imagePoolVerifiedUserIds: sanitizeIdList(merged.imagePoolVerifiedUserIds),
    selfTaskDryRunOnly: merged.selfTaskDryRunOnly === true,
    selfTaskAllowedActionTypes: sanitizeSelfTaskAllowedActionTypes(
      merged.selfTaskAllowedActionTypes,
      defaults.selfTaskAllowedActionTypes
    ),
    mediaReactionRules: sanitizeMediaReactionRules(merged.mediaReactionRules),
    chatModeChannels: sanitizeChatModeChannels(merged.chatModeChannels)
  };
}

async function ensureStoreFile(): Promise<void> {
  await mkdir(dataDirectory, { recursive: true });

  try {
    await readFile(storePath, "utf8");
  } catch {
    const initial: StoredGuildSettings = { guilds: {} };
    await writeFile(storePath, JSON.stringify(initial, null, 2), "utf8");
  }
}

async function readStore(): Promise<StoredGuildSettings> {
  await ensureStoreFile();
  const raw = await readFile(storePath, "utf8");
  const parsed = JSON.parse(raw) as Partial<StoredGuildSettings>;
  return {
    guilds: parsed.guilds ?? {}
  };
}

async function writeStore(store: StoredGuildSettings): Promise<void> {
  await ensureStoreFile();
  await writeFile(storePath, JSON.stringify(store, null, 2), "utf8");
}

export async function getGuildSettings(guildId: string): Promise<GuildSettings> {
  const store = await readStore();
  const next = sanitizeGuildSettings(guildId, store.guilds[guildId] ?? {});
  const previousRaw = JSON.stringify(store.guilds[guildId] ?? {});
  const nextRaw = JSON.stringify(next);
  if (previousRaw !== nextRaw) {
    store.guilds[guildId] = next;
    await writeStore(store);
  }
  return next;
}

export async function updateGuildSettings(
  guildId: string,
  update: Partial<Omit<GuildSettings, "guildId">>
): Promise<GuildSettings> {
  const task = guildSettingsMutationQueue.then(async () => {
    const store = await readStore();
    const next = sanitizeGuildSettings(guildId, {
      ...(store.guilds[guildId] ?? {}),
      ...update
    });

    store.guilds[guildId] = next;
    await writeStore(store);
    return next;
  });

  guildSettingsMutationQueue = task.catch(() => undefined);
  return task;
}

export function renderWelcomeMessage(
  template: string,
  input: {
    userMention: string;
    username: string;
    serverName: string;
  }
): string {
  return template
    .replaceAll("{user}", input.userMention)
    .replaceAll("{username}", input.username)
    .replaceAll("{server}", input.serverName);
}

export function renderMemberCounterName(template: string, count: number): string {
  return template.replaceAll("{count}", String(count));
}
