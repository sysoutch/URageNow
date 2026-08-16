import type { PendingSelfTaskBatch, SelfTaskAction } from "../../selfTaskService.js";

type SelfTaskBatchExecutionServiceDependencies = {
  getGuildSettings: (guildId: string) => Promise<{ selfTaskAllowedActionTypes: string[]; selfTaskDryRunOnly: boolean }>;
  describeSelfTaskAction: (action: SelfTaskAction) => string;
  executeSelfTaskAction: (guildId: string, currentChannelId: string | null, action: SelfTaskAction) => Promise<string>;
  resolveSelfTaskReview: (reviewId: string, payload: { status: "approved"; resolutionNote: string }) => void;
};

type SelfTaskBatchExecutionService = {
  applyPendingSelfTaskBatch: (batch: PendingSelfTaskBatch, approvedByTag: string) => Promise<{ results: string[]; skipped: string[] }>;
};

export function createSelfTaskBatchExecutionService(dependencies: SelfTaskBatchExecutionServiceDependencies): SelfTaskBatchExecutionService {
  async function applyPendingSelfTaskBatch(batch: PendingSelfTaskBatch, approvedByTag: string): Promise<{ results: string[]; skipped: string[] }> {
    const guildSettings = await dependencies.getGuildSettings(batch.guildId);
    const allowedActionTypes = new Set(guildSettings.selfTaskAllowedActionTypes);
    const results: string[] = [];
    const skipped: string[] = [];
    for (const action of batch.actions) {
      if (!allowedActionTypes.has(action.type)) {
        skipped.push(`${dependencies.describeSelfTaskAction(action)} (blocked by server allowlist)`);
        continue;
      }
      if (guildSettings.selfTaskDryRunOnly) {
        skipped.push(`${dependencies.describeSelfTaskAction(action)} (dry run only)`);
        continue;
      }
      const result = await dependencies.executeSelfTaskAction(batch.guildId, batch.currentChannelId, action);
      results.push(result);
    }
    if (batch.reviewId) {
      dependencies.resolveSelfTaskReview(batch.reviewId, {
        status: "approved",
        resolutionNote: [
          results.length > 0 ? `Executed: ${results.join(" | ")}` : null,
          skipped.length > 0 ? `Skipped: ${skipped.join(" | ")}` : null,
          `Approved by ${approvedByTag}`
        ].filter(Boolean).join(" || ")
      });
    }
    return { results, skipped };
  }

  return {
    applyPendingSelfTaskBatch
  };
}

