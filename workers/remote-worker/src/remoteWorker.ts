import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import os from "node:os";
import { promisify } from "node:util";
import { appConfig } from "@urage/server/config/appConfig";
import { parseJsonBody, sendBinary, sendJson } from "@urage/server/http/http";
import { createRequestId, redactLogText } from "@urage/server/security/logRedaction";
import { recordRuntimeFailure } from "@urage/server/services/failureLogStore";
import { resolveImagePrompt, resolveImagePromptFromBaseImage, resolveModelPrompt } from "@urage/server/services/generationFacade";
import { updateComfyRuntimeSettings } from "@urage/server/services/comfyRuntimeSettings";
import {
  applyGeneratedModelAutoRig,
  applyGeneratedModelMetallic,
  applyGeneratedModelSeparateByLooseParts,
  applyGeneratedModelScaleToHeight,
  generate3dModelFromImage,
  generateLowPolyModel,
  indexGeneratedModelStoreWithRust,
  inspectGeneratedModelArtifact,
  importUploadedSourceModel,
  previewGeneratedModelAutoRig,
  renameGeneratedLowPolyModelFileName,
  readGeneratedModelFile,
  toGeneratedModelPublicRecord,
  validateGeneratedModelArtifact,
  type RealWorldDimensions,
  type RealWorldSizeTier
} from "@urage/server/services/model3d";
import { createBlenderOpenService } from "@urage/shared/runtime/blenderOpenService";
import {
  generateImageFromPrompt,
  readGeneratedImageFile
} from "@urage/server/services/imageGeneration";
import {
  resolveGeneratedAudioFilePath,
  resolveGeneratedImageFilePath,
  resolveGeneratedVideoFilePath,
  toGeneratedImagePublicRecord
} from "@urage/server/services/generatedMediaLibrary";
import { probeFileWithRust } from "@urage/server/services/mediaProbe";
import {
  askOllama,
  askVisionOllama,
  ejectActiveOllamaModels,
  loadActiveOllamaModels
} from "@urage/server/services/llm/ollama";
import { suggestModelMetallicDecision } from "@urage/server/services/model3d/modelMetallicDecision";
import { suggestModelRealWorldHeight } from "@urage/server/services/model3d/modelRealWorldHeightDecision";

type WorkerHandler = (request: IncomingMessage, response: ServerResponse, url: URL) => Promise<void>;

const execFileAsync = promisify(execFile);

function parseBase64DataUrl(dataUrl: string): { mimeType: string; base64Data: string; } | null {
  const match = dataUrl.match(/^data:([a-z0-9/+.-]+);base64,(.+)$/i);
  if (!match) {
    return null;
  }
  const mimeType = match[1] || "application/octet-stream";
  const base64Data = match[2] || "";
  if (!base64Data) {
    return null;
  }
  return {
    mimeType,
    base64Data
  };
}

function parseAutoRigLandmarks(value: unknown): Record<string, [number, number, number]> | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const entries = Object.entries(value as Record<string, unknown>);
  const normalized: Record<string, [number, number, number]> = {};
  for (const [key, rawPoint] of entries) {
    const trimmedKey = String(key || "").trim();
    if (!trimmedKey || !Array.isArray(rawPoint) || rawPoint.length !== 3) {
      continue;
    }
    const point = rawPoint.map(item => typeof item === "number" && Number.isFinite(item) ? item : Number.NaN);
    if (point.some(item => !Number.isFinite(item))) {
      continue;
    }
    normalized[trimmedKey] = [point[0] as number, point[1] as number, point[2] as number];
  }
  return Object.keys(normalized).length > 0 ? normalized : null;
}

function resolveWorkerAutoRigLlmSettings(): {
  llmProvider: "ollama" | "lmstudio" | "none";
  llmModel: string;
  ollamaUrl?: string;
  lmStudioBaseUrl?: string;
  lmStudioApiKey?: string;
} {
  const preferredProvider = appConfig.llmProvider === "ollama" ? "ollama" : "lmstudio";
  const lmStudioModel = appConfig.lmStudioVisionModel.trim() || appConfig.lmStudioModel.trim();
  const ollamaModel = appConfig.ollamaVisionModel.trim() || appConfig.ollamaModel.trim();
  if (preferredProvider === "lmstudio" && lmStudioModel) {
    return {
      llmProvider: "lmstudio",
      llmModel: lmStudioModel,
      lmStudioBaseUrl: appConfig.lmStudioBaseUrl,
      lmStudioApiKey: appConfig.lmStudioApiKey
    };
  }
  if (preferredProvider === "ollama" && ollamaModel) {
    return {
      llmProvider: "ollama",
      llmModel: ollamaModel,
      ollamaUrl: appConfig.ollamaUrl.replace(/\/api\/generate$/i, "")
    };
  }
  if (lmStudioModel) {
    return {
      llmProvider: "lmstudio",
      llmModel: lmStudioModel,
      lmStudioBaseUrl: appConfig.lmStudioBaseUrl,
      lmStudioApiKey: appConfig.lmStudioApiKey
    };
  }
  if (ollamaModel) {
    return {
      llmProvider: "ollama",
      llmModel: ollamaModel,
      ollamaUrl: appConfig.ollamaUrl.replace(/\/api\/generate$/i, "")
    };
  }
  return {
    llmProvider: "none",
    llmModel: ""
  };
}

const blenderOpenService = createBlenderOpenService({
  config: {
    blenderExecutablePath: appConfig.blenderExecutablePath,
    dataDirectory: appConfig.dataDirectory,
    blenderOpenScriptPath: appConfig.blenderOpenScriptPath,
    blenderModelAutoRigScriptPath: appConfig.blenderModelAutoRigScriptPath,
    blenderLowPolyScriptPath: appConfig.blenderLowPolyScriptPath
  }
});

function extractJsonObjectText(raw: string): string {
  const direct = raw.trim();
  if (direct.startsWith("{") && direct.endsWith("}")) {
    return direct;
  }
  const fencedMatch = direct.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch?.[1]) {
    const fenced = fencedMatch[1].trim();
    if (fenced.startsWith("{") && fenced.endsWith("}")) {
      return fenced;
    }
  }
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Could not find JSON metadata in model naming response.");
  }
  return raw.slice(start, end + 1);
}

function normalizeModelNameCandidate(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const normalized = trimmed
    .replace(/[^\w.\- ]+/g, " ")
    .replace(/\s+/g, "_")
    .replace(/^_+/, "")
    .slice(0, 90);
  return normalized || null;
}

function normalizeModelDescriptionCandidate(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.slice(0, 1200);
}

type LowPolyComplexityLevel = "simple" | "moderate" | "detailed";
type VisualSubjectKind = "character" | "animal" | "creature" | "object" | "vehicle" | "structure" | "scene" | "unknown";
type VisualSubjectPose = "standing" | "sitting" | "lying" | "floating" | "unknown";

function clampLowPolyFaceCount(value: unknown): number {
  let parsed: number | null = null;
  if (typeof value === "number" && Number.isFinite(value)) {
    parsed = Math.round(value);
  } else if (typeof value === "string" && value.trim().length > 0) {
    const asInt = Number.parseInt(value.trim(), 10);
    parsed = Number.isFinite(asInt) ? asInt : null;
  }
  if (parsed === null) {
    return appConfig.lowPolyDefaultTargetFaceCount;
  }
  return Math.max(500, Math.min(5000, parsed));
}

function parseLowPolyComplexityLevel(value: unknown): LowPolyComplexityLevel | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "simple" || normalized === "moderate" || normalized === "detailed") {
    return normalized;
  }
  if (normalized === "low") {
    return "simple";
  }
  if (normalized === "high" || normalized === "complex") {
    return "detailed";
  }
  return null;
}

function normalizeVisualObjectLabel(value: unknown): string {
  if (typeof value !== "string") {
    return "object";
  }
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized ? normalized.slice(0, 60) : "object";
}

function normalizeVisualSubjectKind(value: unknown): VisualSubjectKind {
  if (typeof value !== "string") {
    return "unknown";
  }
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return "unknown";
  }
  if (/character|person|human|humanoid/.test(normalized)) {
    return "character";
  }
  if (/animal|pet|mammal|bird|fish|reptile|insect/.test(normalized)) {
    return "animal";
  }
  if (/creature|monster|beast|alien|dragon/.test(normalized)) {
    return "creature";
  }
  if (/vehicle|car|truck|bike|motorcycle|plane|aircraft|ship|boat|train/.test(normalized)) {
    return "vehicle";
  }
  if (/building|house|tower|castle|bridge|architecture|structure/.test(normalized)) {
    return "structure";
  }
  if (/scene|environment|landscape|background/.test(normalized)) {
    return "scene";
  }
  if (/object|prop|item|thing/.test(normalized)) {
    return "object";
  }
  return "unknown";
}

function normalizeVisualSubjectPose(value: unknown): VisualSubjectPose {
  if (typeof value !== "string") {
    return "unknown";
  }
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return "unknown";
  }
  if (/stand|standing|upright/.test(normalized)) {
    return "standing";
  }
  if (/sit|sitting|seated|crouch|kneel/.test(normalized)) {
    return "sitting";
  }
  if (/lying|laying|prone|supine|reclined/.test(normalized)) {
    return "lying";
  }
  if (/float|floating|hover|flying|airborne|swimming/.test(normalized)) {
    return "floating";
  }
  return "unknown";
}

function parseLowPolyComplexityDecision(raw: string, usedVisionModel: boolean): {
  targetFaceCount: number;
  sizeTier: RealWorldSizeTier;
  complexity: LowPolyComplexityLevel;
  objectLabel: string;
  subjectKind: VisualSubjectKind;
  pose: VisualSubjectPose;
  reason: string;
  usedVisionModel: boolean;
} {
  const parsed = JSON.parse(extractJsonObjectText(raw)) as Record<string, unknown>;
  const targetFaceCount = clampLowPolyFaceCount(parsed.targetFaceCount);
  const sizeTier = parseOptionalRealWorldSizeTier(parsed.sizeTier) ?? "medium";
  const complexity = parseLowPolyComplexityLevel(parsed.complexity) ?? "moderate";
  const objectLabel = normalizeVisualObjectLabel(parsed.objectLabel);
  const subjectKind = normalizeVisualSubjectKind(parsed.subjectKind);
  const pose = normalizeVisualSubjectPose(parsed.pose);
  const reason = typeof parsed.reason === "string" && parsed.reason.trim().length > 0
    ? parsed.reason.trim().slice(0, 220)
    : "No reason provided.";
  return {
    targetFaceCount,
    sizeTier,
    complexity,
    objectLabel,
    subjectKind,
    pose,
    reason,
    usedVisionModel
  };
}

function buildLowPolyComplexityDecisionPrompt(input: {
  prompt?: string;
  context?: string;
  modelObject?: string;
}): string {
  return [
    "You decide low-poly target face count for game-ready 3D assets.",
    "Return JSON only with this schema:",
    "{\"targetFaceCount\":number,\"sizeTier\":\"tiny|small|medium|large|huge\",\"complexity\":\"simple|moderate|detailed\",\"objectLabel\":\"short label\",\"subjectKind\":\"character|animal|creature|object|vehicle|structure|scene|unknown\",\"pose\":\"standing|sitting|lying|floating|unknown\",\"reason\":\"short reason\"}",
    "Rules:",
    "- targetFaceCount must be integer between 500 and 5000",
    "- choose lower count for simple forms (for example plain house shell)",
    "- choose higher count for intricate shapes/details (for example stones, carved details, interior complexity)",
    "- identify the main object (objectLabel) and classify subjectKind",
    "- for character/animal/creature, determine pose (standing/sitting/lying/floating)",
    "- preserve silhouette-defining detail for detected posture",
    "- for non-creatures, set pose=unknown",
    "- reason max 20 words",
    "",
    `Model prompt context: ${input.prompt?.trim() || "none"}`,
    `Optional user context: ${input.context?.trim() || "none"}`
  ].join("\n");
}

async function suggestLowPolyTargetFaceCount(input: {
  prompt?: string;
  sourceImageInput?: string;
  context?: string;
  modelObject?: string;
  preferVisualModel?: boolean;
}): Promise<{
  targetFaceCount: number;
  sizeTier: RealWorldSizeTier;
  complexity: LowPolyComplexityLevel;
  objectLabel: string;
  subjectKind: VisualSubjectKind;
  pose: VisualSubjectPose;
  reason: string;
  usedVisionModel: boolean;
}> {
  const decisionPrompt = buildLowPolyComplexityDecisionPrompt({
    prompt: input.prompt,
    context: input.context,
    modelObject: input.modelObject
  });
  const sourceImageInput = input.sourceImageInput?.trim() ?? "";
  const canUseVisionModel = input.preferVisualModel === true && sourceImageInput.length > 0;
  if (canUseVisionModel) {
    try {
      const raw = await askVisionOllama(decisionPrompt, [sourceImageInput]);
      return parseLowPolyComplexityDecision(raw, true);
    } catch (error) {
      console.warn("Remote worker visual low poly suggestion failed. Falling back to text-only.", error);
    }
  }
  try {
    const raw = await askOllama(decisionPrompt, false);
    return parseLowPolyComplexityDecision(raw, false);
  } catch (error) {
    console.warn("Remote worker text low poly suggestion failed. Returning fallback.", error);
    return {
      targetFaceCount: appConfig.lowPolyDefaultTargetFaceCount,
      sizeTier: "medium",
      complexity: "moderate",
      objectLabel: "object",
      subjectKind: "unknown",
      pose: "unknown",
      reason: "Fallback decision.",
      usedVisionModel: false
    };
  }
}

async function suggestModelFileNameAndDescription(input: {
  prompt: string;
  sourceImageInput?: string;
  preferVisualModel?: boolean;
}): Promise<{ fileName: string | null; description: string | null; }> {
  const promptText = input.prompt.trim();
  if (!promptText) {
    return {
      fileName: null,
      description: null
    };
  }
  const suggestionPrompt = [
    "You create concise metadata for a generated 3D model.",
    "If a source image is attached, use BOTH the source image and the text prompt together.",
    "Given the context below, return JSON only with:",
    "{\"fileName\":\"short-file-name-without-extension\",\"description\":\"one short description\"}",
    "Rules:",
    "- fileName: 2-6 words, lowercase or snake_case, no extension",
    "- description: max 1 sentence",
    "- no markdown, no extra keys",
    "",
    "Text prompt context:",
    promptText
  ].join("\n");
  let response = "";
  if (input.preferVisualModel && input.sourceImageInput) {
    try {
      response = await askVisionOllama(suggestionPrompt, [input.sourceImageInput]);
    } catch (error) {
      console.warn("Remote worker visual metadata generation failed. Falling back to text-only metadata prompt.", error);
      response = "";
    }
  }
  if (!response) {
    response = await askOllama(suggestionPrompt, false);
  }
  const parsed = JSON.parse(extractJsonObjectText(response)) as Record<string, unknown>;
  return {
    fileName: normalizeModelNameCandidate(parsed.fileName),
    description: normalizeModelDescriptionCandidate(parsed.description)
  };
}

function hasValidWorkerSecret(request: IncomingMessage): boolean {
  const expected = appConfig.remoteWorkerSharedSecret.trim();
  if (!expected) {
    return true;
  }
  const provided = request.headers["x-remote-worker-secret"];
  if (Array.isArray(provided)) {
    return provided.some(value => value.trim() === expected);
  }
  return typeof provided === "string" && provided.trim() === expected;
}

function ensureAuthorized(request: IncomingMessage, response: ServerResponse): boolean {
  if (hasValidWorkerSecret(request)) {
    return true;
  }
  sendJson(response, 401, { error: "Remote worker secret mismatch." });
  return false;
}

type DependencyReadiness = "ready" | "not-configured" | "unavailable";

const workerProtocolVersion = 1;

async function getHttpReadiness(url: string, headers?: Record<string, string>): Promise<DependencyReadiness> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3_000);
  try {
    const response = await fetch(url, { headers, signal: controller.signal });
    return response.ok ? "ready" : "unavailable";
  } catch {
    return "unavailable";
  } finally {
    clearTimeout(timeout);
  }
}

function getActiveLlmReadiness(): Promise<DependencyReadiness> {
  if (appConfig.llmProvider === "ollama") {
    const baseUrl = appConfig.ollamaUrl.trim().replace(/\/api\/generate\/?$/, "").replace(/\/+$/, "");
    return getHttpReadiness(`${baseUrl}/api/tags`);
  }
  const baseUrl = appConfig.lmStudioBaseUrl.trim().replace(/\/+$/, "");
  const headers = appConfig.lmStudioApiKey ? {authorization: `Bearer ${appConfig.lmStudioApiKey}`} : undefined;
  return getHttpReadiness(`${baseUrl}/models`, headers);
}

function getComfyUiReadiness(): Promise<DependencyReadiness> {
  const baseUrl = appConfig.comfyUiBaseUrl.trim().replace(/\/+$/, "");
  return baseUrl ? getHttpReadiness(`${baseUrl}/system_stats`) : Promise.resolve("not-configured");
}

function getBlenderReadiness(): DependencyReadiness {
  const executablePath = appConfig.blenderExecutablePath.trim();
  return executablePath ? existsSync(executablePath) ? "ready" : "unavailable" : "not-configured";
}

async function getNvidiaGpuCapacity(): Promise<{source: "nvidia-smi" | "unavailable"; devices: Array<{name: string; totalMemoryMiB: number; freeMemoryMiB: number}>}> {
  try {
    const {stdout} = await execFileAsync("nvidia-smi", ["--query-gpu=name,memory.total,memory.free", "--format=csv,noheader,nounits"], {
      timeout: 3_000,
      windowsHide: true
    });
    const devices = stdout.split(/\r?\n/).map(line => {
      const parts = line.split(",").map(value => value.trim());
      const totalMemoryMiB = Number(parts.at(-2));
      const freeMemoryMiB = Number(parts.at(-1));
      const name = parts.slice(0, -2).join(", ").trim();
      return name && Number.isFinite(totalMemoryMiB) && Number.isFinite(freeMemoryMiB)
        ? {name, totalMemoryMiB: Math.max(0, Math.round(totalMemoryMiB)), freeMemoryMiB: Math.max(0, Math.round(freeMemoryMiB))}
        : null;
    }).filter((device): device is {name: string; totalMemoryMiB: number; freeMemoryMiB: number} => device !== null);
    return {source: "nvidia-smi", devices};
  } catch {
    return {source: "unavailable", devices: []};
  }
}

async function getWorkerCapacitySnapshot(): Promise<{
  cpuLogicalCores: number;
  memory: {totalMiB: number; freeMiB: number};
  gpu: {source: "nvidia-smi" | "unavailable"; devices: Array<{name: string; totalMemoryMiB: number; freeMemoryMiB: number}>};
}> {
  return {
    cpuLogicalCores: os.availableParallelism(),
    memory: {totalMiB: Math.round(os.totalmem() / 1024 / 1024), freeMiB: Math.round(os.freemem() / 1024 / 1024)},
    gpu: await getNvidiaGpuCapacity()
  };
}

async function getWorkerCapabilitySnapshot(): Promise<{
  protocolVersion: number;
  capabilities: {imageGeneration: boolean; model3dGeneration: boolean; comfyUi: DependencyReadiness; llm: DependencyReadiness; blender: DependencyReadiness};
  capacity: Awaited<ReturnType<typeof getWorkerCapacitySnapshot>>;
}> {
  const [comfyUi, llm, capacity] = await Promise.all([getComfyUiReadiness(), getActiveLlmReadiness(), getWorkerCapacitySnapshot()]);
  return {
    protocolVersion: workerProtocolVersion,
    capabilities: {
      imageGeneration: comfyUi === "ready",
      model3dGeneration: comfyUi === "ready",
      comfyUi,
      llm,
      blender: getBlenderReadiness()
    },
    capacity
  };
}

async function handlePostModel3dGenerate(request: IncomingMessage, response: ServerResponse, url: URL): Promise<void> {
  const body = await parseJsonBody(request);
  const imageInput = typeof body.imageInput === "string" ? body.imageInput.trim() : "";
  if (!imageInput) {
    sendJson(response, 400, { error: "imageInput is required." });
    return;
  }
  const rawMultiViewImageInputs = body.multiViewImageInputs && typeof body.multiViewImageInputs === "object" && !Array.isArray(body.multiViewImageInputs)
    ? body.multiViewImageInputs as Record<string, unknown>
    : null;
  const multiViewImageInputs = rawMultiViewImageInputs
    ? Object.fromEntries(["front", "back", "left", "right"].map(viewName => [
      viewName,
      typeof rawMultiViewImageInputs[viewName] === "string" ? rawMultiViewImageInputs[viewName].trim() : ""
    ]).filter(([, value]) => Boolean(value)))
    : undefined;
  const imageFileNameHint = typeof body.imageFileNameHint === "string" ? body.imageFileNameHint.trim() : "";
  const workflowPathOverride = typeof body.workflowPathOverride === "string" ? body.workflowPathOverride.trim() : "";
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const autoPrompt = body.autoPrompt === true;
  const stripMetadata = typeof body.stripMetadata === "boolean" ? body.stripMetadata : undefined;
  const resolvedPrompt = await resolveModelPrompt({
    prompt: prompt || undefined,
    autoPrompt
  });
  const generated = await generate3dModelFromImage({
    imageInput,
    multiViewImageInputs,
    imageFileNameHint: imageFileNameHint || undefined,
    workflowPathOverride: workflowPathOverride || undefined,
    prompt: resolvedPrompt || undefined,
    seed: typeof body.seed === "number" && Number.isFinite(body.seed) ? Math.max(0, Math.round(body.seed)) : undefined,
    stripMetadata
  });
  sendJson(response, 200, toGeneratedModelPublicRecord(generated));
}

async function handleGetModel3dFile(request: IncomingMessage, response: ServerResponse, url: URL): Promise<void> {
  const modelId = url.searchParams.get("modelId")?.trim() ?? "";
  const fileName = url.searchParams.get("file")?.trim() ?? "";
  if (!modelId || !fileName) {
    sendJson(response, 400, { error: "modelId and file are required." });
    return;
  }
  const file = await readGeneratedModelFile(modelId, fileName);
  sendBinary(response, 200, file.contentType, file.data);
}

async function handlePostModel3dInspect(request: IncomingMessage, response: ServerResponse, url: URL): Promise<void> {
  const body = await parseJsonBody(request);
  const modelId = typeof body.modelId === "string" ? body.modelId.trim() : "";
  const variant = body.variant === "original" || body.variant === "lowpoly" ? body.variant : "merged";
  if (!modelId) {
    sendJson(response, 400, { error: "modelId is required." });
    return;
  }
  sendJson(response, 200, await inspectGeneratedModelArtifact({ modelId, variant }));
}

async function handlePostModel3dValidate(request: IncomingMessage, response: ServerResponse, url: URL): Promise<void> {
  const body = await parseJsonBody(request);
  const modelId = typeof body.modelId === "string" ? body.modelId.trim() : "";
  const variant = body.variant === "original" || body.variant === "lowpoly" ? body.variant : "merged";
  if (!modelId) {
    sendJson(response, 400, { error: "modelId is required." });
    return;
  }
  sendJson(response, 200, await validateGeneratedModelArtifact({ modelId, variant }));
}

async function handlePostMediaProbe(request: IncomingMessage, response: ServerResponse, url: URL): Promise<void> {
  const body = await parseJsonBody(request) as Record<string, unknown>;
  const assetKind = body.assetKind === "audio" || body.assetKind === "video" ? body.assetKind : body.assetKind === "image" ? "image" : "";
  const fileName = typeof body.fileName === "string" ? body.fileName.trim() : "";
  if (!assetKind || !fileName) {
    sendJson(response, 400, { error: "assetKind and fileName are required." });
    return;
  }
  const absolutePath = assetKind === "audio"
    ? await resolveGeneratedAudioFilePath(typeof body.audioId === "string" ? body.audioId.trim() : "", fileName)
    : assetKind === "video"
      ? await resolveGeneratedVideoFilePath(typeof body.videoId === "string" ? body.videoId.trim() : "", fileName)
      : await resolveGeneratedImageFilePath(typeof body.imageId === "string" ? body.imageId.trim() : "", fileName);
  sendJson(response, 200, await probeFileWithRust(absolutePath));
}

function parseOptionalPositiveInteger(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    const rounded = Math.round(value);
    return rounded > 0 ? rounded : undefined;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseInt(value.trim(), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  }
  return undefined;
}
function parseOptionalRealWorldSizeTier(value: unknown): RealWorldSizeTier | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "tiny" || normalized === "small" || normalized === "medium" || normalized === "large" || normalized === "huge") {
    return normalized;
  }
  return undefined;
}
function parseOptionalRealWorldDimensions(value: unknown): RealWorldDimensions | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  const raw = value as {
    widthMeters?: unknown;
    heightMeters?: unknown;
    depthMeters?: unknown;
  };
  const widthMeters = parseOptionalPositiveNumber(raw.widthMeters);
  const heightMeters = parseOptionalPositiveNumber(raw.heightMeters);
  const depthMeters = parseOptionalPositiveNumber(raw.depthMeters);
  if (!widthMeters || !heightMeters || !depthMeters) {
    return undefined;
  }
  return {
    widthMeters,
    heightMeters,
    depthMeters
  };
}
function parseOptionalPositiveNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseFloat(value.trim().replace(",", "."));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  }
  return undefined;
}

async function handlePostModel3dLowPolyGenerate(request: IncomingMessage, response: ServerResponse, url: URL): Promise<void> {
  const body = await parseJsonBody(request);
  const modelId = typeof body.modelId === "string" ? body.modelId.trim() : "";
  if (!modelId) {
    sendJson(response, 400, { error: "modelId is required." });
    return;
  }
  const generated = await generateLowPolyModel({
    modelId,
    targetFaceCount: parseOptionalPositiveInteger(body.targetFaceCount),
    realWorldSizeTier: parseOptionalRealWorldSizeTier(body.realWorldSizeTier),
    realWorldReference: typeof body.realWorldReference === "string" ? body.realWorldReference.trim() : undefined,
    realWorldDimensions: parseOptionalRealWorldDimensions(body.realWorldDimensions),
    force: body.force === true,
    mergeVertices: typeof body.mergeVertices === "boolean" ? body.mergeVertices : undefined,
    shouldDecimate: typeof body.shouldDecimate === "boolean" ? body.shouldDecimate : undefined,
    maxColors: parseOptionalPositiveInteger(body.maxColors),
    blockSize: parseOptionalPositiveInteger(body.blockSize),
    newMeshName: typeof body.newMeshName === "string" ? body.newMeshName.trim() : undefined
  });
  sendJson(response, 200, generated);
}
async function handlePostModel3dLowPolyUpload(request: IncomingMessage, response: ServerResponse, url: URL): Promise<void> {
  const body = await parseJsonBody(request);
  const dataUrl = typeof body.dataUrl === "string" ? body.dataUrl.trim() : "";
  const requestedFileName = typeof body.fileName === "string" ? body.fileName.trim() : "uploaded-model.glb";
  const useLlmTargetFaces = body.llmTargetFaces === true;
  const targetFaceCountRaw = parseOptionalPositiveInteger(body.targetFaces);
  const renameLowPolyModelWithLlm = body.renameLowPolyModelWithLlm === true;
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const context = typeof body.context === "string" ? body.context.trim() : "";
  const parsedDataUrl = parseBase64DataUrl(dataUrl);
  if (!parsedDataUrl) {
    sendJson(response, 400, { error: "A valid base64 data URL is required." });
    return;
  }
  const fileData = Buffer.from(parsedDataUrl.base64Data, "base64");
  if (fileData.length === 0) {
    sendJson(response, 400, { error: "Uploaded model payload is empty." });
    return;
  }
  const imported = await importUploadedSourceModel({
    fileName: requestedFileName,
    fileData,
    contentType: parsedDataUrl.mimeType,
    prompt: prompt || undefined
  });
  let targetFaceCount = targetFaceCountRaw ?? appConfig.lowPolyDefaultTargetFaceCount;
  let suggestionReason: string | null = null;
  if (useLlmTargetFaces) {
    const suggestion = await suggestLowPolyTargetFaceCount({
      prompt: prompt || `Generate low poly from uploaded model file: ${requestedFileName}`,
      context: context || requestedFileName,
      preferVisualModel: false
    });
    targetFaceCount = suggestion.targetFaceCount;
    suggestionReason = suggestion.reason || null;
  }
  let generated = await generateLowPolyModel({
    modelId: imported.id,
    targetFaceCount,
    shouldDecimate: true
  });
  let renamedLowPolyFileName: string | null = null;
  if (renameLowPolyModelWithLlm && generated.lowPolyModelFileName) {
    try {
      const suggestionPrompt = [
        "Suggest a concise filename for this low poly 3D model.",
        `Context: ${context || requestedFileName}`,
        `Current file: ${generated.lowPolyModelFileName}`
      ].join("\n");
      const renameSuggestion = await suggestModelFileNameAndDescription({
        prompt: suggestionPrompt,
        preferVisualModel: false
      });
      const suggestedStem = normalizeModelNameCandidate(renameSuggestion.fileName);
      if (suggestedStem) {
        generated = await renameGeneratedLowPolyModelFileName(generated.id, suggestedStem);
        renamedLowPolyFileName = generated.lowPolyModelFileName;
      }
    } catch (error) {
      console.warn("Remote worker failed to apply LLM low poly filename suggestion. Continuing with original low poly file name.", error);
    }
  }
  sendJson(response, 200, {
    generated,
    targetFaceCount,
    suggestionReason,
    usedLlmTargetFaces: useLlmTargetFaces,
    decisionPreviewModelId: null,
    decisionPreviewImageFileName: null,
    renamedLowPolyFileName
  });
}

async function handlePostModel3dApplyMetallic(request: IncomingMessage, response: ServerResponse, url: URL): Promise<void> {
  const body = await parseJsonBody(request);
  const modelId = typeof body.modelId === "string" ? body.modelId.trim() : "";
  const metallicEnabled = body.metallicEnabled === true;
  if (!modelId) {
    sendJson(response, 400, { error: "modelId is required." });
    return;
  }
  const generated = await applyGeneratedModelMetallic({
    modelId,
    metallicEnabled
  });
  sendJson(response, 200, generated);
}
async function handlePostModel3dSeparateLooseParts(request: IncomingMessage, response: ServerResponse, url: URL): Promise<void> {
  const body = await parseJsonBody(request);
  const modelId = typeof body.modelId === "string" ? body.modelId.trim() : "";
  const exportMode = body.exportMode === "single_file" ? "single_file" : "per_part";
  const mergeDistance = typeof body.mergeDistance === "number" && Number.isFinite(body.mergeDistance)
    ? Math.max(0, body.mergeDistance)
    : undefined;
  if (!modelId) {
    sendJson(response, 400, { error: "modelId is required." });
    return;
  }
  const generated = await applyGeneratedModelSeparateByLooseParts({
    modelId,
    exportMode,
    mergeDistance
  });
  sendJson(response, 200, generated);
}
async function handlePostModel3dApplyScale(request: IncomingMessage, response: ServerResponse, url: URL): Promise<void> {
  const body = await parseJsonBody(request);
  const modelId = typeof body.modelId === "string" ? body.modelId.trim() : "";
  const targetHeightMeters = typeof body.targetHeightMeters === "number" && Number.isFinite(body.targetHeightMeters)
    ? Math.max(0.03, Math.min(4000, body.targetHeightMeters))
    : 1.8;
  if (!modelId) {
    sendJson(response, 400, { error: "modelId is required." });
    return;
  }
  const generated = await applyGeneratedModelScaleToHeight({
    modelId,
    targetHeightMeters
  });
  sendJson(response, 200, generated);
}

async function handlePostModel3dAutoRig(request: IncomingMessage, response: ServerResponse, url: URL): Promise<void> {
  const body = await parseJsonBody(request);
  const modelId = typeof body.modelId === "string" ? body.modelId.trim() : "";
  const rigProfile = typeof body.rigProfile === "string" ? body.rigProfile.trim() : "auto";
  const useVision = typeof body.useVision === "boolean" ? body.useVision : true;
  const landmarks = parseAutoRigLandmarks(body.landmarks);
  if (!modelId) {
    sendJson(response, 400, { error: "modelId is required." });
    return;
  }
  const llmSettings = resolveWorkerAutoRigLlmSettings();
  const generated = await applyGeneratedModelAutoRig({
    modelId,
    ...llmSettings,
    rigProfile: rigProfile || "auto",
    useVision,
    landmarks
  });
  sendJson(response, 200, generated);
}

async function handlePostModel3dAutoRigPreview(request: IncomingMessage, response: ServerResponse, url: URL): Promise<void> {
  const body = await parseJsonBody(request);
  const modelId = typeof body.modelId === "string" ? body.modelId.trim() : "";
  const rigProfile = typeof body.rigProfile === "string" ? body.rigProfile.trim() : "auto";
  const useVision = typeof body.useVision === "boolean" ? body.useVision : true;
  const landmarks = parseAutoRigLandmarks(body.landmarks);
  if (!modelId) {
    sendJson(response, 400, { error: "modelId is required." });
    return;
  }
  const llmSettings = resolveWorkerAutoRigLlmSettings();
  const preview = await previewGeneratedModelAutoRig({
    modelId,
    ...llmSettings,
    rigProfile: rigProfile || "auto",
    useVision,
    landmarks
  });
  sendJson(response, 200, preview);
}

async function handlePostBlenderOpenModel(request: IncomingMessage, response: ServerResponse, url: URL): Promise<void> {
  const body = await parseJsonBody(request);
  const assetPath = typeof body.assetPath === "string" ? body.assetPath.trim() : "";
  const label = typeof body.label === "string" ? body.label.trim() : "";
  if (!assetPath) {
    sendJson(response, 400, { error: "assetPath is required." });
    return;
  }
  const result = await blenderOpenService.openAssetInBlender({
    mode: "model",
    assetPath,
    label: label || undefined
  });
  sendJson(response, 200, result);
}

async function handlePostBlenderOpenImage(request: IncomingMessage, response: ServerResponse, url: URL): Promise<void> {
  const body = await parseJsonBody(request);
  const assetPath = typeof body.assetPath === "string" ? body.assetPath.trim() : "";
  const dataUrl = typeof body.dataUrl === "string" ? body.dataUrl.trim() : "";
  const fileName = typeof body.fileName === "string" ? body.fileName.trim() : "";
  const label = typeof body.label === "string" ? body.label.trim() : "";
  if (assetPath) {
    const result = await blenderOpenService.openAssetInBlender({
      mode: "image-plane",
      assetPath,
      label: label || fileName || undefined
    });
    sendJson(response, 200, result);
    return;
  }
  if (dataUrl) {
    const result = await blenderOpenService.openImageDataInBlender({
      dataUrl,
      fileName: fileName || undefined,
      label: label || fileName || undefined
    });
    sendJson(response, 200, result);
    return;
  }
  sendJson(response, 400, { error: "assetPath or dataUrl is required." });
}

async function handlePostBlenderOpenBatch(request: IncomingMessage, response: ServerResponse, url: URL): Promise<void> {
  const body = await parseJsonBody(request);
  const rawAssets = Array.isArray(body.assets) ? body.assets : [];
  const assets = rawAssets.map(asset => ({
    mode: asset?.mode === "image-plane" ? "image-plane" as const : "model" as const,
    assetPath: typeof asset?.assetPath === "string" ? asset.assetPath.trim() : undefined,
    dataUrl: typeof asset?.dataUrl === "string" ? asset.dataUrl.trim() : undefined,
    fileName: typeof asset?.fileName === "string" ? asset.fileName.trim() : undefined,
    label: typeof asset?.label === "string" ? asset.label.trim() : undefined
  })).filter(asset => asset.assetPath || asset.dataUrl);
  if (assets.length === 0) {
    sendJson(response, 400, { error: "assets are required." });
    return;
  }
  const result = await blenderOpenService.openAssetsInBlender({ assets });
  sendJson(response, 200, result);
}

async function handlePostImageGenerate(request: IncomingMessage, response: ServerResponse, url: URL): Promise<void> {
  const body = await parseJsonBody(request);
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const imageInput = typeof body.imageInput === "string" ? body.imageInput.trim() : "";
  const imageFileNameHint = typeof body.imageFileNameHint === "string" ? body.imageFileNameHint.trim() : "";
  const parseOptionalNumber = (value: unknown, min: number, max: number, integer = true): number | undefined => {
    const parsed = typeof value === "number" ? value : Number.NaN;
    if (!Number.isFinite(parsed)) {
      return undefined;
    }
    const clamped = Math.min(max, Math.max(min, parsed));
    return integer ? Math.round(clamped) : clamped;
  };
  const autoPrompt = body.autoPrompt === true;
  const resolvedPrompt = imageInput
    ? await (async () => {
      const basePrompt = await resolveImagePromptFromBaseImage({
        imageInput,
        prompt: prompt || undefined
      });
      if (!autoPrompt) {
        return basePrompt;
      }
      return resolveImagePrompt({
        prompt: basePrompt,
        autoPrompt: true
      });
    })()
    : await resolveImagePrompt({
      prompt: prompt || undefined,
      autoPrompt
    });
  const generated = await generateImageFromPrompt({
    prompt: resolvedPrompt,
    imageInput: imageInput || undefined,
    imageFileNameHint: imageFileNameHint || undefined,
    width: parseOptionalNumber(body.width, 64, 4096),
    height: parseOptionalNumber(body.height, 64, 4096),
    seed: parseOptionalNumber(body.seed, 0, Number.MAX_SAFE_INTEGER),
    steps: parseOptionalNumber(body.steps, 1, 250),
    cfg: parseOptionalNumber(body.cfg, 0, 30, false)
  });
  sendJson(response, 200, toGeneratedImagePublicRecord(generated));
}

async function handleGetGeneratedImageFile(request: IncomingMessage, response: ServerResponse, url: URL): Promise<void> {
  const imageId = url.searchParams.get("imageId")?.trim() ?? "";
  const fileName = url.searchParams.get("file")?.trim() ?? "";
  if (!imageId || !fileName) {
    sendJson(response, 400, { error: "imageId and file are required." });
    return;
  }
  const file = await readGeneratedImageFile(imageId, fileName);
  sendBinary(response, 200, file.contentType, file.data);
}

async function handlePostModel3dSuggestMetadata(request: IncomingMessage, response: ServerResponse, url: URL): Promise<void> {
  const body = await parseJsonBody(request);
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const sourceImageInput = typeof body.imageInput === "string" ? body.imageInput.trim() : "";
  const preferVisualModel = body.preferVisualModel === true;
  const fallbackPrompt = prompt || (sourceImageInput
    ? "Generate a concise file name and one short description for this source image."
    : "");
  if (!fallbackPrompt) {
    sendJson(response, 200, { fileName: null, description: null });
    return;
  }
  const suggestion = await suggestModelFileNameAndDescription({
    prompt: fallbackPrompt,
    sourceImageInput: sourceImageInput || undefined,
    preferVisualModel
  });
  sendJson(response, 200, suggestion);
}
async function handlePostModel3dSuggestLowPoly(request: IncomingMessage, response: ServerResponse, url: URL): Promise<void> {
  const body = await parseJsonBody(request);
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const sourceImageInput = typeof body.imageInput === "string" ? body.imageInput.trim() : "";
  const context = typeof body.context === "string" ? body.context.trim() : "";
  const preferVisualModel = body.preferVisualModel === true;
  const suggestion = await suggestLowPolyTargetFaceCount({
    prompt: prompt || undefined,
    sourceImageInput: sourceImageInput || undefined,
    context: context || undefined,
    preferVisualModel
  });
  sendJson(response, 200, suggestion);
}

async function handlePostModel3dSuggestMetallic(request: IncomingMessage, response: ServerResponse, url: URL): Promise<void> {
  const body = await parseJsonBody(request);
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const sourceImageInput = typeof body.imageInput === "string" ? body.imageInput.trim() : "";
  const context = typeof body.context === "string" ? body.context.trim() : "";
  const preferVisualModel = body.preferVisualModel === true;
  const suggestion = await suggestModelMetallicDecision({
    promptContext: prompt || undefined,
    sourceImageInput: sourceImageInput || undefined,
    extraContext: context || undefined,
    preferVisualModel
  });
  sendJson(response, 200, suggestion);
}
async function handlePostModel3dSuggestRealWorldHeight(request: IncomingMessage, response: ServerResponse, url: URL): Promise<void> {
  const body = await parseJsonBody(request);
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const sourceImageInput = typeof body.imageInput === "string" ? body.imageInput.trim() : "";
  const context = typeof body.context === "string" ? body.context.trim() : "";
  const preferVisualModel = body.preferVisualModel === true;
  const suggestion = await suggestModelRealWorldHeight({
    promptContext: prompt || undefined,
    sourceImageInput: sourceImageInput || undefined,
    extraContext: context || undefined,
    preferVisualModel
  });
  sendJson(response, 200, suggestion);
}

async function handlePostModel3dIndex(request: IncomingMessage, response: ServerResponse, url: URL): Promise<void> {
  await parseJsonBody(request);
  sendJson(response, 200, await indexGeneratedModelStoreWithRust());
}

async function handlePostLlmEjectActive(request: IncomingMessage, response: ServerResponse, url: URL): Promise<void> {
  const result = await ejectActiveOllamaModels();
  sendJson(response, 200, result);
}
async function handlePostLlmLoadActive(request: IncomingMessage, response: ServerResponse, url: URL): Promise<void> {
  const body = await parseJsonBody(request);
  const scope = body.scope === "text" || body.scope === "vision" ? body.scope : "both";
  const contextLength = typeof body.contextLength === "number" && Number.isFinite(body.contextLength)
    ? Math.max(0, Math.round(body.contextLength))
    : undefined;
  const result = await loadActiveOllamaModels(scope, { lmStudioContextLength: contextLength });
  sendJson(response, 200, result);
}
async function handlePostComfySettings(request: IncomingMessage, response: ServerResponse, url: URL): Promise<void> {
  const body = await parseJsonBody(request);
  const settings = updateComfyRuntimeSettings({
    comfyUiBaseUrl: typeof body.comfyUiBaseUrl === "string" ? body.comfyUiBaseUrl : undefined,
    comfyUiModelBaseUrl: typeof body.comfyUiModelBaseUrl === "string" ? body.comfyUiModelBaseUrl : undefined,
    comfyUiImageBaseUrl: typeof body.comfyUiImageBaseUrl === "string" ? body.comfyUiImageBaseUrl : undefined,
    comfyUiAudioBaseUrl: typeof body.comfyUiAudioBaseUrl === "string" ? body.comfyUiAudioBaseUrl : undefined,
    comfyUiMusicBaseUrl: typeof body.comfyUiMusicBaseUrl === "string" ? body.comfyUiMusicBaseUrl : undefined,
    comfyUiVideoBaseUrl: typeof body.comfyUiVideoBaseUrl === "string" ? body.comfyUiVideoBaseUrl : undefined,
    comfyUiInputDir: typeof body.comfyUiInputDir === "string" ? body.comfyUiInputDir : undefined,
    comfyUiModelWorkflowPath: typeof body.comfyUiModelWorkflowPath === "string" ? body.comfyUiModelWorkflowPath : undefined,
    comfyUiImageWorkflowPath: typeof body.comfyUiImageWorkflowPath === "string" ? body.comfyUiImageWorkflowPath : undefined,
    comfyUiImageEditWorkflowPath: typeof body.comfyUiImageEditWorkflowPath === "string" ? body.comfyUiImageEditWorkflowPath : undefined,
    comfyUiImageLayeredWorkflowPath: typeof body.comfyUiImageLayeredWorkflowPath === "string" ? body.comfyUiImageLayeredWorkflowPath : undefined,
    comfyUiAudioWorkflowPath: typeof body.comfyUiAudioWorkflowPath === "string" ? body.comfyUiAudioWorkflowPath : undefined,
    comfyUiMusicWorkflowPath: typeof body.comfyUiMusicWorkflowPath === "string" ? body.comfyUiMusicWorkflowPath : undefined,
    comfyUiVideoWorkflowPath: typeof body.comfyUiVideoWorkflowPath === "string" ? body.comfyUiVideoWorkflowPath : undefined,
    comfyUiVideoImageWorkflowPath: typeof body.comfyUiVideoImageWorkflowPath === "string" ? body.comfyUiVideoImageWorkflowPath : undefined
  });
  sendJson(response, 200, settings);
}

const postRouteHandlers = new Map<string, WorkerHandler>([
  ["/api/model3d-generate", handlePostModel3dGenerate],
  ["/api/model3d-inspect", handlePostModel3dInspect],
  ["/api/model3d-validate", handlePostModel3dValidate],
  ["/api/model3d-index", handlePostModel3dIndex],
  ["/api/media-probe", handlePostMediaProbe],
  ["/api/model3d-lowpoly-generate", handlePostModel3dLowPolyGenerate],
  ["/api/model3d-lowpoly-upload", handlePostModel3dLowPolyUpload],
  ["/api/model3d-separate-loose-parts", handlePostModel3dSeparateLooseParts],
  ["/api/model3d-apply-metallic", handlePostModel3dApplyMetallic],
  ["/api/model3d-apply-scale", handlePostModel3dApplyScale],
  ["/api/model3d-autorig", handlePostModel3dAutoRig],
  ["/api/model3d-autorig-preview", handlePostModel3dAutoRigPreview],
  ["/api/blender-open-model", handlePostBlenderOpenModel],
  ["/api/blender-open-image", handlePostBlenderOpenImage],
  ["/api/blender-open-batch", handlePostBlenderOpenBatch],
  ["/api/image-generate", handlePostImageGenerate],
  ["/api/model3d-suggest-metadata", handlePostModel3dSuggestMetadata],
  ["/api/model3d-suggest-lowpoly", handlePostModel3dSuggestLowPoly],
  ["/api/model3d-suggest-metallic", handlePostModel3dSuggestMetallic],
  ["/api/model3d-suggest-realworld-height", handlePostModel3dSuggestRealWorldHeight],
  ["/api/llm-eject-active", handlePostLlmEjectActive],
  ["/api/llm-load-active", handlePostLlmLoadActive],
  ["/api/comfy-settings", handlePostComfySettings]
]);

const getRouteHandlers = new Map<string, WorkerHandler>([
  ["/api/model3d-file", handleGetModel3dFile],
  ["/api/generated-image-file", handleGetGeneratedImageFile]
]);

async function handleWorkerRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const requestId = createRequestId();
  const url = new URL(request.url || "/", `http://${request.headers.host || "127.0.0.1"}`);
  if (url.pathname === "/health") {
    sendJson(response, 200, { ok: true });
    return;
  }
  if (!ensureAuthorized(request, response)) {
    return;
  }
  if (url.pathname === "/capabilities") {
    const snapshot = await getWorkerCapabilitySnapshot();
    sendJson(response, 200, {ok: true, service: "remote-worker", ...snapshot});
    return;
  }
  if (url.pathname === "/ready") {
    const snapshot = await getWorkerCapabilitySnapshot();
    const ok = snapshot.capabilities.comfyUi === "ready";
    sendJson(response, ok ? 200 : 503, {
      ok,
      service: "remote-worker",
      checks: snapshot.capabilities
    });
    return;
  }
  const method = request.method === "POST" || request.method === "GET" ? request.method : "";
  const routeTable = method === "POST" ? postRouteHandlers : method === "GET" ? getRouteHandlers : null;
  if (!routeTable) {
    sendJson(response, 405, { error: "Method not allowed." });
    return;
  }
  const handler = routeTable.get(url.pathname);
  if (!handler) {
    sendJson(response, 404, { error: "Not found." });
    return;
  }
  try {
    await handler(request, response, url);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const redactedDetail = redactLogText(detail);
    recordRuntimeFailure({source: "remote-worker:http", requestId, method, path: url.pathname, detail: redactedDetail});
    console.error(JSON.stringify({event: "remote-worker.request.failed", requestId, method, path: url.pathname, detail: redactedDetail}));
    sendJson(response, 500, { error: "Remote worker request failed.", requestId });
  }
}

const server = createServer((request, response) => {
  void handleWorkerRequest(request, response);
});

server.listen(appConfig.remoteWorkerPort, appConfig.remoteWorkerBindHost, () => {
  console.log(`Remote worker listening on http://${appConfig.remoteWorkerBindHost}:${appConfig.remoteWorkerPort}`);
  console.log(`Remote worker process user: ${os.userInfo().username}`);
});
