import { randomBytes } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { appConfig } from "../config/appConfig.js";
import { getComfyRuntimeSettings } from "./comfyRuntimeSettings.js";
import {
  deleteGeneratedAudio as deleteGeneratedAudioFromStore,
  listGeneratedAudios as listGeneratedAudiosFromStore,
  listGeneratedAudiosPublic as listGeneratedAudiosPublicFromStore,
  persistGeneratedAudioArtifact,
  readGeneratedAudioFile as readGeneratedAudioFileFromStore,
  resolveGeneratedAudioFilePath as resolveGeneratedAudioFilePathFromStore,
  toGeneratedAudioPublicRecord as toGeneratedAudioPublicRecordFromStore
} from "./generatedMediaLibrary.js";
import type {
  GeneratedAudioMode,
  GeneratedAudioPublicRecord,
  GeneratedAudioRecord
} from "@urage/shared/media/generatedRecords";

interface ComfyMediaAsset {
  filename: string;
  subfolder: string | null;
  type: string | null;
}

export type {
  GeneratedAudioMode,
  GeneratedAudioPublicRecord,
  GeneratedAudioRecord
} from "@urage/shared/media/generatedRecords";

export interface GenerateAudioInput {
  prompt: string;
  seconds?: number;
  steps?: number;
  cfg?: number;
  onPromptQueued?: (promptId: string) => void | Promise<void>;
  signal?: AbortSignal;
}

export interface GenerateMusicInput {
  seconds: number;
  steps?: number;
  cfg?: number;
  seed?: number;
  tags?: string;
  lyrics?: string;
  onPromptQueued?: (promptId: string) => void | Promise<void>;
  signal?: AbortSignal;
}

const dataDirectory = path.resolve(appConfig.dataDirectory);
const generatedAudioDirectory = path.join(dataDirectory, "generated-audio");
const indexPath = path.join(generatedAudioDirectory, "index.json");
let generatedAudioMutationQueue: Promise<unknown> = Promise.resolve();

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

function asNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return value;
}

function asPositiveInteger(value: unknown): number | null {
  const numeric = typeof value === "string" ? Number.parseInt(value.trim(), 10) : asNumber(value);
  if (numeric === null || !Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }
  return Math.round(numeric);
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
  const error = new Error("Audio generation was aborted.");
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
  if (cleaned.length > 0) {
    return cleaned;
  }
  return fallback;
}

function extensionFromFileName(name: string | null | undefined): string {
  const ext = path.extname(name ?? "").toLowerCase();
  return ext.length > 0 ? ext : "";
}

function extensionToContentType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".flac") {
    return "audio/flac";
  }
  if (ext === ".wav") {
    return "audio/wav";
  }
  if (ext === ".mp3") {
    return "audio/mpeg";
  }
  if (ext === ".ogg") {
    return "audio/ogg";
  }
  if (ext === ".m4a") {
    return "audio/mp4";
  }
  return "application/octet-stream";
}

async function ensureGeneratedAudioStore(): Promise<void> {
  await mkdir(generatedAudioDirectory, { recursive: true });
  try {
    await readFile(indexPath, "utf8");
  } catch {
    await writeFile(indexPath, JSON.stringify([], null, 2), "utf8");
  }
}

function sanitizeGeneratedAudioRecord(value: unknown): GeneratedAudioRecord | null {
  const raw = asRecord(value);
  if (!raw) {
    return null;
  }
  const id = asString(raw.id);
  const createdAt = asString(raw.createdAt);
  const mode = raw.mode === "music" ? "music" : "audio";
  const prompt = typeof raw.prompt === "string" ? raw.prompt : "";
  const tags = typeof raw.tags === "string" ? raw.tags : "";
  const lyrics = typeof raw.lyrics === "string" ? raw.lyrics : "";
  const seconds = asPositiveInteger(raw.seconds);
  const comfyPromptId = asString(raw.comfyPromptId);
  const audioFileName = asString(raw.audioFileName);
  const seed = asPositiveInteger(raw.seed);
  const steps = asPositiveInteger(raw.steps);
  const cfg = asNumber(raw.cfg);
  const model = asString(raw.model) ?? (mode === "music" ? appConfig.comfyUiMusicModelName : appConfig.comfyUiAudioModelName);
  if (!id || !createdAt || !comfyPromptId || !audioFileName || seed === null) {
    return null;
  }
  return {
    id,
    createdAt,
    mode,
    prompt,
    tags,
    lyrics,
    seconds,
    comfyPromptId,
    audioFileName,
    seed,
    steps,
    cfg,
    model
  };
}

async function readGeneratedAudioIndex(): Promise<GeneratedAudioRecord[]> {
  await ensureGeneratedAudioStore();
  const raw = await readFile(indexPath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  const records = asArray(parsed).map(entry => sanitizeGeneratedAudioRecord(entry)).filter((entry): entry is GeneratedAudioRecord => entry !== null);
  return records.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

async function writeGeneratedAudioIndex(entries: GeneratedAudioRecord[]): Promise<void> {
  const task = generatedAudioMutationQueue.then(async () => {
    await ensureGeneratedAudioStore();
    await writeFile(indexPath, JSON.stringify(entries, null, 2), "utf8");
  });
  generatedAudioMutationQueue = task.catch(() => undefined);
  await task;
}

async function addGeneratedAudioRecord(record: GeneratedAudioRecord): Promise<void> {
  const existing = await readGeneratedAudioIndex();
  const next = [record, ...existing.filter(entry => entry.id !== record.id)].slice(0, 500);
  await writeGeneratedAudioIndex(next);
}

async function ensureUniqueFileName(directory: string, fileName: string): Promise<string> {
  let candidate = sanitizeFileName(fileName, "generated.flac");
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

function resolveComfyBaseUrlForMode(mode: GeneratedAudioMode): string {
  const comfySettings = getComfyRuntimeSettings();
  if (mode === "music") {
    return comfySettings.comfyUiMusicBaseUrl.trim() || comfySettings.comfyUiAudioBaseUrl.trim() || comfySettings.comfyUiBaseUrl;
  }
  return comfySettings.comfyUiAudioBaseUrl.trim() || comfySettings.comfyUiBaseUrl;
}
function buildComfyUrl(pathname: string, mode: GeneratedAudioMode): string {
  const base = new URL(resolveComfyBaseUrlForMode(mode));
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return new URL(normalizedPath, base).toString();
}

async function comfyPostJson(pathname: string, payload: unknown, mode: GeneratedAudioMode, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(buildComfyUrl(pathname, mode), {
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

async function comfyGetJson(pathname: string, mode: GeneratedAudioMode, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(buildComfyUrl(pathname, mode), { signal });
  if (!response.ok) {
    throw new Error(`ComfyUI request failed (${response.status}) for ${pathname}.`);
  }
  return response.json();
}

function buildComfyWebSocketUrl(clientId: string, mode: GeneratedAudioMode): string {
  const baseUrl = new URL(buildComfyUrl("/", mode));
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

async function waitForComfyPromptCompletion(promptId: string, clientId: string, timeoutMs: number, mode: GeneratedAudioMode, signal?: AbortSignal): Promise<boolean> {
  if (timeoutMs <= 0) {
    return false;
  }
  return new Promise(resolve => {
    let settled = false;
    const socket = new WebSocket(buildComfyWebSocketUrl(clientId, mode));
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
    const timer = setTimeout(() => {
      finalize(false);
    }, timeoutMs);
    const abortListener = (): void => {
      finalize(false);
    };
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

function extractComfyMediaAssets(outputs: Record<string, unknown>, nodeId: string, outputKey: string): ComfyMediaAsset[] {
  const node = asRecord(outputs[nodeId]);
  if (!node) {
    return [];
  }
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

function findFallbackComfyMediaAsset(outputs: Record<string, unknown>, outputKey: string): ComfyMediaAsset | null {
  for (const nodeValue of Object.values(outputs)) {
    const node = asRecord(nodeValue);
    if (!node) {
      continue;
    }
    const items = asArray(node[outputKey]);
    for (const item of items) {
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
  return null;
}

function hasComfyMediaOutput(outputs: Record<string, unknown>, outputNodeId: string, outputKey: string): boolean {
  const configured = outputNodeId.trim()
    ? extractComfyMediaAssets(outputs, outputNodeId.trim(), outputKey)[0] ?? null
    : null;
  return Boolean(configured ?? findFallbackComfyMediaAsset(outputs, outputKey));
}

async function waitForComfyHistoryOutputsByPolling(
  promptId: string,
  timeoutAt: number,
  pollMs: number,
  outputNodeId: string,
  outputKey: string,
  mode: GeneratedAudioMode,
  signal?: AbortSignal
): Promise<Record<string, unknown> | null> {
  while (Date.now() < timeoutAt) {
    throwIfAborted(signal);
    const historyPayload = await comfyGetJson(`/history/${encodeURIComponent(promptId)}`, mode, signal);
    const outputs = extractHistoryOutputs(historyPayload, promptId);
    if (outputs && hasComfyMediaOutput(outputs, outputNodeId, outputKey)) {
      return outputs;
    }
    await sleep(pollMs);
  }
  return null;
}

async function downloadComfyAsset(asset: ComfyMediaAsset, mode: GeneratedAudioMode, signal?: AbortSignal): Promise<Buffer> {
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
    const response = await fetch(buildComfyUrl(`/view?${query.toString()}`, mode), { signal });
    if (!response.ok) {
      continue;
    }
    return Buffer.from(await response.arrayBuffer());
  }
  throw new Error(`Failed to download generated audio asset "${asset.filename}" from ComfyUI.`);
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

function parseNumericNodeInput(workflowRoot: Record<string, unknown>, nodeId: string, inputKey: string): number | null {
  const node = asRecord(workflowRoot[nodeId]);
  const inputs = asRecord(node?.inputs);
  return asPositiveInteger(inputs?.[inputKey]);
}

function buildPublicAudioFileUrl(audioId: string, fileName: string): string {
  return `/api/generated-audio-file?audioId=${encodeURIComponent(audioId)}&file=${encodeURIComponent(fileName)}`;
}

export function toGeneratedAudioPublicRecord(record: GeneratedAudioRecord): GeneratedAudioPublicRecord {
  return toGeneratedAudioPublicRecordFromStore(record);
}

export async function listGeneratedAudios(): Promise<GeneratedAudioRecord[]> {
  return listGeneratedAudiosFromStore();
}

export async function listGeneratedAudiosPublic(): Promise<GeneratedAudioPublicRecord[]> {
  return listGeneratedAudiosPublicFromStore();
}

export async function resolveGeneratedAudioFilePath(audioId: string, fileName: string): Promise<string> {
  return resolveGeneratedAudioFilePathFromStore(audioId, fileName);
}

export async function readGeneratedAudioFile(audioId: string, fileName: string): Promise<{ data: Buffer; contentType: string; }> {
  return readGeneratedAudioFileFromStore(audioId, fileName);
}
export async function deleteGeneratedAudio(audioId: string): Promise<boolean> {
  return deleteGeneratedAudioFromStore(audioId);
}

async function generateAudioWithWorkflow(input: {
  mode: GeneratedAudioMode;
  workflowPath: string;
  outputNodeId: string;
  outputKey: string;
  pollMs: number;
  timeoutMs: number;
  modelName: string;
  prompt?: string;
  tags?: string;
  lyrics?: string;
  seconds?: number;
  promptNodeId?: string;
  promptInputKey?: string;
  tagsNodeId?: string;
  tagsInputKey?: string;
  lyricsNodeId?: string;
  lyricsInputKey?: string;
  secondsNodeId?: string;
  secondsInputKey?: string;
  seedNodeId?: string;
  seedInputKey?: string;
  stepsNodeId?: string;
  stepsInputKey?: string;
  cfgNodeId?: string;
  cfgInputKey?: string;
  seed?: number;
  steps?: number;
  cfg?: number;
  onPromptQueued?: (promptId: string) => void | Promise<void>;
  signal?: AbortSignal;
}): Promise<GeneratedAudioRecord> {
  throwIfAborted(input.signal);
  const workflowRaw = JSON.parse(await readFile(input.workflowPath, "utf8")) as unknown;
  const workflowRoot = asRecord(workflowRaw);
  if (!workflowRoot) {
    throw new Error("ComfyUI audio workflow JSON is invalid.");
  }
  const promptText = (input.prompt ?? "").trim();
  const tags = (input.tags ?? "").trim();
  const lyrics = (input.lyrics ?? "").trim();
  const seconds = typeof input.seconds === "number" && Number.isFinite(input.seconds)
    ? Math.max(1, Math.min(120, Math.round(input.seconds)))
    : null;
  if (input.promptNodeId && input.promptInputKey && promptText) {
    setNodeInputString(workflowRoot, input.promptNodeId, input.promptInputKey, promptText);
  }
  if (input.tagsNodeId && input.tagsInputKey) {
    setNodeInputString(workflowRoot, input.tagsNodeId, input.tagsInputKey, tags);
  }
  if (input.lyricsNodeId && input.lyricsInputKey) {
    setNodeInputString(workflowRoot, input.lyricsNodeId, input.lyricsInputKey, lyrics);
  }
  if (seconds !== null && input.secondsNodeId && input.secondsInputKey) {
    setNodeInputNumber(workflowRoot, input.secondsNodeId, input.secondsInputKey, seconds);
  }
  const seed = typeof input.seed === "number" && Number.isFinite(input.seed)
    ? Math.max(0, Math.min(0xffffffffffff, Math.round(input.seed)))
    : createRandomSeed();
  if (input.seedNodeId && input.seedInputKey) {
    setNodeInputNumber(workflowRoot, input.seedNodeId, input.seedInputKey, seed);
  }
  const requestedSteps = typeof input.steps === "number" && Number.isFinite(input.steps)
    ? Math.max(1, Math.min(250, Math.round(input.steps)))
    : null;
  if (requestedSteps !== null && input.stepsNodeId && input.stepsInputKey) {
    setNodeInputNumber(workflowRoot, input.stepsNodeId, input.stepsInputKey, requestedSteps);
  }
  const requestedCfg = typeof input.cfg === "number" && Number.isFinite(input.cfg)
    ? Math.max(0, Math.min(30, input.cfg))
    : null;
  if (requestedCfg !== null && input.cfgNodeId && input.cfgInputKey) {
    setNodeInputNumber(workflowRoot, input.cfgNodeId, input.cfgInputKey, requestedCfg);
  }
  const timeoutMs = Math.max(30_000, input.timeoutMs);
  const pollMs = Math.max(1_000, input.pollMs);
  const timeoutAt = Date.now() + timeoutMs;
  const comfyClientId = createId();
  const promptResponse = asRecord(await comfyPostJson("/prompt", {
    prompt: workflowRaw,
    client_id: comfyClientId
  }, input.mode, input.signal));
  const promptId = asString(promptResponse?.prompt_id);
  if (!promptId) {
    throw new Error("ComfyUI did not return a prompt_id.");
  }
  await input.onPromptQueued?.(promptId);
  throwIfAborted(input.signal);
  let outputs: Record<string, unknown> | null = null;
  const websocketWaitMs = Math.max(1_000, timeoutAt - Date.now());
  const completedViaWebSocket = await waitForComfyPromptCompletion(promptId, comfyClientId, websocketWaitMs, input.mode, input.signal);
  throwIfAborted(input.signal);
  if (completedViaWebSocket) {
    const historyPayload = await comfyGetJson(`/history/${encodeURIComponent(promptId)}`, input.mode, input.signal);
    outputs = extractHistoryOutputs(historyPayload, promptId);
  }
  if (!outputs || !hasComfyMediaOutput(outputs, input.outputNodeId, input.outputKey)) {
    outputs = await waitForComfyHistoryOutputsByPolling(promptId, timeoutAt, pollMs, input.outputNodeId, input.outputKey, input.mode, input.signal);
  }
  if (!outputs) {
    throw new Error("ComfyUI audio generation did not produce history outputs in time.");
  }
  const configuredOutput = input.outputNodeId.trim()
    ? extractComfyMediaAssets(outputs, input.outputNodeId.trim(), input.outputKey)[0] ?? null
    : null;
  const generatedAsset = configuredOutput ?? findFallbackComfyMediaAsset(outputs, input.outputKey);
  if (!generatedAsset) {
    throw new Error("ComfyUI did not produce an audio output for this run.");
  }
  const audioExtension = extensionFromFileName(generatedAsset.filename) || ".flac";
  const desiredName = sanitizeFileName(generatedAsset.filename, `generated${audioExtension}`);
  const audioData = await downloadComfyAsset(generatedAsset, input.mode, input.signal);
  const stepNodeId = input.stepsNodeId || input.seedNodeId || "";
  const stepInputKey = input.stepsInputKey || "steps";
  const steps = stepNodeId ? parseNumericNodeInput(workflowRoot, stepNodeId, stepInputKey) : null;
  const cfg = input.cfgNodeId && input.cfgInputKey
    ? asNumber(asRecord(asRecord(workflowRoot[input.cfgNodeId])?.inputs)?.[input.cfgInputKey])
    : null;
  const resolvedSeconds = seconds ?? (input.secondsNodeId && input.secondsInputKey
    ? parseNumericNodeInput(workflowRoot, input.secondsNodeId, input.secondsInputKey)
    : null);
  const promptSummary = input.mode === "music"
    ? [tags ? `tags: ${tags}` : "", lyrics ? `lyrics: ${lyrics}` : ""].filter(Boolean).join(" | ")
    : promptText;
  return persistGeneratedAudioArtifact({
    record: {
      createdAt: new Date().toISOString(),
      mode: input.mode,
      prompt: promptSummary,
      tags,
      lyrics,
      seconds: resolvedSeconds,
      comfyPromptId: promptId,
      seed,
      steps,
      cfg,
      model: input.modelName
    },
    audioData,
    desiredFileName: desiredName
  });
}

export async function generateAudioFromPrompt(input: GenerateAudioInput): Promise<GeneratedAudioRecord> {
  const promptText = input.prompt.trim();
  if (!promptText) {
    throw new Error("Prompt is required for audio generation.");
  }
  const comfySettings = getComfyRuntimeSettings();
  return generateAudioWithWorkflow({
    mode: "audio",
    workflowPath: comfySettings.comfyUiAudioWorkflowPath,
    outputNodeId: appConfig.comfyUiAudioOutputNodeId,
    outputKey: appConfig.comfyUiAudioOutputKey,
    pollMs: appConfig.comfyUiAudioPollMs,
    timeoutMs: appConfig.comfyUiAudioTimeoutMs,
    modelName: appConfig.comfyUiAudioModelName,
    prompt: promptText,
    seconds: input.seconds,
    promptNodeId: appConfig.comfyUiAudioPromptNodeId,
    promptInputKey: appConfig.comfyUiAudioPromptInputKey,
    secondsNodeId: appConfig.comfyUiAudioSecondsNodeId,
    secondsInputKey: appConfig.comfyUiAudioSecondsInputKey,
    seedNodeId: appConfig.comfyUiAudioSeedNodeId,
    seedInputKey: appConfig.comfyUiAudioSeedInputKey,
    stepsNodeId: appConfig.comfyUiAudioStepsNodeId,
    stepsInputKey: appConfig.comfyUiAudioStepsInputKey,
    cfgNodeId: appConfig.comfyUiAudioCfgNodeId,
    cfgInputKey: appConfig.comfyUiAudioCfgInputKey,
    steps: input.steps,
    cfg: input.cfg,
    onPromptQueued: input.onPromptQueued,
    signal: input.signal
  });
}

export async function generateMusicFromPrompt(input: GenerateMusicInput): Promise<GeneratedAudioRecord> {
  const seconds = Math.max(1, Math.min(120, Math.round(input.seconds)));
  const comfySettings = getComfyRuntimeSettings();
  return generateAudioWithWorkflow({
    mode: "music",
    workflowPath: comfySettings.comfyUiMusicWorkflowPath,
    outputNodeId: appConfig.comfyUiMusicOutputNodeId,
    outputKey: appConfig.comfyUiMusicOutputKey,
    pollMs: appConfig.comfyUiMusicPollMs,
    timeoutMs: appConfig.comfyUiMusicTimeoutMs,
    modelName: appConfig.comfyUiMusicModelName,
    tags: input.tags,
    lyrics: input.lyrics,
    seconds,
    tagsNodeId: appConfig.comfyUiMusicTagsNodeId,
    tagsInputKey: appConfig.comfyUiMusicTagsInputKey,
    lyricsNodeId: appConfig.comfyUiMusicLyricsNodeId,
    lyricsInputKey: appConfig.comfyUiMusicLyricsInputKey,
    secondsNodeId: appConfig.comfyUiMusicSecondsNodeId,
    secondsInputKey: appConfig.comfyUiMusicSecondsInputKey,
    seedNodeId: appConfig.comfyUiMusicSeedNodeId,
    seedInputKey: appConfig.comfyUiMusicSeedInputKey,
    stepsNodeId: appConfig.comfyUiMusicStepsNodeId,
    stepsInputKey: appConfig.comfyUiMusicStepsInputKey,
    cfgNodeId: appConfig.comfyUiMusicCfgNodeId,
    cfgInputKey: appConfig.comfyUiMusicCfgInputKey,
    seed: input.seed,
    steps: input.steps,
    cfg: input.cfg,
    onPromptQueued: input.onPromptQueued,
    signal: input.signal
  });
}
