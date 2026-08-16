import { Colors, GuildMember, MessageFlags, type ButtonInteraction, type EmbedBuilder } from "discord.js";
import type { PendingSelfTaskBatch } from "../../selfTaskService.js";

type SelfTaskApprovalServiceDependencies = {
  approvePrefix: string;
  cancelPrefix: string;
  pendingSelfTaskBatches: Map<string, PendingSelfTaskBatch>;
  isProtectedGuildMember: (member: GuildMember | null | undefined) => boolean;
  buildSelfTaskEmbed: (batch: PendingSelfTaskBatch) => EmbedBuilder;
  applyPendingSelfTaskBatch: (batch: PendingSelfTaskBatch, approvedByTag: string) => Promise<{ results: string[]; skipped: string[] }>;
  resolveSelfTaskReview: (reviewId: string, payload: { status: "cancelled" | "failed"; resolutionNote: string }) => void;
  recordAction: (type: string, summary: string) => void;
};

type SelfTaskApprovalService = {
  handleSelfTaskApproval: (interaction: ButtonInteraction) => Promise<void>;
};

export function createSelfTaskApprovalService(dependencies: SelfTaskApprovalServiceDependencies): SelfTaskApprovalService {
  async function handleSelfTaskApproval(interaction: ButtonInteraction): Promise<void> {
    const isApprove = interaction.customId.startsWith(dependencies.approvePrefix);
    const prefix = isApprove ? dependencies.approvePrefix : dependencies.cancelPrefix;
    const taskId = interaction.customId.slice(prefix.length).trim();
    const batch = dependencies.pendingSelfTaskBatches.get(taskId);
    if (!batch) {
      await interaction.reply({
        content: "That self-task plan is no longer available.",
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    const actingMember = interaction.member instanceof GuildMember ? interaction.member : null;
    if (interaction.user.id !== batch.requestedByUserId && !dependencies.isProtectedGuildMember(actingMember)) {
      await interaction.reply({
        content: "Only the requestor or a protected member can do that.",
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    dependencies.pendingSelfTaskBatches.delete(taskId);
    if (!isApprove) {
      if (batch.reviewId) {
        dependencies.resolveSelfTaskReview(batch.reviewId, {
          status: "cancelled",
          resolutionNote: `Cancelled by ${interaction.user.tag}`
        });
      }
      await interaction.update({
        embeds: [
          dependencies.buildSelfTaskEmbed(batch)
            .setColor(Colors.Grey)
            .setFooter({ text: `Cancelled by ${interaction.user.tag}` })
        ],
        components: []
      });
      dependencies.recordAction("slash:/task-cancel", `${interaction.user.tag} cancelled a task plan in ${batch.guildId}.`);
      return;
    }
    try {
      const { results, skipped } = await dependencies.applyPendingSelfTaskBatch(batch, interaction.user.tag);
      await interaction.update({
        embeds: [
          dependencies.buildSelfTaskEmbed(batch)
            .setColor(Colors.Green)
            .addFields({
              name: "Execution",
              value: results.length > 0 ? results.join("\n") : "Nothing was executed."
            }, {
              name: "Skipped",
              value: skipped.length > 0 ? skipped.join("\n") : "Nothing skipped."
            })
            .setFooter({ text: `Approved by ${interaction.user.tag}` })
        ],
        components: []
      });
      dependencies.recordAction("slash:/task-approve", `${interaction.user.tag} approved ${batch.actions.length} self task(s) in ${batch.guildId}.`);
    } catch (error) {
      if (batch.reviewId) {
        dependencies.resolveSelfTaskReview(batch.reviewId, {
          status: "failed",
          resolutionNote: error instanceof Error ? error.message : "Task execution failed."
        });
      }
      await interaction.update({
        embeds: [
          dependencies.buildSelfTaskEmbed(batch)
            .setColor(Colors.Red)
            .addFields({
              name: "Execution error",
              value: error instanceof Error ? error.message : "Task execution failed."
            })
            .setFooter({ text: `Approval failed for ${interaction.user.tag}` })
        ],
        components: []
      });
    }
  }

  return {
    handleSelfTaskApproval
  };
}
