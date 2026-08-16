import type { Client } from "discord.js";

type AutonomousHeartbeatServiceDependencies = {
  client: Client;
  getGuildSettings: (guildId: string) => Promise<{
    autonomousHeartbeatMinutes: number;
    autonomousStatusChannelId: string | null;
    botSafetySuggestOnly: boolean;
    botSafetyAllowChannelSuggestions: boolean;
    botSafetyAllowPromotionSuggestions: boolean;
  }>;
  getHeartbeatDueGuildIds: (entries: Array<{ guildId: string; settings: any }>) => string[];
  shouldPostAutonomousHeartbeatForSignals: (input: {
    settings: any;
    signalCount: number;
  }) => boolean;
  canSendMessages: (channel: unknown) => boolean;
  sendChunkedToTarget: (target: any, content: string) => Promise<void>;
  getGuildPermissionSummary: (guildId: string) => Promise<{ missingCriticalPermissions: string[] }>;
  getRecentGuildSignals: (guildId: string, lookbackMs: number) => Array<{ summary: string }>;
  recordAction: (type: string, summary: string) => void;
};

type AutonomousHeartbeatService = {
  runAutonomousHeartbeatPass: () => Promise<void>;
};

export function createAutonomousHeartbeatService(dependencies: AutonomousHeartbeatServiceDependencies): AutonomousHeartbeatService {
  async function runAutonomousHeartbeatPass(): Promise<void> {
    const entries = await Promise.all([...dependencies.client.guilds.cache.values()].map(async guild => ({ guild, settings: await dependencies.getGuildSettings(guild.id) })));
    const dueGuildIds = new Set(dependencies.getHeartbeatDueGuildIds(entries.map(entry => ({ guildId: entry.guild.id, settings: entry.settings }))));
    for (const entry of entries) {
      if (!dueGuildIds.has(entry.guild.id)) {
        continue;
      }
      const lookbackMs = Math.max(1, entry.settings.autonomousHeartbeatMinutes) * 60_000;
      const recentSignals = dependencies.getRecentGuildSignals(entry.guild.id, lookbackMs);
      if (!dependencies.shouldPostAutonomousHeartbeatForSignals({ settings: entry.settings, signalCount: recentSignals.length })) {
        continue;
      }
      const statusChannelId = entry.settings.autonomousStatusChannelId;
      if (!statusChannelId) {
        continue;
      }
      const targetChannel = await dependencies.client.channels.fetch(statusChannelId).catch(() => null);
      if (!targetChannel?.isTextBased() || !dependencies.canSendMessages(targetChannel)) {
        continue;
      }
      const summary = await dependencies.getGuildPermissionSummary(entry.guild.id).catch(() => null);
      const heartbeatLines = [
        "## Discrod autonomous heartbeat",
        `Server: **${entry.guild.name}**`,
        `Members: **${entry.guild.memberCount}**`,
        summary ? `Critical bot permissions: **${summary.missingCriticalPermissions.length === 0 ? "good" : `missing ${summary.missingCriticalPermissions.join(", ")}`}**` : "Critical bot permissions: **unknown**",
        `Recent cached events: **${recentSignals.length}**`,
        recentSignals.length > 0 ? `Latest signal: ${recentSignals[0]?.summary ?? "unknown"}` : "Latest signal: none",
        entry.settings.botSafetySuggestOnly ? "Safety mode: **suggest-only**" : "Safety mode: **active suggestions**",
        entry.settings.botSafetyAllowChannelSuggestions ? "Channel suggestions are enabled." : "Channel suggestions are disabled.",
        entry.settings.botSafetyAllowPromotionSuggestions ? "Promotion suggestions are enabled." : "Promotion suggestions are disabled."
      ];
      await dependencies.sendChunkedToTarget(targetChannel, heartbeatLines.join("\n"));
      dependencies.recordAction("autonomous-heartbeat", `Posted autonomous heartbeat for ${entry.guild.name}.`);
    }
  }

  return {
    runAutonomousHeartbeatPass
  };
}
