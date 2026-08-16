import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { appConfig } from "../config/appConfig.js";
import { getComfyRuntimeSettings } from "./comfyRuntimeSettings.js";
import {
  deleteGeneratedImage as deleteGeneratedImageFromStore,
  getGeneratedImagePublicById as getGeneratedImagePublicByIdFromStore,
  importGeneratedImageArtifact as importGeneratedImageArtifactFromStore,
  listGeneratedImages as listGeneratedImagesFromStore,
  listGeneratedImagesPublic as listGeneratedImagesPublicFromStore,
  markGeneratedImageModelResult as markGeneratedImageModelResultFromStore,
  persistGeneratedImageArtifact,
  readGeneratedImageFile as readGeneratedImageFileFromStore,
  renameGeneratedImageFileName as renameGeneratedImageFileNameFromStore,
  updateGeneratedImageDescription as updateGeneratedImageDescriptionFromStore,
  resolveGeneratedImageFilePath as resolveGeneratedImageFilePathFromStore,
  toGeneratedImagePublicRecord as toGeneratedImagePublicRecordFromStore
} from "./generatedMediaLibrary.js";
import { stripImageMetadataToPng } from "./imageSanitizer.js";
import { stageImageInputForComfy } from "./model3d/sourceImageStage.js";
import type { GeneratedImagePublicRecord, GeneratedImageRecord } from "@urage/shared/media/generatedRecords";

interface ComfyImageAsset {
  filename: string;
  subfolder: string | null;
  type: string | null;
}

export type { GeneratedImagePublicRecord, GeneratedImageRecord } from "@urage/shared/media/generatedRecords";

export interface GenerateImageInput {
  prompt?: string;
  negativePrompt?: string;
  imageInput?: string;
  imageFileNameHint?: string;
  workflowPathOverride?: string;
  workflowInputOverrides?: Record<string, string | number | boolean>;
  width?: number;
  height?: number;
  seed?: number;
  steps?: number;
  cfg?: number;
  batchSize?: number;
  stripMetadata?: boolean;
  onPromptQueued?: (promptId: string) => void | Promise<void>;
  signal?: AbortSignal;
}

const dataDirectory = path.resolve(appConfig.dataDirectory);
const generatedImagesDirectory = path.join(dataDirectory, "generated-images");
const indexPath = path.join(generatedImagesDirectory, "index.json");
let generatedImageMutationQueue: Promise<unknown> = Promise.resolve();

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
function asInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseInt(value.trim(), 10);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}
function parseJsonWithOptionalBom<T>(raw: string): T {
  const normalized = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
  return JSON.parse(normalized) as T;
}
function toNodeId(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(Math.trunc(value));
  }
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  return null;
}
function isWidgetValueTypeCompatible(value: unknown, inputType: string | null): boolean {
  const normalized = (inputType ?? "").trim().toUpperCase();
  if (!normalized) {
    return true;
  }
  if (normalized === "INT" || normalized === "FLOAT") {
    return typeof value === "number" && Number.isFinite(value);
  }
  if (normalized === "BOOLEAN") {
    return typeof value === "boolean";
  }
  if (normalized === "STRING") {
    return typeof value === "string";
  }
  if (normalized === "COMBO") {
    return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
  }
  return true;
}
function consumeWidgetValue(values: unknown[], startIndex: number, inputType: string | null): { value: unknown; nextIndex: number } | null {
  if (startIndex >= values.length) {
    return null;
  }
  for (let index = startIndex; index < values.length; index += 1) {
    const candidate = values[index];
    if (!isWidgetValueTypeCompatible(candidate, inputType)) {
      continue;
    }
    return {
      value: candidate,
      nextIndex: index + 1
    };
  }
  return {
    value: values[startIndex],
    nextIndex: startIndex + 1
  };
}
function normalizeComfyWorkflowPrompt(rawWorkflow: unknown): Record<string, unknown> | null {
  const root = asRecord(rawWorkflow);
  if (!root) {
    return null;
  }
  const rawNodes = asArray(root.nodes);
  if (rawNodes.length === 0) {
    return root;
  }
  const linksById = new Map<number, { sourceNodeId: string; sourceOutputIndex: number }>();
  for (const entry of asArray(root.links)) {
    const link = asArray(entry);
    const linkId = asInteger(link[0]);
    const sourceNodeId = toNodeId(link[1]);
    const sourceOutputIndex = asInteger(link[2]);
    if (linkId === null || !sourceNodeId || sourceOutputIndex === null) {
      continue;
    }
    linksById.set(linkId, {
      sourceNodeId,
      sourceOutputIndex
    });
  }
  const prompt: Record<string, unknown> = {};
  for (const rawNode of rawNodes) {
    const node = asRecord(rawNode);
    if (!node) {
      continue;
    }
    const rawInputs = asArray(node.inputs);
    const rawOutputs = asArray(node.outputs);
    const hasLinkedInput = rawInputs.some(rawInput => {
      const input = asRecord(rawInput);
      return asInteger(input?.link) !== null;
    });
    const hasLinkedOutput = rawOutputs.some(rawOutput => {
      const output = asRecord(rawOutput);
      const links = asArray(output?.links);
      return links.some(linkId => asInteger(linkId) !== null);
    });
    if (!hasLinkedInput && !hasLinkedOutput) {
      continue;
    }
    const nodeId = toNodeId(node.id);
    const classType = asString(node.type);
    if (!nodeId || !classType) {
      continue;
    }
    const inputs: Record<string, unknown> = {};
    let widgetIndex = 0;
    for (const rawInput of rawInputs) {
      const input = asRecord(rawInput);
      const inputName = asString(input?.name);
      if (!inputName) {
        continue;
      }
      const linked = asInteger(input?.link);
      if (linked !== null) {
        const link = linksById.get(linked);
        if (link) {
          inputs[inputName] = [link.sourceNodeId, link.sourceOutputIndex];
          continue;
        }
      }
      if (!asRecord(input?.widget)) {
        continue;
      }
      const widgetValue = consumeWidgetValue(asArray(node.widgets_values), widgetIndex, asString(input?.type));
      if (!widgetValue) {
        continue;
      }
      widgetIndex = widgetValue.nextIndex;
      inputs[inputName] = widgetValue.value;
    }
    prompt[nodeId] = {
      inputs,
      class_type: classType,
      _meta: {
        title: asString(node.title) ?? classType
      }
    };
  }
  return prompt;
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
  const error = new Error("Image generation was aborted.");
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
  if (ext === ".png") {
    return "image/png";
  }
  if (ext === ".jpg" || ext === ".jpeg") {
    return "image/jpeg";
  }
  if (ext === ".webp") {
    return "image/webp";
  }
  if (ext === ".gif") {
    return "image/gif";
  }
  if (ext === ".bmp") {
    return "image/bmp";
  }
  if (ext === ".tiff" || ext === ".tif") {
    return "image/tiff";
  }
  return "application/octet-stream";
}

async function ensureGeneratedImageStore(): Promise<void> {
  await mkdir(generatedImagesDirectory, { recursive: true });
  try {
    await readFile(indexPath, "utf8");
  } catch {
    await writeFile(indexPath, JSON.stringify([], null, 2), "utf8");
  }
}

function asNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return value;
}

function sanitizeGeneratedImageRecord(value: unknown): GeneratedImageRecord | null {
  const raw = asRecord(value);
  if (!raw) {
    return null;
  }
  const id = asString(raw.id);
  const createdAt = asString(raw.createdAt);
  const prompt = typeof raw.prompt === "string" ? raw.prompt : "";
  const comfyPromptId = asString(raw.comfyPromptId);
  const generationDurationSeconds = asNumber(raw.generationDurationSeconds);
  const imageFileName = asString(raw.imageFileName);
  const seed = asNumber(raw.seed);
  const steps = asNumber(raw.steps);
  const cfg = asNumber(raw.cfg);
  const width = asNumber(raw.width);
  const height = asNumber(raw.height);
  const model = asString(raw.model) ?? appConfig.comfyUiImageModelName;
  const modelGeneratedAt = asString(raw.modelGeneratedAt);
  const modelGeneratedModelId = asString(raw.modelGeneratedModelId);
  if (!id || !createdAt || !comfyPromptId || !imageFileName || seed === null) {
    return null;
  }
  return {
    id,
    createdAt,
    prompt,
    comfyPromptId,
    generationDurationSeconds,
    imageFileName,
    seed,
    steps,
    cfg,
    width,
    height,
    model,
    modelGeneratedAt: modelGeneratedAt ?? null,
    modelGeneratedModelId: modelGeneratedModelId ?? null
  };
}

async function readGeneratedImageIndex(): Promise<GeneratedImageRecord[]> {
  await ensureGeneratedImageStore();
  const raw = await readFile(indexPath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  const records = asArray(parsed).map(entry => sanitizeGeneratedImageRecord(entry)).filter((entry): entry is GeneratedImageRecord => entry !== null);
  return records.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

async function writeGeneratedImageIndex(entries: GeneratedImageRecord[]): Promise<void> {
  const task = generatedImageMutationQueue.then(async () => {
    await ensureGeneratedImageStore();
    await writeFile(indexPath, JSON.stringify(entries, null, 2), "utf8");
  });
  generatedImageMutationQueue = task.catch(() => undefined);
  await task;
}

async function addGeneratedImageRecord(record: GeneratedImageRecord): Promise<void> {
  const existing = await readGeneratedImageIndex();
  const next = [record, ...existing.filter(entry => entry.id !== record.id)].slice(0, 500);
  await writeGeneratedImageIndex(next);
}

async function ensureUniqueFileName(directory: string, fileName: string): Promise<string> {
  let candidate = sanitizeFileName(fileName, "generated.png");
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

async function ensureUniqueImageId(preferredId: string): Promise<string> {
  const knownIds = new Set((await readGeneratedImageIndex()).map(entry => entry.id));
  const base = sanitizeFileName(preferredId, createId()) || createId();
  let candidate = base;
  let counter = 1;
  while (knownIds.has(candidate)) {
    candidate = `${base}_${counter}`;
    counter += 1;
  }
  return candidate;
}

function extractComfyImageAssets(outputs: Record<string, unknown>, nodeId: string): ComfyImageAsset[] {
  const node = asRecord(outputs[nodeId]);
  if (!node) {
    return [];
  }
  const images = asArray(node.images);
  const assets: ComfyImageAsset[] = [];
  for (const entry of images) {
    const image = asRecord(entry);
    const filename = asString(image?.filename);
    if (!filename) {
      continue;
    }
    assets.push({
      filename,
      subfolder: asString(image?.subfolder),
      type: asString(image?.type)
    });
  }
  return assets;
}

function findFallbackImageAsset(outputs: Record<string, unknown>): ComfyImageAsset | null {
  for (const value of Object.values(outputs)) {
    const node = asRecord(value);
    if (!node) {
      continue;
    }
    const assets = asArray(node.images);
    for (const asset of assets) {
      const image = asRecord(asset);
      const filename = asString(image?.filename);
      if (!filename) {
        continue;
      }
      return {
        filename,
        subfolder: asString(image?.subfolder),
        type: asString(image?.type)
      };
    }
  }
  return null;
}

function extractHistoryOutputs(historyPayload: unknown, promptId: string): Record<string, unknown> | null {
  const root = asRecord(historyPayload);
  if (!root) {
    return null;
  }
  const byPromptId = asRecord(root[promptId]);
  if (byPromptId) {
    return asRecord(byPromptId.outputs);
  }
  const first = Object.values(root)[0];
  const firstRecord = asRecord(first);
  if (!firstRecord) {
    return null;
  }
  return asRecord(firstRecord.outputs);
}

function hasComfyImageOutput(outputs: Record<string, unknown>): boolean {
  return findFallbackImageAsset(outputs) !== null;
}

function buildComfyUrl(pathname: string): string {
  const comfySettings = getComfyRuntimeSettings();
  const base = new URL(comfySettings.comfyUiImageBaseUrl.trim() || comfySettings.comfyUiBaseUrl);
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
  return type === "executing" || type === "execution_success" || type === "execution_cached";
}

async function waitForComfyPromptCompletion(promptId: string, clientId: string, timeoutMs: number, signal?: AbortSignal): Promise<boolean> {
  if (timeoutMs <= 0) {
    return false;
  }
  return new Promise(resolve => {
    let settled = false;
    const finalize = (value: boolean): void => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeoutHandle);
      signal?.removeEventListener("abort", abortListener);
      try {
        socket.close();
      } catch {
        // ignore
      }
      resolve(value);
    };
    const socket = new WebSocket(buildComfyWebSocketUrl(clientId));
    const abortListener = (): void => {
      finalize(false);
    };
    const timeoutHandle = setTimeout(() => {
      finalize(false);
    }, timeoutMs);
    signal?.addEventListener("abort", abortListener, { once: true });
    socket.addEventListener("open", () => {
      // connection established
    });
    socket.addEventListener("message", event => {
      try {
        const raw = typeof event.data === "string"
          ? event.data
          : Buffer.isBuffer(event.data)
            ? event.data.toString("utf8")
            : "";
        if (!raw) {
          return;
        }
        const payload = JSON.parse(raw) as unknown;
        if (isComfyPromptFinishedEvent(payload, promptId)) {
          finalize(true);
        }
      } catch {
        // ignore parse errors
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

async function waitForComfyHistoryOutputsByPolling(promptId: string, timeoutAt: number, pollMs: number, signal?: AbortSignal): Promise<Record<string, unknown> | null> {
  while (Date.now() < timeoutAt) {
    throwIfAborted(signal);
    const historyPayload = await comfyGetJson(`/history/${encodeURIComponent(promptId)}`, signal);
    const outputs = extractHistoryOutputs(historyPayload, promptId);
    if (outputs && hasComfyImageOutput(outputs)) {
      return outputs;
    }
    await sleep(pollMs);
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

async function downloadComfyAsset(asset: ComfyImageAsset, signal?: AbortSignal): Promise<Buffer> {
  const typesToTry = [asset.type, "output", "temp", "input"].filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
  for (const type of typesToTry) {
    throwIfAborted(signal);
    const query = new URLSearchParams();
    query.set("filename", asset.filename);
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
  throw new Error(`Failed to download generated asset "${asset.filename}" from ComfyUI.`);
}

function parseNumericNodeInput(workflowRoot: Record<string, unknown>, nodeId: string, inputKey: string): number | null {
  const node = asRecord(workflowRoot[nodeId]);
  const inputs = asRecord(node?.inputs);
  const value = inputs?.[inputKey];
  return asNumber(value);
}
function normalizeWorkflowNumber(value: unknown, min: number, max: number, integer = true): number | null {
  const parsed = typeof value === "number" ? value : Number.NaN;
  if (!Number.isFinite(parsed)) {
    return null;
  }
  const clamped = Math.min(max, Math.max(min, parsed));
  return integer ? Math.round(clamped) : clamped;
}
function normalizeWorkflowInputOverrides(value: unknown): Record<string, string | number | boolean> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const overrides: Record<string, string | number | boolean> = {};
  for (const [rawKey, rawValue] of Object.entries(value)) {
    const key = String(rawKey || "").trim();
    if (!key) {
      continue;
    }
    if (typeof rawValue === "string" || typeof rawValue === "boolean") {
      overrides[key] = rawValue;
      continue;
    }
    if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
      overrides[key] = rawValue;
    }
  }
  return overrides;
}
function setNodeInputNumber(workflowRoot: Record<string, unknown>, nodeId: string, inputKey: string, value: number): boolean {
  const node = asRecord(workflowRoot[nodeId]);
  if (!node) {
    return false;
  }
  const inputs = asRecord(node.inputs) ?? {};
  if (!(inputKey in inputs)) {
    return false;
  }
  inputs[inputKey] = value;
  node.inputs = inputs;
  return true;
}
function setDetectedNodeValue(
  workflowRoot: Record<string, unknown>,
  inputKeys: string[],
  value: string | number | boolean,
  preferredClassPattern?: RegExp,
  configuredNodeId?: string
): boolean {
  if (configuredNodeId) {
    const configuredNode = asRecord(workflowRoot[configuredNodeId]);
    const configuredInputs = asRecord(configuredNode?.inputs);
    if (configuredInputs) {
      for (const inputKey of inputKeys) {
        if (inputKey in configuredInputs) {
          configuredInputs[inputKey] = value;
          configuredNode!.inputs = configuredInputs;
          return true;
        }
      }
    }
  }
  const nodeId = findNodeIdByInputs(workflowRoot, [inputKeys[0] || ""], preferredClassPattern)
    ?? findNodeId(workflowRoot, ({ node }) => inputKeys.some(inputKey => nodeHasInput(node, inputKey)));
  if (!nodeId) {
    return false;
  }
  const node = asRecord(workflowRoot[nodeId]);
  const inputs = asRecord(node?.inputs) ?? {};
  for (const inputKey of inputKeys) {
    if (inputKey in inputs) {
      inputs[inputKey] = value;
      node!.inputs = inputs;
      return true;
    }
  }
  return false;
}
function setDetectedNodeNumber(
  workflowRoot: Record<string, unknown>,
  inputKeys: string[],
  value: number,
  preferredClassPattern?: RegExp,
  configuredNodeId?: string
): boolean {
  return setDetectedNodeValue(workflowRoot, inputKeys, value, preferredClassPattern, configuredNodeId);
}
function readNodeClassType(node: Record<string, unknown>): string {
  return (asString(node.class_type) ?? asString(node.type) ?? "").trim();
}
function readNodeTitle(node: Record<string, unknown>): string {
  const meta = asRecord(node._meta);
  return (asString(meta?.title) ?? asString(node.title) ?? "").trim();
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
  predicate: (input: { nodeId: string; node: Record<string, unknown>; classType: string; title: string; }) => boolean
): string | null {
  for (const [nodeId, rawNode] of Object.entries(workflowRoot)) {
    const node = asRecord(rawNode);
    if (!node) {
      continue;
    }
    const classType = readNodeClassType(node);
    const title = readNodeTitle(node);
    if (predicate({ nodeId, node, classType, title })) {
      return nodeId;
    }
  }
  return null;
}
function findLinkedSourceNodeId(
  workflowRoot: Record<string, unknown>,
  targetInputKeys: string[],
  preferredTargetClassPattern?: RegExp
): string | null {
  const findMatch = (classPattern?: RegExp): string | null => {
    for (const rawNode of Object.values(workflowRoot)) {
      const node = asRecord(rawNode);
      if (!node) {
        continue;
      }
      const classType = readNodeClassType(node);
      if (classPattern && !classPattern.test(classType)) {
        continue;
      }
      const inputs = asRecord(node.inputs);
      if (!inputs) {
        continue;
      }
      for (const inputKey of targetInputKeys) {
        const value = inputs[inputKey];
        const linked = asArray(value);
        const sourceNodeId = toNodeId(linked[0]);
        if (sourceNodeId && asRecord(workflowRoot[sourceNodeId])) {
          return sourceNodeId;
        }
      }
    }
    return null;
  };
  return findMatch(preferredTargetClassPattern) ?? findMatch();
}
function resolveImagePromptNodeId(workflowRoot: Record<string, unknown>): string | null {
  const configured = appConfig.comfyUiImagePromptNodeId.trim();
  if (configured && asRecord(workflowRoot[configured])) {
    return configured;
  }
  const configuredInputKey = appConfig.comfyUiImagePromptInputKey.trim() || "text";
  const linkedPositiveNodeId = findLinkedSourceNodeId(workflowRoot, ["positive"], /sampler/i);
  if (linkedPositiveNodeId) {
    const linkedPositiveNode = asRecord(workflowRoot[linkedPositiveNodeId]);
    if (
      linkedPositiveNode
      && (
        nodeHasInput(linkedPositiveNode, configuredInputKey)
        || nodeHasInput(linkedPositiveNode, "text")
        || nodeHasInput(linkedPositiveNode, "prompt")
        || nodeHasInput(linkedPositiveNode, "positive")
      )
    ) {
      return linkedPositiveNodeId;
    }
  }
  const positiveClipTextNode = findNodeId(workflowRoot, ({ classType, title, node }) =>
    (/cliptextencode/i.test(classType) || /textencode/i.test(classType))
      && /positive/i.test(title)
      && (
        nodeHasInput(node, configuredInputKey)
        || nodeHasInput(node, "text")
        || nodeHasInput(node, "prompt")
        || nodeHasInput(node, "positive")
      )
  );
  if (positiveClipTextNode) {
    return positiveClipTextNode;
  }
  const anyClipTextNode = findNodeId(workflowRoot, ({ classType, node }) =>
    (/cliptextencode/i.test(classType) || /textencode/i.test(classType))
      && (
        nodeHasInput(node, configuredInputKey)
        || nodeHasInput(node, "text")
        || nodeHasInput(node, "prompt")
        || nodeHasInput(node, "positive")
      )
  );
  if (anyClipTextNode) {
    return anyClipTextNode;
  }
  const anyConfiguredInputNode = findNodeId(workflowRoot, ({ node }) =>
    nodeHasInput(node, configuredInputKey)
  );
  if (anyConfiguredInputNode) {
    return anyConfiguredInputNode;
  }
  return findNodeId(workflowRoot, ({ node }) => nodeHasInput(node, "text") || nodeHasInput(node, "prompt") || nodeHasInput(node, "positive"));
}
function resolveImageNegativePromptNodeId(workflowRoot: Record<string, unknown>): string | null {
  const linkedNegativeNodeId = findLinkedSourceNodeId(workflowRoot, ["negative"], /sampler/i);
  if (linkedNegativeNodeId) {
    const linkedNegativeNode = asRecord(workflowRoot[linkedNegativeNodeId]);
    if (linkedNegativeNode && (nodeHasInput(linkedNegativeNode, "text") || nodeHasInput(linkedNegativeNode, "prompt") || nodeHasInput(linkedNegativeNode, "negative"))) {
      return linkedNegativeNodeId;
    }
  }
  return findNodeId(workflowRoot, ({ classType, title, node }) =>
    (/cliptextencode/i.test(classType) || /textencode/i.test(classType))
      && /negative/i.test(title)
      && (nodeHasInput(node, "text") || nodeHasInput(node, "prompt") || nodeHasInput(node, "negative"))
  );
}
function resolveImageSeedNodeId(workflowRoot: Record<string, unknown>): string | null {
  const configured = appConfig.comfyUiImageSeedNodeId.trim();
  if (configured && asRecord(workflowRoot[configured])) {
    return configured;
  }
  const configuredInputKey = appConfig.comfyUiImageSeedInputKey.trim() || "seed";
  const samplerWithSeed = findNodeId(workflowRoot, ({ classType, node }) =>
    /sampler/i.test(classType)
      && (nodeHasInput(node, configuredInputKey) || nodeHasInput(node, "seed"))
  );
  if (samplerWithSeed) {
    return samplerWithSeed;
  }
  return findNodeId(workflowRoot, ({ node }) =>
    nodeHasInput(node, configuredInputKey) || nodeHasInput(node, "seed")
  );
}
function resolveImageSourceNodeId(workflowRoot: Record<string, unknown>): string | null {
  const loadImageNode = findNodeId(workflowRoot, ({ classType, node }) =>
    /loadimage/i.test(classType) && (nodeHasInput(node, "image") || nodeHasInput(node, "upload"))
  );
  if (loadImageNode) {
    return loadImageNode;
  }
  return findNodeId(workflowRoot, ({ node }) => nodeHasInput(node, "image"));
}
function resolveImageOutputNodeId(workflowRoot: Record<string, unknown>, outputs: Record<string, unknown>): string | null {
  const configured = appConfig.comfyUiImageOutputNodeId.trim();
  if (configured && extractComfyImageAssets(outputs, configured).length > 0) {
    return configured;
  }
  const saveImageNodeId = findNodeId(workflowRoot, ({ classType, nodeId }) =>
    /saveimage/i.test(classType) && extractComfyImageAssets(outputs, nodeId).length > 0
  );
  if (saveImageNodeId) {
    return saveImageNodeId;
  }
  const previewNodeId = findNodeId(workflowRoot, ({ classType, nodeId }) =>
    /previewimage/i.test(classType) && extractComfyImageAssets(outputs, nodeId).length > 0
  );
  if (previewNodeId) {
    return previewNodeId;
  }
  return findNodeId(workflowRoot, ({ nodeId }) => extractComfyImageAssets(outputs, nodeId).length > 0);
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
function findNodeIdByInputs(workflowRoot: Record<string, unknown>, requiredInputKeys: string[], preferredClassPattern?: RegExp): string | null {
  const normalizedRequiredKeys = requiredInputKeys.map(entry => entry.trim()).filter(Boolean);
  if (normalizedRequiredKeys.length === 0) {
    return null;
  }
  const matchInputs = (node: Record<string, unknown>): boolean =>
    normalizedRequiredKeys.every(inputKey => nodeHasInput(node, inputKey));
  if (preferredClassPattern) {
    const preferred = findNodeId(workflowRoot, ({ classType, node }) =>
      preferredClassPattern.test(classType) && matchInputs(node)
    );
    if (preferred) {
      return preferred;
    }
  }
  return findNodeId(workflowRoot, ({ node }) => matchInputs(node));
}

function buildPublicImageFileUrl(imageId: string, fileName: string): string {
  return `/api/generated-image-file?imageId=${encodeURIComponent(imageId)}&file=${encodeURIComponent(fileName)}`;
}

export function toGeneratedImagePublicRecord(record: GeneratedImageRecord): GeneratedImagePublicRecord {
  return toGeneratedImagePublicRecordFromStore(record);
}

export async function importGeneratedImageArtifact(input: {
  record: GeneratedImageRecord;
  imageData: Buffer;
}): Promise<GeneratedImageRecord> {
  return importGeneratedImageArtifactFromStore(input);
}

async function saveGeneratedImageAssets(input: {
  assets: ComfyImageAsset[];
  promptText: string;
  promptId: string;
  generationDurationSeconds: number;
  seed: number;
  steps: number | null;
  cfg: number | null;
  width: number | null;
  height: number | null;
  stripMetadata?: boolean;
  signal?: AbortSignal;
}): Promise<GeneratedImageRecord[]> {
  const records: GeneratedImageRecord[] = [];
  for (const asset of input.assets) {
    const rawImageData = await downloadComfyAsset(asset, input.signal);
    const imageData = input.stripMetadata === true ? await stripImageMetadataToPng(rawImageData) : rawImageData;
    const imageExtension = input.stripMetadata === true ? ".png" : extensionFromFileName(asset.filename) || ".png";
    const desiredAssetName = input.stripMetadata === true
      ? `${path.basename(asset.filename, path.extname(asset.filename)) || "generated"}.png`
      : asset.filename;
    const record = await persistGeneratedImageArtifact({
      record: {
        createdAt: new Date().toISOString(),
        prompt: input.promptText,
        ...(input.promptText ? { description: input.promptText } : {}),
        comfyPromptId: input.promptId,
        generationDurationSeconds: input.generationDurationSeconds,
        seed: input.seed,
        steps: input.steps,
        cfg: input.cfg,
        width: input.width,
        height: input.height,
        model: appConfig.comfyUiImageModelName,
        modelGeneratedAt: null,
        modelGeneratedModelId: null
      },
      imageData,
      desiredFileName: sanitizeFileName(desiredAssetName, `generated${imageExtension}`)
    });
    records.push(record);
  }
  return records;
}

export async function listGeneratedImages(): Promise<GeneratedImageRecord[]> {
  return listGeneratedImagesFromStore();
}

export async function listGeneratedImagesPublic(): Promise<GeneratedImagePublicRecord[]> {
  return listGeneratedImagesPublicFromStore();
}

export async function getGeneratedImagePublicById(imageId: string): Promise<GeneratedImagePublicRecord | null> {
  return getGeneratedImagePublicByIdFromStore(imageId);
}

export async function resolveGeneratedImageFilePath(imageId: string, fileName: string): Promise<string> {
  return resolveGeneratedImageFilePathFromStore(imageId, fileName);
}

export async function readGeneratedImageFile(imageId: string, fileName: string): Promise<{ data: Buffer; contentType: string }> {
  return readGeneratedImageFileFromStore(imageId, fileName);
}
export async function deleteGeneratedImage(imageId: string): Promise<boolean> {
  return deleteGeneratedImageFromStore(imageId);
}
export async function renameGeneratedImageFileName(imageId: string, nextFileName: string): Promise<GeneratedImageRecord> {
  return renameGeneratedImageFileNameFromStore(imageId, nextFileName);
}
export async function updateGeneratedImageDescription(imageId: string, description: string): Promise<GeneratedImageRecord> {
  return updateGeneratedImageDescriptionFromStore(imageId, description);
}

export async function markGeneratedImageModelResult(imageId: string, modelId: string): Promise<GeneratedImageRecord> {
  return markGeneratedImageModelResultFromStore(imageId, modelId);
}

export async function generateImageFromPrompt(input: GenerateImageInput): Promise<GeneratedImageRecord> {
  throwIfAborted(input.signal);
  const promptText = input.prompt?.trim() ?? "";
  if (!promptText && !input.imageInput?.trim()) {
    throw new Error("Prompt is required for image generation.");
  }
  const comfySettings = getComfyRuntimeSettings();
  const sourceImageInput = input.imageInput?.trim() ?? "";
  const workflowPath = input.workflowPathOverride?.trim() || (sourceImageInput
    ? (comfySettings.comfyUiImageEditWorkflowPath.trim() || comfySettings.comfyUiImageWorkflowPath)
    : comfySettings.comfyUiImageWorkflowPath);
  const workflowRaw = parseJsonWithOptionalBom<unknown>(await readFile(workflowPath, "utf8"));
  const workflowDefinitionRoot = asRecord(workflowRaw);
  const workflowDefinitions = asRecord(workflowDefinitionRoot?.definitions);
  const workflowSubgraphs = asArray(workflowDefinitions?.subgraphs);
  if (workflowSubgraphs.length > 0) {
    throw new Error(`Workflow "${workflowPath}" is a ComfyUI editor graph with subgraphs. Export this workflow in API format (or flatten its subgraphs) and set it as the Image Layers workflow before retrying.`);
  }
  const workflowRoot = normalizeComfyWorkflowPrompt(workflowRaw);
  if (!workflowRoot) {
    throw new Error("ComfyUI image workflow JSON is invalid.");
  }
  if (sourceImageInput) {
    const stagedSourceImage = await stageImageInputForComfy({
      imageInput: sourceImageInput,
      imageFileNameHint: input.imageFileNameHint,
      fallbackPrefix: "image_input"
    });
    const imageInputNodeId = resolveImageSourceNodeId(workflowRoot);
    const imageInputNode = imageInputNodeId ? asRecord(workflowRoot[imageInputNodeId]) : null;
    if (!imageInputNode) {
      throw new Error(`No image input node was found in "${workflowPath}".`);
    }
    const imageInputs = asRecord(imageInputNode.inputs) ?? {};
    const imageInputKey = resolvePreferredInputKey(imageInputNode, "image", ["image", "upload"]);
    imageInputs[imageInputKey] = stagedSourceImage.fileName;
    imageInputNode.inputs = imageInputs;
  }
  const promptNodeId = resolveImagePromptNodeId(workflowRoot);
  const promptNode = promptNodeId ? asRecord(workflowRoot[promptNodeId]) : null;
  if (promptText && !promptNode) {
    throw new Error(`No prompt node was found in "${workflowPath}".`);
  }
  if (promptText && promptNode) {
    const promptInputs = asRecord(promptNode.inputs) ?? {};
    const promptInputKey = resolvePreferredInputKey(promptNode, appConfig.comfyUiImagePromptInputKey.trim(), ["text", "prompt", "positive"]);
    promptInputs[promptInputKey] = promptText;
    promptNode.inputs = promptInputs;
  }
  const negativePromptText = input.negativePrompt?.trim() ?? "";
  const negativePromptNodeId = negativePromptText ? resolveImageNegativePromptNodeId(workflowRoot) : null;
  const negativePromptNode = negativePromptNodeId ? asRecord(workflowRoot[negativePromptNodeId]) : null;
  if (negativePromptText && negativePromptNode) {
    const negativeInputs = asRecord(negativePromptNode.inputs) ?? {};
    const negativeInputKey = resolvePreferredInputKey(negativePromptNode, "", ["text", "prompt", "negative"]);
    negativeInputs[negativeInputKey] = negativePromptText;
    negativePromptNode.inputs = negativeInputs;
  }
  const requestedWidth = normalizeWorkflowNumber(input.width, 64, 4096);
  const requestedHeight = normalizeWorkflowNumber(input.height, 64, 4096);
  const requestedSteps = normalizeWorkflowNumber(input.steps, 1, 250);
  const requestedCfg = normalizeWorkflowNumber(input.cfg, 0, 30, false);
  const requestedBatchSize = normalizeWorkflowNumber(input.batchSize, 1, 64);
  if (requestedWidth !== null) {
    setDetectedNodeNumber(workflowRoot, ["width"], requestedWidth, /latent|image/i, appConfig.comfyUiImageSizeNodeId);
  }
  if (requestedHeight !== null) {
    setDetectedNodeNumber(workflowRoot, ["height"], requestedHeight, /latent|image/i, appConfig.comfyUiImageSizeNodeId);
  }
  if (requestedSteps !== null) {
    setDetectedNodeNumber(workflowRoot, ["steps"], requestedSteps, /sampler/i, appConfig.comfyUiImageStepsNodeId);
  }
  if (requestedCfg !== null) {
    setDetectedNodeNumber(workflowRoot, ["cfg", "cfg_scale", "guidance", "guidance_scale"], requestedCfg, /sampler|guidance/i);
  }
  if (requestedBatchSize !== null) {
    setDetectedNodeNumber(workflowRoot, ["batch_size", "batch"], requestedBatchSize, /latent|image/i);
  }
  const workflowInputOverrides = normalizeWorkflowInputOverrides(input.workflowInputOverrides);
  for (const [inputKey, overrideValue] of Object.entries(workflowInputOverrides)) {
    setDetectedNodeValue(workflowRoot, [inputKey], overrideValue);
  }
  const requestedSeed = normalizeWorkflowNumber(input.seed, 0, Number.MAX_SAFE_INTEGER);
  const seed = requestedSeed ?? createRandomSeed();
  const seedNodeId = resolveImageSeedNodeId(workflowRoot);
  const seedNode = seedNodeId ? asRecord(workflowRoot[seedNodeId]) : null;
  if (seedNode) {
    const seedInputs = asRecord(seedNode.inputs) ?? {};
    const seedInputKey = resolvePreferredInputKey(seedNode, appConfig.comfyUiImageSeedInputKey.trim(), ["seed", "noise_seed"]);
    if (seedInputKey) {
      seedInputs[seedInputKey] = seed;
      seedNode.inputs = seedInputs;
    }
  }
  const timeoutMs = Math.max(30_000, appConfig.comfyUiImageTimeoutMs);
  const pollMs = Math.max(1_000, appConfig.comfyUiImagePollMs);
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
  if (!outputs || !hasComfyImageOutput(outputs)) {
    outputs = await waitForComfyHistoryOutputsByPolling(promptId, timeoutAt, pollMs, input.signal);
  }
  if (!outputs) {
    throw new Error("ComfyUI image generation did not produce history outputs in time.");
  }
  const generationDurationSeconds = comfyExecutionDurationSeconds ?? Math.max(0.01, (Date.now() - generationStartedAt) / 1000);
  const resolvedOutputNodeId = resolveImageOutputNodeId(workflowRoot, outputs);
  const generatedAssets = resolvedOutputNodeId
    ? extractComfyImageAssets(outputs, resolvedOutputNodeId)
    : [];
  const fallbackAsset = generatedAssets.length === 0 ? findFallbackImageAsset(outputs) : null;
  const assetsToSave = generatedAssets.length > 0
    ? generatedAssets
    : (fallbackAsset ? [fallbackAsset] : []);
  if (assetsToSave.length === 0) {
    throw new Error("ComfyUI did not produce an image output for this run.");
  }
  const steps = parseNumericNodeInput(workflowRoot, appConfig.comfyUiImageStepsNodeId, "steps")
    ?? (() => {
      const detectedStepsNodeId = findNodeIdByInputs(workflowRoot, ["steps"], /sampler/i);
      return detectedStepsNodeId ? parseNumericNodeInput(workflowRoot, detectedStepsNodeId, "steps") : null;
    })();
  const cfg = parseNumericNodeInput(workflowRoot, appConfig.comfyUiImageStepsNodeId, "cfg")
    ?? (() => {
      const detectedCfgNodeId = findNodeIdByInputs(workflowRoot, ["cfg"], /sampler/i);
      return detectedCfgNodeId ? parseNumericNodeInput(workflowRoot, detectedCfgNodeId, "cfg") : null;
    })();
  const width = parseNumericNodeInput(workflowRoot, appConfig.comfyUiImageSizeNodeId, "width")
    ?? (() => {
      const detectedSizeNodeId = findNodeIdByInputs(workflowRoot, ["width", "height"], /latent|image/i);
      return detectedSizeNodeId ? parseNumericNodeInput(workflowRoot, detectedSizeNodeId, "width") : null;
    })();
  const height = parseNumericNodeInput(workflowRoot, appConfig.comfyUiImageSizeNodeId, "height")
    ?? (() => {
      const detectedSizeNodeId = findNodeIdByInputs(workflowRoot, ["width", "height"], /latent|image/i);
      return detectedSizeNodeId ? parseNumericNodeInput(workflowRoot, detectedSizeNodeId, "height") : null;
    })();
  const records = await saveGeneratedImageAssets({
    assets: assetsToSave,
    promptText,
    promptId,
    generationDurationSeconds,
    seed,
    steps,
    cfg,
    width,
    height,
    stripMetadata: input.stripMetadata,
    signal: input.signal
  });
  const primaryRecord = records[0];
  if (!primaryRecord) {
    throw new Error("ComfyUI did not save any image outputs for this run.");
  }
  return { ...primaryRecord, generatedImages: records } as GeneratedImageRecord;
}
