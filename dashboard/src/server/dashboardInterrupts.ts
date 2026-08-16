import type { DashboardComfyWorkflowKey, DashboardDependencies } from "./runtime/botBridge.js";

interface ActiveDashboardRequest {
  controller: AbortController;
  workflow: DashboardComfyWorkflowKey | null;
  promptId: string | null;
}

const activeDashboardRequests = new Map<string, ActiveDashboardRequest>();

export function createDashboardAbortError(message = "Dashboard request was stopped."): Error {
  const error = new Error(message);
  error.name = "AbortError";
  return error;
}

export function isDashboardAbortError(error: unknown): boolean {
  return error instanceof Error && (error.name === "AbortError" || /aborted|stopped|cancelled|canceled/i.test(error.message));
}

export function registerDashboardRequest(input: {
  requestId?: unknown;
  workflow?: DashboardComfyWorkflowKey | null;
}): {
  requestId: string;
  signal: AbortSignal;
  abort: () => void;
  finish: () => void;
  markPromptQueued: (promptId: string) => void;
} {
  const requestId = typeof input.requestId === "string" ? input.requestId.trim() : "";
  const controller = new AbortController();
  const workflow = input.workflow ?? null;
  if (requestId) {
    activeDashboardRequests.set(requestId, {
      controller,
      workflow,
      promptId: null
    });
  }
  return {
    requestId,
    signal: controller.signal,
    abort: () => controller.abort(createDashboardAbortError()),
    finish: () => {
      if (requestId) {
        activeDashboardRequests.delete(requestId);
      }
    },
    markPromptQueued: promptId => {
      const normalizedPromptId = String(promptId || "").trim();
      if (!requestId || !normalizedPromptId) {
        return;
      }
      const entry = activeDashboardRequests.get(requestId);
      if (entry) {
        entry.promptId = normalizedPromptId;
      }
    }
  };
}

export async function interruptDashboardRequest(requestId: string, dependencies: DashboardDependencies): Promise<{
  interrupted: boolean;
  workflow: DashboardComfyWorkflowKey | null;
  promptId: string | null;
}> {
  const normalizedRequestId = requestId.trim();
  const entry = normalizedRequestId ? activeDashboardRequests.get(normalizedRequestId) : null;
  if (!entry) {
    return {
      interrupted: false,
      workflow: null,
      promptId: null
    };
  }
  entry.controller.abort(createDashboardAbortError());
  if (entry.workflow) {
    await dependencies.interruptComfyWorkflow({
      workflow: entry.workflow,
      promptId: entry.promptId
    });
  }
  return {
    interrupted: true,
    workflow: entry.workflow,
    promptId: entry.promptId
  };
}
