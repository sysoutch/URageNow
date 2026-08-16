import { ChannelType, Colors, EmbedBuilder, type ChatInputCommandInteraction, type Client } from "discord.js";
import type { PendingSelfTaskBatch, SelfTaskAction } from "../../selfTaskService.js";
import { describeChannelKind } from "../../discordRuntimeHelpers.js";

type SelfTaskPlanningServiceDependencies = {
  client: Client;
  getGuildSettings: (guildId: string) => Promise<{
    selfTaskAllowedActionTypes: string[];
    selfTaskDryRunOnly: boolean;
  }>;
  askText: (prompt: string) => Promise<string>;
  buildSelfTaskPlannerPrompt: (input: {
    guildName: string;
    currentChannelName: string | null;
    requestText: string;
    allowedActionTypes: string[];
    dryRunOnly: boolean;
    roles: string[];
    categories: string[];
    channels: Array<{ name: string; kind: string; parentName: string | null }>;
  }) => string;
  parsePlannedSelfTaskBatch: (raw: string) => { summary: string; actions: SelfTaskAction[] };
  describeSelfTaskAction: (action: SelfTaskAction) => string;
  recordSelfTaskReview: (input: {
    guildId: string;
    requestedByTag: string;
    requestText: string;
    summary: string;
    actionDescriptions: string[];
  }) => { id: string };
  createRuntimeId: () => string;
};

type SelfTaskPlanningService = {
  buildSelfTaskEmbed: (batch: PendingSelfTaskBatch) => EmbedBuilder;
  buildPendingSelfTaskBatchForRequest: (input: {
    guildId: string;
    currentChannelId: string | null;
    requestedByUserId: string;
    requestedByTag: string;
    requestText: string;
  }) => Promise<PendingSelfTaskBatch & { reviewId: string }>;
  buildPendingSelfTaskBatch: (
    interaction: ChatInputCommandInteraction,
    requestText: string
  ) => Promise<PendingSelfTaskBatch & { reviewId: string }>;
};

export function createSelfTaskPlanningService(dependencies: SelfTaskPlanningServiceDependencies): SelfTaskPlanningService {
  function buildSelfTaskEmbed(batch: PendingSelfTaskBatch): EmbedBuilder {
    const allowedSummary = batch.allowedActionTypes.length > 0 ? batch.allowedActionTypes.map(actionType => `\`${actionType}\``).join(", ") : "No actions allowed";
    return new EmbedBuilder()
      .setColor(Colors.Blurple)
      .setTitle("Rod Self Task Plan")
      .setDescription(batch.summary)
      .addFields(
        {
          name: "Request",
          value: batch.requestText.length > 900 ? `${batch.requestText.slice(0, 897)}...` : batch.requestText
        },
        {
          name: "Planned actions",
          value: batch.actions.length > 0
            ? batch.actions.map((action, index) => `${index + 1}. ${dependencies.describeSelfTaskAction(action)}`).join("\n")
            : "No safe action was planned."
        },
        {
          name: "Server safety",
          value: [
            `Dry run only: ${batch.dryRunOnly ? "yes" : "no"}`,
            `Allowed actions: ${allowedSummary}`
          ].join("\n")
        }
      )
      .setFooter({ text: `Requested by ${batch.requestedByTag}` });
  }

  async function buildPendingSelfTaskBatchForRequest(input: {
    guildId: string;
    currentChannelId: string | null;
    requestedByUserId: string;
    requestedByTag: string;
    requestText: string;
  }): Promise<PendingSelfTaskBatch & { reviewId: string }> {
    const guild = dependencies.client.guilds.cache.get(input.guildId);
    if (!guild) {
      throw new Error("Guild not found.");
    }
    const guildSettings = await dependencies.getGuildSettings(input.guildId);
    const channels = guild.channels.cache.size > 0 ? [...guild.channels.cache.values()] : [...(await guild.channels.fetch()).values()].filter(Boolean);
    const plannerPrompt = dependencies.buildSelfTaskPlannerPrompt({
      guildName: guild.name,
      currentChannelName: input.currentChannelId && guild.channels.cache.get(input.currentChannelId) && "name" in guild.channels.cache.get(input.currentChannelId)!
        && typeof guild.channels.cache.get(input.currentChannelId)?.name === "string"
        ? guild.channels.cache.get(input.currentChannelId)?.name ?? null
        : null,
      requestText: input.requestText,
      allowedActionTypes: guildSettings.selfTaskAllowedActionTypes,
      dryRunOnly: guildSettings.selfTaskDryRunOnly,
      roles: [...guild.roles.cache.values()].map(role => role.name),
      categories: channels
        .filter(channel => channel?.type === ChannelType.GuildCategory)
        .map(channel => ("name" in channel && typeof channel.name === "string" ? channel.name : channel.id)),
      channels: channels
        .filter((channel): channel is Exclude<typeof channel, null | undefined> => !!channel)
        .filter(channel => channel.type !== ChannelType.GuildCategory)
        .map(channel => ({
          name: "name" in channel && typeof channel.name === "string" ? channel.name : channel.id,
          kind: describeChannelKind(channel.type),
          parentName: "parent" in channel ? channel.parent?.name ?? null : null
        }))
    });
    const rawPlan = await dependencies.askText(plannerPrompt);
    const plan = dependencies.parsePlannedSelfTaskBatch(rawPlan);
    const actionDescriptions = plan.actions.map(dependencies.describeSelfTaskAction);
    const review = dependencies.recordSelfTaskReview({
      guildId: input.guildId,
      requestedByTag: input.requestedByTag,
      requestText: input.requestText,
      summary: plan.summary,
      actionDescriptions
    });
    return {
      id: dependencies.createRuntimeId(),
      reviewId: review.id,
      guildId: input.guildId,
      currentChannelId: input.currentChannelId,
      requestedByUserId: input.requestedByUserId,
      requestedByTag: input.requestedByTag,
      requestText: input.requestText,
      createdAt: new Date().toISOString(),
      summary: plan.summary,
      actions: plan.actions,
      allowedActionTypes: [...guildSettings.selfTaskAllowedActionTypes],
      dryRunOnly: guildSettings.selfTaskDryRunOnly
    };
  }

  async function buildPendingSelfTaskBatch(interaction: ChatInputCommandInteraction, requestText: string): Promise<PendingSelfTaskBatch & { reviewId: string }> {
    if (!interaction.guildId) {
      throw new Error("This command only works inside a server.");
    }
    return buildPendingSelfTaskBatchForRequest({
      guildId: interaction.guildId,
      currentChannelId: interaction.channelId,
      requestedByUserId: interaction.user.id,
      requestedByTag: interaction.user.tag,
      requestText
    });
  }

  return {
    buildSelfTaskEmbed,
    buildPendingSelfTaskBatchForRequest,
    buildPendingSelfTaskBatch
  };
}

