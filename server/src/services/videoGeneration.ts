import { randomBytes } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { appConfig } from "../config/appConfig.js";
import { getComfyRuntimeSettings, resolveComfyWorkspacePath } from "./comfyRuntimeSettings.js";
import {
  deleteGeneratedVideo as deleteGeneratedVideoFromStore,
  listGeneratedVideos as listGeneratedVideosFromStore,
  listGeneratedVideosPublic as listGeneratedVideosPublicFromStore,
  persistGeneratedVideoArtifact,
  readGeneratedVideoFile as readGeneratedVideoFileFromStore,
  resolveGeneratedVideoFilePath as resolveGeneratedVideoFilePathFromStore,
  toGeneratedVideoPublicRecord as toGeneratedVideoPublicRecordFromStore
} from "./generatedMediaLibrary.js";
import type { GeneratedVideoPublicRecord, GeneratedVideoRecord } from "@urage/shared/media/generatedRecords";

interface ComfyMediaAsset {
  filename: string;
  subfolder: string | null;
  type: string | null;
}

export type { GeneratedVideoPublicRecord, GeneratedVideoRecord } from "@urage/shared/media/generatedRecords";

export interface GenerateVideoInput {
  prompt: string;
  negativePrompt?: string;
  seconds?: number;
  frames?: number;
  fps?: number;
  width?: number;
  height?: number;
  steps?: number;
  seed?: number;
  workflowPath?: string;
  imageDataUrl?: string;
  imageFileName?: string;
  onPromptQueued?: (promptId: string) => void | Promise<void>;
  signal?: AbortSignal;
}

const dataDirectory = path.resolve(appConfig.dataDirectory);
const generatedVideoDirectory = path.join(dataDirectory, "generated-video");
const indexPath = path.join(generatedVideoDirectory, "index.json");
let generatedVideoMutationQueue: Promise<unknown> = Promise.resolve();

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}
function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}
function asPositiveInteger(value: unknown): number | null {
  const numeric = typeof value === "string" ? Number.parseInt(value.trim(), 10) : (typeof value === "number" && Number.isFinite(value) ? value : null);
  if (numeric === null || !Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }
  return Math.round(numeric);
}
function asPositiveNumber(value: unknown): number | null {
  const numeric = typeof value === "string" ? Number.parseFloat(value.trim()) : (typeof value === "number" && Number.isFinite(value) ? value : null);
  return numeric !== null && Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}
function parseJsonWithOptionalBom<T>(raw: string): T {
  const normalized = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
  return JSON.parse(normalized) as T;
}
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}
function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) {
    return;
  }
  const error = new Error("Video generation was aborted.");
  error.name = "AbortError";
  throw error;
}
function createId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}
function createRandomSeed(): number {
  return Number.parseInt(randomBytes(6).toString("hex"), 16);
}
function sanitizeFileName(input: string, fallback: string): string {
  const base = path.basename((input || "").trim());
  const cleaned = base.replace(/[^\w.\-]+/g, "_").replace(/^_+/, "").slice(0, 120);
  return cleaned.length > 0 ? cleaned : fallback;
}
function extensionFromFileName(name: string | null | undefined): string {
  const ext = path.extname(name ?? "").toLowerCase();
  return ext.length > 0 ? ext : "";
}
function extensionToContentType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".mp4" || ext === ".m4v") return "video/mp4";
  if (ext === ".webm") return "video/webm";
  if (ext === ".mov") return "video/quicktime";
  if (ext === ".avi") return "video/x-msvideo";
  if (ext === ".mkv") return "video/x-matroska";
  if (ext === ".gif") return "image/gif";
  return "application/octet-stream";
}
function mimeToImageExtension(mimeType: string): string {
  const normalized = mimeType.toLowerCase();
  if (normalized.includes("png")) return ".png";
  if (normalized.includes("jpeg") || normalized.includes("jpg")) return ".jpg";
  if (normalized.includes("webp")) return ".webp";
  return ".png";
}
function parseImageDataUrl(dataUrl: string): { mimeType: string; data: Buffer; } {
  const match = dataUrl.trim().match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);
  if (!match) {
    throw new Error("Video image source must be a base64 image data URL.");
  }
  const mimeType = match[1] || "image/png";
  const payload = match[2] || "";
  return {
    mimeType,
    data: Buffer.from(payload, "base64")
  };
}
async function ensureGeneratedVideoStore(): Promise<void> {
  await mkdir(generatedVideoDirectory, { recursive: true });
  try {
    await readFile(indexPath, "utf8");
  } catch {
    await writeFile(indexPath, JSON.stringify([], null, 2), "utf8");
  }
}
function sanitizeGeneratedVideoRecord(value: unknown): GeneratedVideoRecord | null {
  const raw = asRecord(value);
  if (!raw) {
    return null;
  }
  const id = asString(raw.id);
  const createdAt = asString(raw.createdAt);
  const prompt = typeof raw.prompt === "string" ? raw.prompt : "";
  const seconds = asPositiveInteger(raw.seconds);
  const comfyPromptId = asString(raw.comfyPromptId);
  const generationDurationSeconds = asPositiveNumber(raw.generationDurationSeconds);
  const videoFileName = asString(raw.videoFileName);
  const seed = asPositiveInteger(raw.seed);
  const steps = asPositiveInteger(raw.steps);
  const model = asString(raw.model) ?? appConfig.comfyUiVideoModelName;
  if (!id || !createdAt || !comfyPromptId || !videoFileName || seed === null) {
    return null;
  }
  return {
    id,
    createdAt,
    prompt,
    seconds,
    comfyPromptId,
    generationDurationSeconds,
    videoFileName,
    seed,
    steps,
    model
  };
}
async function readGeneratedVideoIndex(): Promise<GeneratedVideoRecord[]> {
  await ensureGeneratedVideoStore();
  const raw = await readFile(indexPath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  const records = asArray(parsed).map(entry => sanitizeGeneratedVideoRecord(entry)).filter((entry): entry is GeneratedVideoRecord => entry !== null);
  return records.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}
async function writeGeneratedVideoIndex(entries: GeneratedVideoRecord[]): Promise<void> {
  const task = generatedVideoMutationQueue.then(async () => {
    await ensureGeneratedVideoStore();
    await writeFile(indexPath, JSON.stringify(entries, null, 2), "utf8");
  });
  generatedVideoMutationQueue = task.catch(() => undefined);
  await task;
}
async function addGeneratedVideoRecord(record: GeneratedVideoRecord): Promise<void> {
  const existing = await readGeneratedVideoIndex();
  const next = [record, ...existing.filter(entry => entry.id !== record.id)].slice(0, 500);
  await writeGeneratedVideoIndex(next);
}
async function ensureUniqueFileName(directory: string, fileName: string): Promise<string> {
  let candidate = sanitizeFileName(fileName, "generated.mp4");
  let counter = 1;
  while (true) {
    try {
      await stat(path.join(directory, candidate));
      const ext = path.extname(candidate);
      const stem = path.basename(candidate, ext);
      candidate = `${stem}_${counter}${ext}`;
      counter += 1;
    } catch {
      return candidate;
    }
  }
}
function resolveComfyBaseUrl(): string {
  const comfySettings = getComfyRuntimeSettings();
  return comfySettings.comfyUiVideoBaseUrl.trim() || comfySettings.comfyUiBaseUrl;
}
function buildComfyUrl(pathname: string): string {
  const base = new URL(resolveComfyBaseUrl());
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return new URL(normalizedPath, base).toString();
}
async function comfyPostJson(pathname: string, payload: unknown, signal?: AbortSignal): Promise<unknown> {
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
async function comfyGetJson(pathname: string, signal?: AbortSignal): Promise<unknown> {
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
  baseUrl.searchParams.set("clientId", clientId);
  return baseUrl.toString();
}
function isComfyPromptFinishedEvent(payload: unknown, promptId: string): boolean {
  const root = asRecord(payload);
  const type = asString(root?.type);
  const data = asRecord(root?.data);
  const eventPromptId = asString(data?.prompt_id);
  if (!type || !eventPromptId || eventPromptId !== promptId) {
    return false;
  }
  if (type === "execution_success" || type === "execution_cached") {
    return true;
  }
  return type === "executing" && (data?.node === null || data?.node === "");
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
async function waitForComfyPromptCompletion(promptId: string, clientId: string, timeoutMs: number, signal?: AbortSignal): Promise<boolean> {
  if (timeoutMs <= 0) {
    return false;
  }
  return new Promise(resolve => {
    let settled = false;
    const socket = new WebSocket(buildComfyWebSocketUrl(clientId));
    const finalize = (value: boolean): void => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", abortListener);
      try {
        socket.close();
      } catch {
        // ignore close errors
      }
      resolve(value);
    };
    const abortListener = (): void => {
      finalize(false);
    };
    const timer = setTimeout(() => {
      finalize(false);
    }, timeoutMs);
    signal?.addEventListener("abort", abortListener, { once: true });
    socket.addEventListener("message", event => {
      const raw = decodeWebSocketPayload((event as { data?: unknown }).data);
      if (!raw) {
        return;
      }
      try {
        const payload = JSON.parse(raw) as unknown;
        if (isComfyPromptFinishedEvent(payload, promptId)) {
          finalize(true);
        }
      } catch {
        // ignore malformed payload
      }
    });
    socket.addEventListener("error", () => {
      finalize(false);
    });
    socket.addEventListener("close", () => {
      finalize(false);
    });
  });
}
function extractHistoryOutputs(historyPayload: unknown, promptId: string): Record<string, unknown> | null {
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

function extractComfyExecutionDurationSeconds(value: unknown): number | null {
  if (typeof value === "string") {
    const match = value.match(/Prompt executed in\s+([0-9]+(?:\.[0-9]+)?)\s+seconds/i);
    const parsed = match && match[1] ? Number.parseFloat(match[1]) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const parsed = extractComfyExecutionDurationSeconds(item);
      if (parsed !== null) return parsed;
    }
  }
  const record = asRecord(value);
  if (record) {
    for (const item of Object.values(record)) {
      const parsed = extractComfyExecutionDurationSeconds(item);
      if (parsed !== null) return parsed;
    }
  }
  return null;
}
function extractComfyMediaAssets(node: Record<string, unknown>, outputKey: string): ComfyMediaAsset[] {
  const items = asArray(node[outputKey]);
  const assets: ComfyMediaAsset[] = [];
  for (const item of items) {
    const entry = asRecord(item);
    const filename = asString(entry?.filename);
    if (!filename) {
      continue;
    }
    assets.push({
      filename,
      subfolder: asString(entry?.subfolder),
      type: asString(entry?.type)
    });
  }
  return assets;
}
function listCandidateOutputKeys(configuredOutputKey: string): string[] {
  const values = [
    configuredOutputKey,
    "videos",
    "video",
    "gifs",
    "images",
    "result",
    "output"
  ].map(entry => entry.trim()).filter(Boolean);
  return [...new Set(values)];
}
function findFallbackComfyMediaAsset(outputs: Record<string, unknown>, configuredOutputKey: string): ComfyMediaAsset | null {
  const outputKeys = listCandidateOutputKeys(configuredOutputKey);
  for (const nodeValue of Object.values(outputs)) {
    const node = asRecord(nodeValue);
    if (!node) {
      continue;
    }
    for (const outputKey of outputKeys) {
      const first = extractComfyMediaAssets(node, outputKey)[0];
      if (first) {
        return first;
      }
    }
    for (const maybeArray of Object.values(node)) {
      for (const item of asArray(maybeArray)) {
        const entry = asRecord(item);
        const filename = asString(entry?.filename);
        if (!filename) {
          continue;
        }
        return {
          filename,
          subfolder: asString(entry?.subfolder),
          type: asString(entry?.type)
        };
      }
    }
  }
  return null;
}
function hasComfyMediaOutput(outputs: Record<string, unknown>, outputNodeId: string, outputKey: string): boolean {
  const configuredNode = outputNodeId.trim() ? asRecord(outputs[outputNodeId.trim()]) : null;
  if (configuredNode) {
    const configuredAsset = extractComfyMediaAssets(configuredNode, outputKey.trim())[0] ?? null;
    if (configuredAsset) {
      return true;
    }
  }
  return findFallbackComfyMediaAsset(outputs, outputKey) !== null;
}
async function waitForComfyHistoryOutputsByPolling(
  promptId: string,
  timeoutAt: number,
  pollMs: number,
  outputNodeId: string,
  outputKey: string,
  signal?: AbortSignal
): Promise<Record<string, unknown> | null> {
  while (Date.now() < timeoutAt) {
    throwIfAborted(signal);
    const historyPayload = await comfyGetJson(`/history/${encodeURIComponent(promptId)}`, signal);
    const outputs = extractHistoryOutputs(historyPayload, promptId);
    if (outputs && hasComfyMediaOutput(outputs, outputNodeId, outputKey)) {
      return outputs;
    }
    await sleep(pollMs);
  }
  return null;
}
async function downloadComfyAsset(asset: ComfyMediaAsset, signal?: AbortSignal): Promise<Buffer> {
  const requestedTypes: Array<string | null> = [asset.type, null, "output", "temp", "input"];
  const seen = new Set<string>();
  const normalized: Array<string | null> = [];
  for (const requestedType of requestedTypes) {
    const value = typeof requestedType === "string" && requestedType.trim().length > 0 ? requestedType.trim() : null;
    const key = value ?? "(none)";
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    normalized.push(value);
  }
  for (const type of normalized) {
    throwIfAborted(signal);
    const query = new URLSearchParams({ filename: asset.filename });
    if (asset.subfolder) {
      query.set("subfolder", asset.subfolder);
    }
    if (type) {
      query.set("type", type);
    }
    const response = await fetch(buildComfyUrl(`/view?${query.toString()}`), { signal });
    if (!response.ok) {
      continue;
    }
    return Buffer.from(await response.arrayBuffer());
  }
  throw new Error(`Failed to download generated video asset "${asset.filename}" from ComfyUI.`);
}
function setNodeInputString(workflowRoot: Record<string, unknown>, nodeId: string, inputKey: string, value: string): void {
  const node = asRecord(workflowRoot[nodeId]);
  if (!node) {
    throw new Error(`Workflow node "${nodeId}" was not found.`);
  }
  const inputs = asRecord(node.inputs) ?? {};
  inputs[inputKey] = value;
  node.inputs = inputs;
}
function setNodeInputNumber(workflowRoot: Record<string, unknown>, nodeId: string, inputKey: string, value: number): void {
  const node = asRecord(workflowRoot[nodeId]);
  if (!node) {
    throw new Error(`Workflow node "${nodeId}" was not found.`);
  }
  const inputs = asRecord(node.inputs) ?? {};
  inputs[inputKey] = value;
  node.inputs = inputs;
}
function setFirstVideoNodeNumber(
  workflowRoot: Record<string, unknown>,
  configuredNodeId: string,
  configuredInputKey: string,
  fallbackInputKeys: string[],
  value: number
): void {
  const target = resolveVideoNodeByInput(workflowRoot, configuredNodeId, configuredInputKey, fallbackInputKeys);
  if (target) {
    setNodeInputNumber(workflowRoot, target.nodeId, target.inputKey, value);
  }
}
async function ensureVideoStartImageFile(dataUrl: string, requestedFileName: string): Promise<string> {
  const parsed = parseImageDataUrl(dataUrl);
  const extension = path.extname(requestedFileName || "") || mimeToImageExtension(parsed.mimeType);
  const baseName = sanitizeFileName(requestedFileName || `video-start${extension}`, `video-start${extension}`);
  const fileName = path.extname(baseName) ? baseName : `${baseName}${extension}`;
  const comfyInputDir = getComfyRuntimeSettings().comfyUiInputDir;
  if (!comfyInputDir) {
    throw new Error("ComfyUI input directory is not configured.");
  }
  await mkdir(comfyInputDir, { recursive: true });
  await writeFile(path.join(comfyInputDir, fileName), parsed.data);
  return fileName;
}
function setVideoStartImageIfPresent(workflowRoot: Record<string, unknown>, inputFileName: string): void {
  const loadImageNodeId = findNodeIdByClassType(workflowRoot, "LoadImage");
  if (!loadImageNodeId) {
    throw new Error("Image + text video workflow needs a LoadImage node.");
  }
  setNodeInputString(workflowRoot, loadImageNodeId, "image", inputFileName);
}
function parseNumericNodeInput(workflowRoot: Record<string, unknown>, nodeId: string, inputKey: string): number | null {
  const node = asRecord(workflowRoot[nodeId]);
  const inputs = asRecord(node?.inputs);
  return asPositiveInteger(inputs?.[inputKey]);
}
function nodeHasInput(node: Record<string, unknown>, inputKey: string): boolean {
  if (!inputKey) {
    return false;
  }
  const inputs = asRecord(node.inputs);
  return Boolean(inputs && inputKey in inputs);
}
function findNodeId(
  workflowRoot: Record<string, unknown>,
  predicate: (input: { nodeId: string; node: Record<string, unknown>; }) => boolean
): string | null {
  for (const [nodeId, rawNode] of Object.entries(workflowRoot)) {
    const node = asRecord(rawNode);
    if (!node) {
      continue;
    }
    if (predicate({ nodeId, node })) {
      return nodeId;
    }
  }
  return null;
}
function findNodeIdByClassType(workflowRoot: Record<string, unknown>, classType: string): string | null {
  const normalizedClassType = classType.trim().toLowerCase();
  return findNodeId(workflowRoot, ({ node }) => asString(node.class_type)?.toLowerCase() === normalizedClassType);
}
function findNodeIdByTitleAndInput(workflowRoot: Record<string, unknown>, titleToken: string, inputKey: string): string | null {
  const normalizedTitleToken = titleToken.trim().toLowerCase();
  return findNodeId(workflowRoot, ({ node }) => {
    const meta = asRecord(node._meta);
    const title = asString(meta?.title)?.toLowerCase() ?? "";
    return title.includes(normalizedTitleToken) && nodeHasInput(node, inputKey);
  });
}
function resolvePreferredInputKey(node: Record<string, unknown>, configuredKey: string, fallbackKeys: string[]): string {
  const inputs = asRecord(node.inputs);
  if (inputs) {
    if (configuredKey && configuredKey in inputs) {
      return configuredKey;
    }
    for (const fallbackKey of fallbackKeys) {
      if (fallbackKey in inputs) {
        return fallbackKey;
      }
    }
  }
  return configuredKey || fallbackKeys[0] || "text";
}
function resolveVideoPromptNodeId(workflowRoot: Record<string, unknown>): string | null {
  const configured = appConfig.comfyUiVideoPromptNodeId.trim();
  if (configured && asRecord(workflowRoot[configured])) {
    return configured;
  }
  const positiveByTitle = findNodeIdByTitleAndInput(workflowRoot, "positive", "text");
  if (positiveByTitle) {
    return positiveByTitle;
  }
  const configuredInputKey = appConfig.comfyUiVideoPromptInputKey.trim() || "text";
  const byConfiguredInput = findNodeId(workflowRoot, ({ node }) => nodeHasInput(node, configuredInputKey));
  if (byConfiguredInput) {
    return byConfiguredInput;
  }
  return findNodeId(workflowRoot, ({ node }) => nodeHasInput(node, "text") || nodeHasInput(node, "prompt"));
}
function resolveVideoNegativePromptNodeId(workflowRoot: Record<string, unknown>): string | null {
  return findNodeIdByTitleAndInput(workflowRoot, "negative", "text");
}
function resolveVideoNodeByInput(
  workflowRoot: Record<string, unknown>,
  configuredNodeId: string,
  configuredInputKey: string,
  fallbackInputKeys: string[]
): { nodeId: string; inputKey: string; } | null {
  const normalizedConfiguredNodeId = configuredNodeId.trim();
  if (normalizedConfiguredNodeId) {
    const configuredNode = asRecord(workflowRoot[normalizedConfiguredNodeId]);
    if (configuredNode) {
      return {
        nodeId: normalizedConfiguredNodeId,
        inputKey: resolvePreferredInputKey(configuredNode, configuredInputKey.trim(), fallbackInputKeys)
      };
    }
  }
  const normalizedConfiguredInputKey = configuredInputKey.trim();
  const byConfiguredInput = normalizedConfiguredInputKey
    ? findNodeId(workflowRoot, ({ node }) => nodeHasInput(node, normalizedConfiguredInputKey))
    : null;
  if (byConfiguredInput) {
    const node = asRecord(workflowRoot[byConfiguredInput]);
    if (node) {
      return {
        nodeId: byConfiguredInput,
        inputKey: resolvePreferredInputKey(node, normalizedConfiguredInputKey, fallbackInputKeys)
      };
    }
  }
  const fallback = findNodeId(workflowRoot, ({ node }) => fallbackInputKeys.some(key => nodeHasInput(node, key)));
  if (!fallback) {
    return null;
  }
  const node = asRecord(workflowRoot[fallback]);
  if (!node) {
    return null;
  }
  return {
    nodeId: fallback,
    inputKey: resolvePreferredInputKey(node, normalizedConfiguredInputKey, fallbackInputKeys)
  };
}
function buildPublicVideoFileUrl(videoId: string, fileName: string): string {
  return `/api/generated-video-file?videoId=${encodeURIComponent(videoId)}&file=${encodeURIComponent(fileName)}`;
}

export function toGeneratedVideoPublicRecord(record: GeneratedVideoRecord): GeneratedVideoPublicRecord {
  return toGeneratedVideoPublicRecordFromStore(record);
}
export async function listGeneratedVideos(): Promise<GeneratedVideoRecord[]> {
  return listGeneratedVideosFromStore();
}
export async function listGeneratedVideosPublic(): Promise<GeneratedVideoPublicRecord[]> {
  return listGeneratedVideosPublicFromStore();
}
export async function resolveGeneratedVideoFilePath(videoId: string, fileName: string): Promise<string> {
  return resolveGeneratedVideoFilePathFromStore(videoId, fileName);
}
export async function readGeneratedVideoFile(videoId: string, fileName: string): Promise<{ data: Buffer; contentType: string; }> {
  return readGeneratedVideoFileFromStore(videoId, fileName);
}
export async function deleteGeneratedVideo(videoId: string): Promise<boolean> {
  return deleteGeneratedVideoFromStore(videoId);
}

export async function generateVideoFromPrompt(input: GenerateVideoInput): Promise<GeneratedVideoRecord> {
  throwIfAborted(input.signal);
  const promptText = input.prompt.trim();
  if (!promptText) {
    throw new Error("Prompt is required for video generation.");
  }
  const comfySettings = getComfyRuntimeSettings();
  const hasStartImage = Boolean(input.imageDataUrl?.trim());
  const workflowPath = resolveComfyWorkspacePath(input.workflowPath?.trim()
    || (hasStartImage ? comfySettings.comfyUiVideoImageWorkflowPath : comfySettings.comfyUiVideoWorkflowPath));
  const workflowRaw = parseJsonWithOptionalBom<unknown>(await readFile(workflowPath, "utf8"));
  const workflowRoot = asRecord(workflowRaw);
  if (!workflowRoot) {
    throw new Error("ComfyUI video workflow JSON is invalid.");
  }
  const promptNodeId = resolveVideoPromptNodeId(workflowRoot);
  const promptNode = promptNodeId ? asRecord(workflowRoot[promptNodeId]) : null;
  if (!promptNodeId || !promptNode) {
    throw new Error(`No video prompt node was found in "${workflowPath}".`);
  }
  const promptInputKey = resolvePreferredInputKey(promptNode, appConfig.comfyUiVideoPromptInputKey.trim(), ["text", "prompt", "positive"]);
  setNodeInputString(workflowRoot, promptNodeId, promptInputKey, promptText);
  const negativePrompt = String(input.negativePrompt || "").trim();
  const negativePromptNodeId = negativePrompt ? resolveVideoNegativePromptNodeId(workflowRoot) : null;
  if (negativePrompt && negativePromptNodeId) {
    setNodeInputString(workflowRoot, negativePromptNodeId, "text", negativePrompt);
  }
  if (input.imageDataUrl?.trim()) {
    throwIfAborted(input.signal);
    const inputFileName = await ensureVideoStartImageFile(input.imageDataUrl, input.imageFileName || "video-start.png");
    setVideoStartImageIfPresent(workflowRoot, inputFileName);
  }
  const seconds = typeof input.seconds === "number" && Number.isFinite(input.seconds)
    ? Math.max(1, Math.min(300, Math.round(input.seconds)))
    : null;
  const frames = typeof input.frames === "number" && Number.isFinite(input.frames)
    ? Math.max(1, Math.min(512, Math.round(input.frames)))
    : null;
  const secondsNode = resolveVideoNodeByInput(
    workflowRoot,
    appConfig.comfyUiVideoSecondsNodeId,
    appConfig.comfyUiVideoSecondsInputKey,
    ["seconds", "duration", "length", "num_frames"]
  );
  if ((frames !== null || seconds !== null) && secondsNode) {
    setNodeInputNumber(workflowRoot, secondsNode.nodeId, secondsNode.inputKey, frames ?? seconds ?? 1);
  }
  if (typeof input.width === "number" && Number.isFinite(input.width)) {
    setFirstVideoNodeNumber(workflowRoot, "", "width", ["width"], Math.max(64, Math.min(4096, Math.round(input.width))));
  }
  if (typeof input.height === "number" && Number.isFinite(input.height)) {
    setFirstVideoNodeNumber(workflowRoot, "", "height", ["height"], Math.max(64, Math.min(4096, Math.round(input.height))));
  }
  if (typeof input.fps === "number" && Number.isFinite(input.fps)) {
    setFirstVideoNodeNumber(workflowRoot, "", "fps", ["fps"], Math.max(1, Math.min(60, Math.round(input.fps))));
  }
  if (typeof input.steps === "number" && Number.isFinite(input.steps)) {
    setFirstVideoNodeNumber(workflowRoot, appConfig.comfyUiVideoStepsNodeId, appConfig.comfyUiVideoStepsInputKey, ["steps"], Math.max(1, Math.min(250, Math.round(input.steps))));
  }
  const seed = typeof input.seed === "number" && Number.isFinite(input.seed)
    ? Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.round(input.seed)))
    : createRandomSeed();
  const seedNode = resolveVideoNodeByInput(
    workflowRoot,
    appConfig.comfyUiVideoSeedNodeId,
    appConfig.comfyUiVideoSeedInputKey,
    ["seed", "noise_seed"]
  );
  if (seedNode) {
    setNodeInputNumber(workflowRoot, seedNode.nodeId, seedNode.inputKey, seed);
  }
  const timeoutMs = Math.max(30_000, appConfig.comfyUiVideoTimeoutMs);
  const pollMs = Math.max(1_000, appConfig.comfyUiVideoPollMs);
  const timeoutAt = Date.now() + timeoutMs;
  const comfyClientId = createId();
  const generationStartedAt = Date.now();
  const promptResponse = asRecord(await comfyPostJson("/prompt", {
    prompt: workflowRoot,
    client_id: comfyClientId
  }, input.signal));
  const promptId = asString(promptResponse?.prompt_id);
  if (!promptId) {
    throw new Error("ComfyUI did not return a prompt_id.");
  }
  await input.onPromptQueued?.(promptId);
  throwIfAborted(input.signal);
  let outputs: Record<string, unknown> | null = null;
  let comfyExecutionDurationSeconds: number | null = null;
  const websocketWaitMs = Math.max(1_000, timeoutAt - Date.now());
  const completedViaWebSocket = await waitForComfyPromptCompletion(promptId, comfyClientId, websocketWaitMs, input.signal);
  throwIfAborted(input.signal);
  if (completedViaWebSocket) {
    const historyPayload = await comfyGetJson(`/history/${encodeURIComponent(promptId)}`, input.signal);
    comfyExecutionDurationSeconds = extractComfyExecutionDurationSeconds(historyPayload);
    outputs = extractHistoryOutputs(historyPayload, promptId);
  }
  if (!outputs || !hasComfyMediaOutput(outputs, appConfig.comfyUiVideoOutputNodeId, appConfig.comfyUiVideoOutputKey)) {
    outputs = await waitForComfyHistoryOutputsByPolling(promptId, timeoutAt, pollMs, appConfig.comfyUiVideoOutputNodeId, appConfig.comfyUiVideoOutputKey, input.signal);
  }
  if (!outputs) {
    throw new Error("ComfyUI video generation did not produce history outputs in time.");
  }
  const generationDurationSeconds = comfyExecutionDurationSeconds ?? Math.max(0.01, (Date.now() - generationStartedAt) / 1000);
  let generatedAsset: ComfyMediaAsset | null = null;
  if (appConfig.comfyUiVideoOutputNodeId.trim()) {
    const outputNode = asRecord(outputs[appConfig.comfyUiVideoOutputNodeId.trim()]);
    if (outputNode) {
      generatedAsset = extractComfyMediaAssets(outputNode, appConfig.comfyUiVideoOutputKey)[0] ?? null;
    }
  }
  if (!generatedAsset) {
    generatedAsset = findFallbackComfyMediaAsset(outputs, appConfig.comfyUiVideoOutputKey);
  }
  if (!generatedAsset) {
    throw new Error("ComfyUI did not produce a video output for this run.");
  }
  const videoExtension = extensionFromFileName(generatedAsset.filename) || ".mp4";
  const desiredName = sanitizeFileName(generatedAsset.filename, `generated${videoExtension}`);
  const videoData = await downloadComfyAsset(generatedAsset, input.signal);
  const stepsNode = resolveVideoNodeByInput(
    workflowRoot,
    appConfig.comfyUiVideoStepsNodeId || appConfig.comfyUiVideoSeedNodeId,
    appConfig.comfyUiVideoStepsInputKey,
    ["steps"]
  );
  const steps = stepsNode ? parseNumericNodeInput(workflowRoot, stepsNode.nodeId, stepsNode.inputKey) : null;
  const resolvedSeconds = seconds ?? (secondsNode ? parseNumericNodeInput(workflowRoot, secondsNode.nodeId, secondsNode.inputKey) : null);
  return persistGeneratedVideoArtifact({
    record: {
      createdAt: new Date().toISOString(),
      prompt: promptText,
      seconds: seconds ?? (frames !== null && typeof input.fps === "number" && Number.isFinite(input.fps) ? Math.max(1, Math.round(frames / Math.max(1, input.fps))) : resolvedSeconds),
      comfyPromptId: promptId,
      generationDurationSeconds,
      seed,
      steps,
      model: appConfig.comfyUiVideoModelName
    },
    videoData,
    desiredFileName: desiredName
  });
}
