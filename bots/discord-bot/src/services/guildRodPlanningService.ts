import { ChannelType, type Client } from "discord.js";
import type { DashboardGuildChannelPlan } from "@urage/shared/dashboard/types";

type GuildRodPlanningServiceDependencies = {
  client: Client;
  askText: (prompt: string, systemPrompt?: boolean) => Promise<string>;
  listChannels: (guildId: string) => Promise<Array<{ name: string; parentName: string | null; isVoice: boolean }>>;
  listRoles: (guildId: string) => Promise<Array<{ name: string; colorHex: string | null }>>;
};

type GuildRodPlanningService = {
  extractJsonObject: (content: string) => string;
  normalizeGuildChannelPlan: (input: unknown) => DashboardGuildChannelPlan;
  buildGuildSummaryForAi: (guildId: string) => Promise<string>;
  planGuildChannelsWithRod: (guildId: string, prompt: string) => Promise<DashboardGuildChannelPlan>;
  applyGuildChannelPlan: (guildId: string, plan: DashboardGuildChannelPlan) => Promise<{ createdCategories: number; createdChannels: number }>;
  auditGuildWithRod: (guildId: string, prompt: string) => Promise<string>;
};

function normalizePlannedChannelType(value: unknown): "text" | "voice" | "announcement" {
  if (value === "voice" || value === "announcement") {
    return value;
  }
  return "text";
}

function extractJsonObject(content: string): string {
  const trimmed = content.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Rod did not return a JSON object.");
  }
  return trimmed.slice(start, end + 1);
}

function normalizeGuildChannelPlan(input: unknown): DashboardGuildChannelPlan {
  const parsed = input as { summary?: unknown; entries?: unknown };
  const entries = Array.isArray(parsed.entries) ? parsed.entries : [];
  return {
    summary: typeof parsed.summary === "string" && parsed.summary.trim().length > 0 ? parsed.summary.trim() : "Rod prepared a channel plan.",
    entries: entries
      .map(entry => {
        const record = entry as { categoryName?: unknown; channels?: unknown };
        const categoryName = typeof record.categoryName === "string" ? record.categoryName.trim() : "";
        const channels = Array.isArray(record.channels) ? record.channels : [];
        if (!categoryName || channels.length === 0) {
          return null;
        }
        return {
          categoryName,
          channels: channels
            .map(channel => {
              const channelRecord = channel as { name?: unknown; type?: unknown; topic?: unknown };
              const name = typeof channelRecord.name === "string" ? channelRecord.name.trim() : "";
              if (!name) {
                return null;
              }
              const topic = typeof channelRecord.topic === "string" && channelRecord.topic.trim().length > 0 ? channelRecord.topic.trim() : null;
              return {
                name,
                type: normalizePlannedChannelType(channelRecord.type),
                topic
              };
            })
            .filter((channel): channel is { name: string; type: "text" | "voice" | "announcement"; topic: string | null } => channel !== null)
        };
      })
      .filter((entry): entry is DashboardGuildChannelPlan["entries"][number] => entry !== null && entry.channels.length > 0)
  };
}

function resolveGuild(client: Client, guildId: string) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) {
    throw new Error("Guild not found.");
  }
  return guild;
}

export function createGuildRodPlanningService(dependencies: GuildRodPlanningServiceDependencies): GuildRodPlanningService {
  async function buildGuildSummaryForAi(guildId: string): Promise<string> {
    const guild = resolveGuild(dependencies.client, guildId);
    const channels = await dependencies.listChannels(guildId);
    const roles = await dependencies.listRoles(guildId);
    const categories = new Map<string, string[]>();
    for (const channel of channels) {
      const key = channel.parentName ?? "Uncategorized";
      const line = `${channel.isVoice ? "voice" : "text"}:${channel.name}`;
      const existing = categories.get(key) ?? [];
      existing.push(line);
      categories.set(key, existing);
    }
    const categorySummary = [...categories.entries()].map(([name, items]) => `${name}: ${items.join(", ")}`).join("\n");
    const roleSummary = roles.slice(0, 20).map(role => role.colorHex ? `${role.name} (${role.colorHex})` : role.name).join(", ");
    return [
      `Guild: ${guild.name}`,
      `Roles: ${roleSummary || "none"}`,
      "Channels:",
      categorySummary || "none"
    ].join("\n");
  }

  async function planGuildChannelsWithRod(guildId: string, prompt: string): Promise<DashboardGuildChannelPlan> {
    const guildSummary = await buildGuildSummaryForAi(guildId);
    const raw = await dependencies.askText([
      "You are a Discord server architect.",
      "Return JSON only.",
      "Make a practical channel layout plan for the selected server.",
      "Use exactly this shape:",
      '{"summary":"short summary","entries":[{"categoryName":"Category","channels":[{"name":"channel-name","type":"text","topic":"optional topic"}]}]}',
      "Allowed channel types: text, voice, announcement.",
      "Keep channel names lowercase with hyphens.",
      "Prefer 2 to 6 categories and avoid duplicates.",
      "Base the plan on this guild summary:",
      guildSummary,
      "User request:",
      prompt
    ].join("\n"), false);
    return normalizeGuildChannelPlan(JSON.parse(extractJsonObject(raw)));
  }

  async function applyGuildChannelPlan(guildId: string, plan: DashboardGuildChannelPlan): Promise<{ createdCategories: number; createdChannels: number }> {
    const guild = resolveGuild(dependencies.client, guildId);
    const existingChannels = guild.channels.cache.size > 0 ? guild.channels.cache : await guild.channels.fetch();
    const categoriesByName = new Map<string, string>();
    for (const channel of existingChannels.values()) {
      if (channel?.type === ChannelType.GuildCategory && "name" in channel && typeof channel.name === "string") {
        categoriesByName.set(channel.name.toLowerCase(), channel.id);
      }
    }
    let createdCategories = 0;
    let createdChannels = 0;
    for (const entry of plan.entries) {
      const categoryKey = entry.categoryName.toLowerCase();
      let parentId = categoriesByName.get(categoryKey) ?? null;
      if (!parentId) {
        const createdCategory = await guild.channels.create({ name: entry.categoryName, type: ChannelType.GuildCategory, reason: "Created from LazyDev guild channel plan" });
        parentId = createdCategory.id;
        categoriesByName.set(categoryKey, createdCategory.id);
        createdCategories += 1;
      }
      for (const channel of entry.channels) {
        const duplicate = [...guild.channels.cache.values()].find(existing =>
          existing
          && "name" in existing
          && typeof existing.name === "string"
          && existing.name.toLowerCase() === channel.name.toLowerCase()
          && "parentId" in existing
          && existing.parentId === parentId
        );
        if (duplicate) {
          continue;
        }
        const type = channel.type === "voice" ? ChannelType.GuildVoice : channel.type === "announcement" ? ChannelType.GuildAnnouncement : ChannelType.GuildText;
        await guild.channels.create({
          name: channel.name,
          type,
          parent: parentId,
          topic: type === ChannelType.GuildText || type === ChannelType.GuildAnnouncement ? channel.topic ?? undefined : undefined,
          reason: "Created from LazyDev guild channel plan"
        });
        createdChannels += 1;
      }
    }
    return { createdCategories, createdChannels };
  }

  async function auditGuildWithRod(guildId: string, prompt: string): Promise<string> {
    const guildSummary = await buildGuildSummaryForAi(guildId);
    return dependencies.askText([
      "You are a Discord moderation and structure reviewer.",
      "Review the guild summary and give concise, practical suggestions.",
      "Focus on permission risks, missing channel structure, moderation gaps, onboarding, and naming consistency.",
      "Keep it short and action-oriented.",
      "Guild summary:",
      guildSummary,
      "Extra user context:",
      prompt || "General audit"
    ].join("\n"), false);
  }

  return {
    extractJsonObject,
    normalizeGuildChannelPlan,
    buildGuildSummaryForAi,
    planGuildChannelsWithRod,
    applyGuildChannelPlan,
    auditGuildWithRod
  };
}
