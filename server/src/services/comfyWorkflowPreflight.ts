import { getComfyRuntimeSettings } from "./comfyRuntimeSettings.js";

export type ComfyWorkflowNodePreflight = {
  status: "ready" | "not-configured" | "unavailable";
  missingNodeTypes: string[];
  missingModelFiles: string[];
};

export type ComfyWorkflowModelFileInput = {
  nodeType: string;
  inputName: string;
  modelFile: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function getComfyImageBaseUrl(): string {
  const settings = getComfyRuntimeSettings();
  return settings.comfyUiImageBaseUrl.trim() || settings.comfyUiBaseUrl.trim();
}

function getNodeInputChoices(nodeInfo: Record<string, unknown>, inputName: string): string[] {
  const input = asRecord(nodeInfo.input);
  if (!input) {
    return [];
  }
  for (const sectionName of ["required", "optional"]) {
    const section = asRecord(input[sectionName]);
    const specification = asArray(section?.[inputName]);
    const choices = asArray(specification[0]).filter((value): value is string => typeof value === "string");
    if (choices.length > 0) {
      return choices;
    }
  }
  return [];
}

function findMissingModelFiles(objectInfo: Record<string, unknown>, modelFileInputs: ComfyWorkflowModelFileInput[]): string[] {
  const missing = new Set<string>();
  for (const input of modelFileInputs) {
    const nodeInfo = asRecord(objectInfo[input.nodeType]);
    if (!nodeInfo) {
      continue;
    }
    const choices = getNodeInputChoices(nodeInfo, input.inputName);
    if (choices.length > 0 && !choices.includes(input.modelFile)) {
      missing.add(input.modelFile);
    }
  }
  return [...missing].sort((left, right) => left.localeCompare(right));
}

export async function preflightComfyImageWorkflowNodeTypes(requiredNodeTypes: string[], modelFileInputs: ComfyWorkflowModelFileInput[] = []): Promise<ComfyWorkflowNodePreflight> {
  const baseUrl = getComfyImageBaseUrl();
  if (!baseUrl) {
    return { status: "not-configured", missingNodeTypes: [], missingModelFiles: [] };
  }
  try {
    const response = await fetch(new URL("/object_info", baseUrl), { signal: AbortSignal.timeout(5_000) });
    if (!response.ok) {
      return { status: "unavailable", missingNodeTypes: [], missingModelFiles: [] };
    }
    const objectInfo = asRecord(await response.json());
    if (!objectInfo) {
      return { status: "unavailable", missingNodeTypes: [], missingModelFiles: [] };
    }
    const missingNodeTypes = requiredNodeTypes.filter(nodeType => !Object.hasOwn(objectInfo, nodeType));
    return { status: "ready", missingNodeTypes, missingModelFiles: findMissingModelFiles(objectInfo, modelFileInputs) };
  } catch {
    return { status: "unavailable", missingNodeTypes: [], missingModelFiles: [] };
  }
}
