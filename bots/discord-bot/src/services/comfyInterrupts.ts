import { getComfyRuntimeSettings } from "@urage/server/services/comfyRuntimeSettings";

export type DashboardComfyWorkflowKey = "model3d" | "image" | "audio" | "music" | "video";

function resolveComfyWorkflowBaseUrl(workflow: DashboardComfyWorkflowKey): string {
  const settings = getComfyRuntimeSettings();
  if (workflow === "model3d") return settings.comfyUiModelBaseUrl.trim() || settings.comfyUiBaseUrl;
  if (workflow === "image") return settings.comfyUiImageBaseUrl.trim() || settings.comfyUiBaseUrl;
  if (workflow === "audio") return settings.comfyUiAudioBaseUrl.trim() || settings.comfyUiBaseUrl;
  if (workflow === "music") return settings.comfyUiMusicBaseUrl.trim() || settings.comfyUiBaseUrl;
  return settings.comfyUiVideoBaseUrl.trim() || settings.comfyUiBaseUrl;
}

function buildComfyInterruptUrl(workflow: DashboardComfyWorkflowKey): string {
  const baseUrl = resolveComfyWorkflowBaseUrl(workflow).replace(/\/$/, "");
  return `${baseUrl}/interrupt`;
}

export async function interruptComfyWorkflow(input: {
  workflow: DashboardComfyWorkflowKey;
  promptId?: string | null;
}): Promise<void> {
  const payload = input.promptId ? { prompt_id: input.promptId } : {};
  const response = await fetch(buildComfyInterruptUrl(input.workflow), {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  if (response.ok) {
    return;
  }
  const detail = (await response.text()).trim();
  throw new Error(
    detail
      ? `ComfyUI interrupt failed for ${input.workflow} (${response.status}): ${detail}`
      : `ComfyUI interrupt failed for ${input.workflow} (${response.status}).`
  );
}
