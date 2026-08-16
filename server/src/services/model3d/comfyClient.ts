import { appConfig } from "../../config/appConfig.js";
import { getComfyRuntimeSettings } from "../comfyRuntimeSettings.js";
import { asArray, asRecord, asString, sleep } from "./primitives.js";

export interface ComfyImageAsset {
  filename: string;
  subfolder: string | null;
  type: string | null;
}

export function extractComfyImageAssets(outputs: Record<string, unknown>, nodeId: string): ComfyImageAsset[] {
  if (!nodeId) {
    return [];
  }
  const node = asRecord(outputs[nodeId]);
  if (!node) {
    return [];
  }
  const images = asArray(node.images);
  const result: ComfyImageAsset[] = [];
  for (const imageEntry of images) {
    const imageObject = asRecord(imageEntry);
    if (!imageObject) {
      continue;
    }
    const filename = asString(imageObject.filename);
    if (!filename) {
      continue;
    }
    result.push({
      filename,
      subfolder: asString(imageObject.subfolder),
      type: asString(imageObject.type)
    });
  }
  return result;
}

export function parseModelAssetFromNode(outputs: Record<string, unknown>, nodeId: string): ComfyImageAsset | null {
  if (!nodeId) {
    return null;
  }
  const node = asRecord(outputs[nodeId]);
  if (!node) {
    return null;
  }
  const result = asArray(node.result);
  if (result.length === 0) {
    return null;
  }
  const rawPath = asString(result[0]);
  if (!rawPath) {
    return null;
  }
  const normalizedPath = rawPath.replace(/\\/g, "/").trim();
  const parsedPath = normalizedPath.split("/");
  const fileName = parsedPath.pop() ?? "";
  if (!fileName) {
    return null;
  }
  const subfolder = parsedPath.length > 0 ? parsedPath.join("/") : null;
  return {
    filename: fileName,
    subfolder,
    type: "output"
  };
}

export function findFallbackModelAsset(outputs: Record<string, unknown>): ComfyImageAsset | null {
  for (const entry of Object.values(outputs)) {
    const node = asRecord(entry);
    if (!node) {
      continue;
    }
    const result = asArray(node.result);
    const first = asString(result[0]);
    if (!first) {
      continue;
    }
    const normalizedPath = first.replace(/\\/g, "/").trim();
    const parsedPath = normalizedPath.split("/");
    const fileName = parsedPath.pop() ?? "";
    if (!fileName || !/\.(glb|obj|fbx|stl|ply)$/i.test(fileName)) {
      continue;
    }
    const subfolder = parsedPath.length > 0 ? parsedPath.join("/") : null;
    return {
      filename: fileName,
      subfolder,
      type: "output"
    };
  }
  return null;
}

export function extractHistoryOutputs(historyPayload: unknown, promptId: string): Record<string, unknown> | null {
  const root = asRecord(historyPayload);
  if (!root) {
    return null;
  }
  const byPromptId = asRecord(root[promptId]);
  if (byPromptId) {
    const outputs = asRecord(byPromptId.outputs);
    if (outputs) {
      return outputs;
    }
  }
  for (const value of Object.values(root)) {
    const entry = asRecord(value);
    if (!entry) {
      continue;
    }
    const outputs = asRecord(entry.outputs);
    if (outputs) {
      return outputs;
    }
  }
  return null;
}

function buildComfyUrl(pathname: string): string {
  const comfySettings = getComfyRuntimeSettings();
  const baseUrl = comfySettings.comfyUiModelBaseUrl.trim() || comfySettings.comfyUiBaseUrl;
  const base = baseUrl.replace(/\/$/, "");
  const suffix = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${base}${suffix}`;
}

export async function comfyPostJson(pathname: string, payload: unknown, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(buildComfyUrl(pathname), {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload),
    signal
  });
  if (!response.ok) {
    throw new Error(`ComfyUI request failed (${response.status}) for ${pathname}.`);
  }
  return response.json();
}

export async function comfyFreeMemory(options: { unloadModels: boolean; freeMemory: boolean }): Promise<void> {
  await comfyPostJson("/free", {
    unload_models: options.unloadModels,
    free_memory: options.freeMemory
  });
}

export async function comfyGetJson(pathname: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(buildComfyUrl(pathname), { signal });
  if (!response.ok) {
    throw new Error(`ComfyUI request failed (${response.status}) for ${pathname}.`);
  }
  return response.json();
}

function buildComfyWebSocketUrl(clientId: string): string {
  const baseUrl = new URL(buildComfyUrl("/"));
  baseUrl.protocol = baseUrl.protocol === "https:" ? "wss:" : "ws:";
  baseUrl.pathname = "/ws";
  baseUrl.search = `clientId=${encodeURIComponent(clientId)}`;
  return baseUrl.toString();
}

function decodeWebSocketPayload(data: unknown): string | null {
  if (typeof data === "string") {
    return data;
  }
  if (data instanceof ArrayBuffer) {
    return Buffer.from(data).toString("utf8");
  }
  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString("utf8");
  }
  return null;
}

function isComfyPromptFinishedEvent(payload: unknown, promptId: string): boolean {
  const root = asRecord(payload);
  if (!root) {
    return false;
  }
  const type = asString(root.type);
  const data = asRecord(root.data);
  const eventPromptId = asString(data?.prompt_id);
  if (!type || !eventPromptId || eventPromptId !== promptId) {
    return false;
  }
  if (type === "execution_success" || type === "executed") {
    return true;
  }
  if (type === "executing" && (data?.node === null || data?.node === "")) {
    return true;
  }
  return false;
}

export async function waitForComfyPromptCompletion(promptId: string, clientId: string, timeoutMs: number, signal?: AbortSignal): Promise<boolean> {
  if (timeoutMs <= 0) {
    return false;
  }
  return new Promise(resolve => {
    let settled = false;
    const socket = new WebSocket(buildComfyWebSocketUrl(clientId));
    const finish = (completed: boolean): void => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeoutHandle);
      signal?.removeEventListener("abort", abortListener);
      try {
        socket.close();
      } catch {
        // ignore close errors
      }
      resolve(completed);
    };
    const timeoutHandle = setTimeout(() => {
      finish(false);
    }, timeoutMs);
    const abortListener = (): void => {
      finish(false);
    };
    signal?.addEventListener("abort", abortListener, { once: true });
    socket.addEventListener("error", () => {
      finish(false);
    });
    socket.addEventListener("close", () => {
      finish(false);
    });
    socket.addEventListener("message", event => {
      const text = decodeWebSocketPayload((event as { data?: unknown }).data);
      if (!text) {
        return;
      }
      try {
        const payload = JSON.parse(text) as unknown;
        if (isComfyPromptFinishedEvent(payload, promptId)) {
          finish(true);
        }
      } catch {
        // ignore malformed websocket payloads
      }
    });
  });
}

function hasComfyModelOutput(outputs: Record<string, unknown>): boolean {
  return Boolean(parseModelAssetFromNode(outputs, appConfig.comfyUiModelOutputNodeId) ?? findFallbackModelAsset(outputs));
}

export async function waitForComfyHistoryOutputsByPolling(promptId: string, timeoutAt: number, pollMs: number, signal?: AbortSignal): Promise<Record<string, unknown> | null> {
  let latestOutputs: Record<string, unknown> | null = null;
  while (Date.now() < timeoutAt) {
    if (signal?.aborted) {
      const error = new Error("ComfyUI model generation was aborted.");
      error.name = "AbortError";
      throw error;
    }
    await sleep(pollMs);
    const historyPayload = await comfyGetJson(`/history/${encodeURIComponent(promptId)}`, signal);
    const outputs = extractHistoryOutputs(historyPayload, promptId);
    if (!outputs) {
      continue;
    }
    latestOutputs = outputs;
    if (hasComfyModelOutput(outputs)) {
      return outputs;
    }
  }
  return latestOutputs;
}

export async function downloadComfyAsset(asset: ComfyImageAsset, signal?: AbortSignal): Promise<Buffer> {
  const requestedTypes: Array<string | null> = [
    asset.type,
    null,
    "output",
    "temp",
    "input"
  ];
  const attemptedTypes = new Set<string>();
  const normalizedTypes: Array<string | null> = [];
  for (const type of requestedTypes) {
    const normalized = typeof type === "string" && type.trim().length > 0 ? type.trim() : null;
    const key = normalized ?? "(none)";
    if (attemptedTypes.has(key)) {
      continue;
    }
    attemptedTypes.add(key);
    normalizedTypes.push(normalized);
  }
  for (const type of normalizedTypes) {
    if (signal?.aborted) {
      const error = new Error("ComfyUI model generation was aborted.");
      error.name = "AbortError";
      throw error;
    }
    const query = new URLSearchParams({ filename: asset.filename });
    if (asset.subfolder) {
      query.set("subfolder", asset.subfolder);
    }
    if (type) {
      query.set("type", type);
    }
    const response = await fetch(buildComfyUrl(`/view?${query.toString()}`), { signal });
    if (response.ok) {
      return Buffer.from(await response.arrayBuffer());
    }
  }
  const typeSummary = normalizedTypes.map(type => type ?? "(none)").join(", ");
  throw new Error(`Failed to download generated asset "${asset.filename}" from ComfyUI. Tried types: ${typeSummary}.`);
}
