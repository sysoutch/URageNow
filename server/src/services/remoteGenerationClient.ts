import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { appConfig } from "../config/appConfig.js";
import type { ComfyRuntimeSettings } from "./comfyRuntimeSettings.js";
import {
  getGeneratedModelPublicById,
  importGeneratedModelArtifact,
  importGeneratedModelLowPolyArtifact,
  syncGeneratedModelArtifact,
  toGeneratedModelPublicRecord,
  type GenerateLowPolyModelInput,
  type GenerateModelInput,
  type GeneratedModelPublicRecord,
  type GeneratedModelRecord
} from "./model3d.js";
import {
  importGeneratedImageArtifact,
  type GeneratedImagePublicRecord,
  type GeneratedImageRecord
} from "./generatedMediaLibrary.js";
import type { GenerateImageInput } from "./imageGeneration.js";
import {
  normalizeVisualObjectLabel,
  normalizeVisualSubjectKind,
  normalizeVisualSubjectPose,
  upsertCachedVisualInterpretation
} from "./modelMetadataHelpers.js";
import type { ProbeGeneratedMediaInput, RustMediaProbeResult } from "@urage/shared/media/probeContracts";
import type { RustAssetIndexResult } from "@urage/shared/model3d/assetIndexContracts";
import type { RustAssetValidationResult } from "./model3d/assetValidator.js";
import type { ModelMetallicDecision } from "./model3d/modelMetallicDecision.js";
import type { RustModelInspectionResult } from "./model3d/modelInspector.js";
import type { ModelRealWorldHeightDecision } from "./model3d/modelRealWorldHeightDecision.js";

type DependencyReadiness = "ready" | "not-configured" | "unavailable";
type RemoteWorkerCapabilityName = "imageGeneration" | "model3dGeneration" | "llm" | "blender";

type RemoteWorkerCapabilities = {
  protocolVersion: number;
  capabilities: {
    imageGeneration: boolean;
    model3dGeneration: boolean;
    comfyUi: DependencyReadiness;
    llm: DependencyReadiness;
    blender: DependencyReadiness;
  };
};

const remoteWorkerProtocolVersion = 1;
const remoteWorkerCapabilityCacheTtlMs = 5_000;
let remoteWorkerCapabilitiesCache: {expiresAt: number; value: RemoteWorkerCapabilities} | null = null;

function normalizePossibleFilePath(input: string): string {
  const trimmed = input.trim().replace(/^"(.*)"$/, "$1");
  if (trimmed.startsWith("file://")) {
    return fileURLToPath(trimmed);
  }
  return trimmed;
}

function extensionToMimeType(extension: string): string {
  const normalized = extension.toLowerCase();
  if (normalized === ".png") {
    return "image/png";
  }
  if (normalized === ".jpg" || normalized === ".jpeg") {
    return "image/jpeg";
  }
  if (normalized === ".webp") {
    return "image/webp";
  }
  if (normalized === ".gif") {
    return "image/gif";
  }
  if (normalized === ".bmp") {
    return "image/bmp";
  }
  if (normalized === ".tif" || normalized === ".tiff") {
    return "image/tiff";
  }
  return "image/png";
}

function buildRemoteWorkerUrl(pathname: string): string {
  const baseUrl = appConfig.remoteWorkerBaseUrl.trim();
  if (!baseUrl) {
    throw new Error("REMOTE_WORKER_BASE_URL is required for remote execution mode.");
  }
  const base = new URL(baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  const suffix = pathname.startsWith("/") ? pathname.slice(1) : pathname;
  return new URL(suffix, base).toString();
}

function buildRemoteWorkerHeaders(includeJsonContentType: boolean): Record<string, string> {
  const headers: Record<string, string> = includeJsonContentType
    ? { "content-type": "application/json" }
    : {};
  const secret = appConfig.remoteWorkerSharedSecret.trim();
  if (secret) {
    headers["x-remote-worker-secret"] = secret;
  }
  return headers;
}

function getRequiredRemoteWorkerCapability(pathname: string): RemoteWorkerCapabilityName | null {
  if (pathname === "/api/image-generate") {
    return "imageGeneration";
  }
  if (pathname.startsWith("/api/model3d-suggest-") || pathname.startsWith("/api/llm-")) {
    return "llm";
  }
  if (pathname.startsWith("/api/blender-")) {
    return "blender";
  }
  if (pathname.startsWith("/api/model3d-lowpoly-") || pathname.startsWith("/api/model3d-separate-")
    || pathname === "/api/model3d-apply-metallic" || pathname === "/api/model3d-apply-scale" || pathname.startsWith("/api/model3d-autorig")) {
    return "blender";
  }
  if (pathname.startsWith("/api/model3d-generate")) {
    return "model3dGeneration";
  }
  return null;
}

function isRemoteWorkerCapabilities(value: unknown): value is RemoteWorkerCapabilities {
  if (!value || typeof value !== "object") {
    return false;
  }
  const snapshot = value as Partial<RemoteWorkerCapabilities>;
  const capabilities = snapshot.capabilities;
  if (!capabilities) {
    return false;
  }
  return snapshot.protocolVersion === remoteWorkerProtocolVersion
    && typeof capabilities.imageGeneration === "boolean"
    && typeof capabilities.model3dGeneration === "boolean"
    && (capabilities.llm === "ready" || capabilities.llm === "not-configured" || capabilities.llm === "unavailable")
    && (capabilities.blender === "ready" || capabilities.blender === "not-configured" || capabilities.blender === "unavailable");
}

async function getRemoteWorkerCapabilities(): Promise<RemoteWorkerCapabilities> {
  if (remoteWorkerCapabilitiesCache && remoteWorkerCapabilitiesCache.expiresAt > Date.now()) {
    return remoteWorkerCapabilitiesCache.value;
  }
  const response = await fetch(buildRemoteWorkerUrl("/capabilities"), {headers: buildRemoteWorkerHeaders(false)});
  const payload = await response.json().catch(() => null) as unknown;
  if (!response.ok || !isRemoteWorkerCapabilities(payload)) {
    throw new Error("Remote worker capability handshake failed. Check its URL, shared secret, and protocol version.");
  }
  remoteWorkerCapabilitiesCache = {value: payload, expiresAt: Date.now() + remoteWorkerCapabilityCacheTtlMs};
  return payload;
}

async function ensureRemoteWorkerCapability(pathname: string): Promise<void> {
  const capability = getRequiredRemoteWorkerCapability(pathname);
  if (!capability) {
    return;
  }
  const snapshot = await getRemoteWorkerCapabilities();
  const available = capability === "llm" || capability === "blender"
    ? snapshot.capabilities[capability] === "ready"
    : snapshot.capabilities[capability];
  if (!available) {
    throw new Error(`Remote worker cannot run this request: ${capability} is unavailable.`);
  }
}

async function fetchRemoteJson<TResponse>(pathname: string, payload: unknown): Promise<TResponse> {
  await ensureRemoteWorkerCapability(pathname);
  const response = await fetch(buildRemoteWorkerUrl(pathname), {
    method: "POST",
    headers: buildRemoteWorkerHeaders(true),
    body: JSON.stringify(payload)
  });
  const raw = await response.text();
  const parsed = raw.trim().length > 0 ? JSON.parse(raw) as unknown : {};
  if (!response.ok) {
    const errorMessage = typeof parsed === "object" && parsed !== null && typeof (parsed as { error?: unknown }).error === "string"
      ? (parsed as { error: string }).error
      : `Remote worker request failed (${response.status}).`;
    throw new Error(errorMessage);
  }
  return parsed as TResponse;
}

async function fetchRemoteBinary(pathname: string): Promise<Buffer> {
  const response = await fetch(buildRemoteWorkerUrl(pathname), {
    headers: buildRemoteWorkerHeaders(false)
  });
  if (!response.ok) {
    throw new Error(`Remote worker binary request failed (${response.status}) for ${pathname}.`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function normalizeRemoteModelImageInput(imageInput: string): Promise<string> {
  const trimmed = imageInput.trim();
  if (!trimmed) {
    throw new Error("An image input is required for 3D model generation.");
  }
  if (/^data:image\/[a-z0-9.+-]+;base64,/i.test(trimmed) || /^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  const localPath = normalizePossibleFilePath(trimmed);
  const bytes = await readFile(localPath);
  const mimeType = extensionToMimeType(path.extname(localPath));
  return `data:${mimeType};base64,${bytes.toString("base64")}`;
}

function listGeneratedModelRemoteFiles(record: GeneratedModelPublicRecord): string[] {
  return [
    record.modelFileName,
    record.originalModelFileName,
    record.lowPolyModelFileName,
    record.lowPolyPreviewImageFileName,
    record.lowPolyPreviewGifFileName,
    record.previewGifFileName,
    record.previewImageFileName,
    record.uvMapFileName,
    record.uvMapInpaintFileName,
    record.normalMapFileName,
    ...record.multiViewFileNames
  ].filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
}

function listOptionalGeneratedModelRemoteFiles(record: GeneratedModelPublicRecord): string[] {
  return [record.sourceImageFileName]
    .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
}

async function fetchRemoteModelArtifactFiles(generated: GeneratedModelPublicRecord): Promise<Array<{ fileName: string; data: Buffer }>> {
  const fileNames = listGeneratedModelRemoteFiles(generated);
  const files = await Promise.all(fileNames.map(async fileName => ({
    fileName,
    data: await fetchRemoteBinary(`/api/model3d-file?modelId=${encodeURIComponent(generated.id)}&file=${encodeURIComponent(fileName)}`)
  })));
  for (const optionalFileName of listOptionalGeneratedModelRemoteFiles(generated)) {
    try {
      files.push({
        fileName: optionalFileName,
        data: await fetchRemoteBinary(`/api/model3d-file?modelId=${encodeURIComponent(generated.id)}&file=${encodeURIComponent(optionalFileName)}`)
      });
    } catch {
      continue;
    }
  }
  return files;
}

async function importOrSyncRemoteGeneratedModel(generated: GeneratedModelPublicRecord): Promise<GeneratedModelPublicRecord> {
  const files = await fetchRemoteModelArtifactFiles(generated);
  const existing = await getGeneratedModelPublicById(generated.id);
  if (existing) {
    return syncGeneratedModelArtifact({
      modelId: generated.id,
      record: generated,
      files
    });
  }
  return toGeneratedModelPublicRecord(await importGeneratedModelArtifact({
    record: generated,
    files
  }));
}

export async function generate3dModelViaRemoteWorker(input: GenerateModelInput): Promise<GeneratedModelRecord> {
  const imageInput = await normalizeRemoteModelImageInput(input.imageInput);
  const multiViewImageInputs = input.multiViewImageInputs
    ? Object.fromEntries(await Promise.all(Object.entries(input.multiViewImageInputs).map(async ([viewName, viewInput]) => [
      viewName,
      viewInput ? await normalizeRemoteModelImageInput(viewInput) : ""
    ])))
    : undefined;
  const generated = await fetchRemoteJson<GeneratedModelPublicRecord>("/api/model3d-generate", {
    imageInput,
    multiViewImageInputs,
    imageFileNameHint: input.imageFileNameHint,
    workflowPathOverride: input.workflowPathOverride,
    prompt: input.prompt,
    seed: input.seed,
    postToChannel: false,
    stripMetadata: input.stripMetadata === true
  });
  const synced = await importOrSyncRemoteGeneratedModel(generated);
  return synced;
}

export async function inspectModelArtifactViaRemoteWorker(input: {
  modelId: string;
  variant?: "merged" | "original" | "lowpoly" | "albedo";
}): Promise<RustModelInspectionResult> {
  const modelId = input.modelId.trim();
  if (!modelId) {
    throw new Error("modelId is required for remote model inspection.");
  }
  return fetchRemoteJson<RustModelInspectionResult>("/api/model3d-inspect", {
    modelId,
    variant: input.variant ?? "merged"
  });
}

export async function validateModelArtifactViaRemoteWorker(input: {
  modelId: string;
  variant?: "merged" | "original" | "lowpoly" | "albedo";
}): Promise<RustAssetValidationResult> {
  const modelId = input.modelId.trim();
  if (!modelId) {
    throw new Error("modelId is required for remote model validation.");
  }
  return fetchRemoteJson<RustAssetValidationResult>("/api/model3d-validate", {
    modelId,
    variant: input.variant ?? "merged"
  });
}

export async function indexGeneratedModelAssetsViaRemoteWorker(): Promise<RustAssetIndexResult> {
  return fetchRemoteJson<RustAssetIndexResult>("/api/model3d-index", {});
}

export async function probeMediaAssetViaRemoteWorker(input: ProbeGeneratedMediaInput): Promise<RustMediaProbeResult> {
  return fetchRemoteJson<RustMediaProbeResult>("/api/media-probe", input);
}

export async function generateSplitByLoosePartsModelViaRemoteWorker(input: {
  modelId: string;
  exportMode?: "per_part" | "single_file";
  mergeDistance?: number;
}): Promise<{
  generated: GeneratedModelPublicRecord | null;
  models: GeneratedModelPublicRecord[];
  partCount: number;
  exportMode: "per_part" | "single_file";
}> {
  const modelId = input.modelId.trim();
  if (!modelId) {
    throw new Error("modelId is required for remote loose parts separation.");
  }
  const payload = await fetchRemoteJson<{
    generated?: GeneratedModelPublicRecord | null;
    models?: GeneratedModelPublicRecord[];
    partCount?: number;
    exportMode?: "per_part" | "single_file";
  }>("/api/model3d-separate-loose-parts", {
    modelId,
    exportMode: input.exportMode,
    mergeDistance: input.mergeDistance
  });
  const remoteModels = Array.isArray(payload.models) ? payload.models : [];
  const syncedModels: GeneratedModelPublicRecord[] = [];
  for (const generated of remoteModels) {
    syncedModels.push(await importOrSyncRemoteGeneratedModel(generated));
  }
  return {
    generated: syncedModels[0] ?? null,
    models: syncedModels,
    partCount: typeof payload.partCount === "number" && Number.isFinite(payload.partCount)
      ? Math.max(0, Math.round(payload.partCount))
      : syncedModels.length,
    exportMode: payload.exportMode === "single_file" ? "single_file" : "per_part"
  };
}

export async function generateLowPolyModelViaRemoteWorker(input: GenerateLowPolyModelInput): Promise<GeneratedModelPublicRecord> {
  const modelId = input.modelId.trim();
  if (!modelId) {
    throw new Error("modelId is required for remote low poly generation.");
  }
  const generated = await fetchRemoteJson<GeneratedModelPublicRecord>("/api/model3d-lowpoly-generate", {
    modelId,
    targetFaceCount: input.targetFaceCount,
    realWorldSizeTier: input.realWorldSizeTier,
    realWorldReference: input.realWorldReference,
    realWorldDimensions: input.realWorldDimensions,
    force: input.force === true,
    mergeVertices: input.mergeVertices,
    shouldDecimate: input.shouldDecimate,
    maxColors: input.maxColors,
    blockSize: input.blockSize,
    newMeshName: input.newMeshName
  });
  const lowPolyFileName = generated.lowPolyModelFileName?.trim() ?? "";
  if (!lowPolyFileName) {
    throw new Error("Remote low poly generation finished without output file.");
  }
  const lowPolyFileData = await fetchRemoteBinary(`/api/model3d-file?modelId=${encodeURIComponent(generated.id)}&file=${encodeURIComponent(lowPolyFileName)}`);
  let lowPolyPreviewImageFileData: Buffer | null = null;
  const lowPolyPreviewImageFileName = generated.lowPolyPreviewImageFileName?.trim() ?? "";
  if (lowPolyPreviewImageFileName) {
    try {
      lowPolyPreviewImageFileData = await fetchRemoteBinary(`/api/model3d-file?modelId=${encodeURIComponent(generated.id)}&file=${encodeURIComponent(lowPolyPreviewImageFileName)}`);
    } catch (error) {
      console.warn("Failed to fetch remote low poly preview image. Continuing without it.", error);
      lowPolyPreviewImageFileData = null;
    }
  }
  let lowPolyPreviewGifFileData: Buffer | null = null;
  const lowPolyPreviewGifFileName = generated.lowPolyPreviewGifFileName?.trim() ?? "";
  if (lowPolyPreviewGifFileName) {
    try {
      lowPolyPreviewGifFileData = await fetchRemoteBinary(`/api/model3d-file?modelId=${encodeURIComponent(generated.id)}&file=${encodeURIComponent(lowPolyPreviewGifFileName)}`);
    } catch (error) {
      console.warn("Failed to fetch remote low poly preview GIF. Continuing without it.", error);
      lowPolyPreviewGifFileData = null;
    }
  }
  return importGeneratedModelLowPolyArtifact({
    modelId,
    lowPolyFileName,
    lowPolyFileData,
    lowPolyPreviewImageFileName: lowPolyPreviewImageFileName || null,
    lowPolyPreviewImageData: lowPolyPreviewImageFileData,
    lowPolyPreviewGifFileName: lowPolyPreviewGifFileName || null,
    lowPolyPreviewGifData: lowPolyPreviewGifFileData,
    lowPolyTargetFaceCount: generated.lowPolyTargetFaceCount,
    lowPolyRealWorldSizeTier: generated.lowPolyRealWorldSizeTier,
    lowPolyRealWorldReference: generated.lowPolyRealWorldReference,
    lowPolyRealWorldDimensions: generated.lowPolyRealWorldWidthMeters
      && generated.lowPolyRealWorldHeightMeters
      && generated.lowPolyRealWorldDepthMeters
      ? {
        widthMeters: generated.lowPolyRealWorldWidthMeters,
        heightMeters: generated.lowPolyRealWorldHeightMeters,
        depthMeters: generated.lowPolyRealWorldDepthMeters
      }
      : null
  });
}

export async function generateLowPolyFromUploadedModelViaRemoteWorker(input: {
  fileName: string;
  fileData: Buffer;
  contentType?: string;
  useLlmTargetFaces?: boolean;
  targetFaceCount?: number;
  prompt?: string;
  context?: string;
  renameLowPolyModelWithLlm?: boolean;
}): Promise<{
  generated: GeneratedModelPublicRecord;
  targetFaceCount: number;
  suggestionReason: string | null;
  usedLlmTargetFaces: boolean;
  decisionPreviewModelId: string | null;
  decisionPreviewImageFileName: string | null;
  renamedLowPolyFileName: string | null;
}> {
  if (!input.fileData || input.fileData.length === 0) {
    throw new Error("Uploaded model payload is empty.");
  }
  const fileName = input.fileName.trim() || "uploaded-model.glb";
  const contentType = input.contentType?.trim() || "application/octet-stream";
  const dataUrl = `data:${contentType};base64,${input.fileData.toString("base64")}`;
  const payload = await fetchRemoteJson<{
    generated: GeneratedModelPublicRecord;
    targetFaceCount?: number;
    suggestionReason?: string | null;
    usedLlmTargetFaces?: boolean;
    decisionPreviewModelId?: string | null;
    decisionPreviewImageFileName?: string | null;
    renamedLowPolyFileName?: string | null;
  }>("/api/model3d-lowpoly-upload", {
    fileName,
    dataUrl,
    llmTargetFaces: input.useLlmTargetFaces === true,
    targetFaces: input.targetFaceCount,
    prompt: input.prompt,
    context: input.context,
    renameLowPolyModelWithLlm: input.renameLowPolyModelWithLlm === true
  });
  const generated = payload.generated;
  if (!generated || typeof generated.id !== "string" || !generated.id.trim()) {
    throw new Error("Remote low poly upload finished without a generated model id.");
  }
  const importedRecord = await importOrSyncRemoteGeneratedModel(generated);
  return {
    generated: importedRecord,
    targetFaceCount: typeof payload.targetFaceCount === "number" && Number.isFinite(payload.targetFaceCount)
      ? Math.max(1, Math.round(payload.targetFaceCount))
      : appConfig.lowPolyDefaultTargetFaceCount,
    suggestionReason: typeof payload.suggestionReason === "string" && payload.suggestionReason.trim()
      ? payload.suggestionReason.trim()
      : null,
    usedLlmTargetFaces: payload.usedLlmTargetFaces === true,
    decisionPreviewModelId: typeof payload.decisionPreviewModelId === "string" && payload.decisionPreviewModelId.trim()
      ? payload.decisionPreviewModelId.trim()
      : null,
    decisionPreviewImageFileName: typeof payload.decisionPreviewImageFileName === "string" && payload.decisionPreviewImageFileName.trim()
      ? payload.decisionPreviewImageFileName.trim()
      : null,
    renamedLowPolyFileName: typeof payload.renamedLowPolyFileName === "string" && payload.renamedLowPolyFileName.trim()
      ? payload.renamedLowPolyFileName.trim()
      : null
  };
}

export async function applyModelMetallicViaRemoteWorker(input: {
  modelId: string;
  metallicEnabled: boolean;
}): Promise<GeneratedModelPublicRecord> {
  const modelId = input.modelId.trim();
  if (!modelId) {
    throw new Error("modelId is required for remote metallic apply.");
  }
  const generated = await fetchRemoteJson<GeneratedModelPublicRecord>("/api/model3d-apply-metallic", {
    modelId,
    metallicEnabled: input.metallicEnabled === true
  });
  const fileNames = listGeneratedModelRemoteFiles(generated);
  const files = await Promise.all(fileNames.map(async fileName => ({
    fileName,
    data: await fetchRemoteBinary(`/api/model3d-file?modelId=${encodeURIComponent(generated.id)}&file=${encodeURIComponent(fileName)}`)
  })));
  for (const optionalFileName of listOptionalGeneratedModelRemoteFiles(generated)) {
    try {
      files.push({
        fileName: optionalFileName,
        data: await fetchRemoteBinary(`/api/model3d-file?modelId=${encodeURIComponent(generated.id)}&file=${encodeURIComponent(optionalFileName)}`)
      });
    } catch {
      continue;
    }
  }
  return syncGeneratedModelArtifact({
    modelId,
    record: generated,
    files
  });
}

export async function applyModelScaleToHeightViaRemoteWorker(input: {
  modelId: string;
  targetHeightMeters: number;
}): Promise<GeneratedModelPublicRecord> {
  const modelId = input.modelId.trim();
  if (!modelId) {
    throw new Error("modelId is required for remote scale apply.");
  }
  const targetHeightMeters = typeof input.targetHeightMeters === "number" && Number.isFinite(input.targetHeightMeters)
    ? Math.max(0.03, Math.min(4000, input.targetHeightMeters))
    : 1.8;
  const generated = await fetchRemoteJson<GeneratedModelPublicRecord>("/api/model3d-apply-scale", {
    modelId,
    targetHeightMeters
  });
  const fileNames = listGeneratedModelRemoteFiles(generated);
  const files = await Promise.all(fileNames.map(async fileName => ({
    fileName,
    data: await fetchRemoteBinary(`/api/model3d-file?modelId=${encodeURIComponent(generated.id)}&file=${encodeURIComponent(fileName)}`)
  })));
  for (const optionalFileName of listOptionalGeneratedModelRemoteFiles(generated)) {
    try {
      files.push({
        fileName: optionalFileName,
        data: await fetchRemoteBinary(`/api/model3d-file?modelId=${encodeURIComponent(generated.id)}&file=${encodeURIComponent(optionalFileName)}`)
      });
    } catch {
      continue;
    }
  }
  return syncGeneratedModelArtifact({
    modelId,
    record: generated,
    files
  });
}

export async function applyAutoRigToModelViaRemoteWorker(input: {
  modelId: string;
  rigProfile?: string;
  useVision?: boolean;
  landmarks?: Record<string, [number, number, number]> | null;
}): Promise<GeneratedModelPublicRecord> {
  const modelId = input.modelId.trim();
  if (!modelId) {
    throw new Error("modelId is required for remote AutoRig.");
  }
  const generated = await fetchRemoteJson<GeneratedModelPublicRecord>("/api/model3d-autorig", {
    modelId,
    rigProfile: input.rigProfile,
    useVision: input.useVision === true,
    landmarks: input.landmarks ?? null
  });
  const fileNames = listGeneratedModelRemoteFiles(generated);
  const files = await Promise.all(fileNames.map(async fileName => ({
    fileName,
    data: await fetchRemoteBinary(`/api/model3d-file?modelId=${encodeURIComponent(generated.id)}&file=${encodeURIComponent(fileName)}`)
  })));
  for (const optionalFileName of listOptionalGeneratedModelRemoteFiles(generated)) {
    try {
      files.push({
        fileName: optionalFileName,
        data: await fetchRemoteBinary(`/api/model3d-file?modelId=${encodeURIComponent(generated.id)}&file=${encodeURIComponent(optionalFileName)}`)
      });
    } catch {
      continue;
    }
  }
  return syncGeneratedModelArtifact({
    modelId,
    record: generated,
    files
  });
}

export async function previewAutoRigForModelViaRemoteWorker(input: {
  modelId: string;
  rigProfile?: string;
  useVision?: boolean;
  landmarks?: Record<string, [number, number, number]> | null;
}): Promise<{
  modelId: string;
  classification: Record<string, unknown>;
  rigProfile: string;
  landmarks: Record<string, [number, number, number]>;
  markerProjection: { centerX: number; centerZ: number; orthoScale: number } | null;
  editableLandmarks: string[];
  previewImages: Array<{ view: string; dataUrl: string }>;
}> {
  const modelId = input.modelId.trim();
  if (!modelId) {
    throw new Error("modelId is required for remote AutoRig preview.");
  }
  return fetchRemoteJson("/api/model3d-autorig-preview", {
    modelId,
    rigProfile: input.rigProfile,
    useVision: input.useVision === true,
    landmarks: input.landmarks ?? null
  });
}

export async function openModelInBlenderViaRemoteWorker(input: {
  assetPath: string;
  label?: string;
}): Promise<{ launched: boolean; pid: number | null; assetPath: string }> {
  const assetPath = input.assetPath.trim();
  if (!assetPath) {
    throw new Error("assetPath is required to open Blender on the remote worker.");
  }
  return fetchRemoteJson("/api/blender-open-model", {
    assetPath,
    label: input.label?.trim() || undefined
  });
}

export async function openAssetsInBlenderViaRemoteWorker(input: {
  assets: Array<{ mode: "model" | "image-plane"; assetPath?: string; dataUrl?: string; fileName?: string; label?: string }>;
}): Promise<{ launched: boolean; pid: number | null; assetPaths: string[] }> {
  const assets = Array.isArray(input.assets) ? input.assets : [];
  if (assets.length === 0) {
    throw new Error("At least one asset is required to open Blender on the remote worker.");
  }
  return fetchRemoteJson("/api/blender-open-batch", {
    assets: assets.map(asset => ({
      mode: asset.mode,
      assetPath: asset.assetPath?.trim() || undefined,
      dataUrl: asset.dataUrl?.trim() || undefined,
      fileName: asset.fileName?.trim() || undefined,
      label: asset.label?.trim() || undefined
    }))
  });
}

export async function openImageInBlenderViaRemoteWorker(input: {
  assetPath?: string;
  dataUrl?: string;
  fileName?: string;
  label?: string;
}): Promise<{ launched: boolean; pid: number | null; assetPath: string }> {
  const assetPath = String(input.assetPath || "").trim();
  const dataUrl = String(input.dataUrl || "").trim();
  if (!assetPath && !dataUrl) {
    throw new Error("assetPath or dataUrl is required to open an image in Blender on the remote worker.");
  }
  return fetchRemoteJson("/api/blender-open-image", {
    assetPath: assetPath || undefined,
    dataUrl: dataUrl || undefined,
    fileName: input.fileName?.trim() || undefined,
    label: input.label?.trim() || undefined
  });
}

export async function generateImageViaRemoteWorker(input: GenerateImageInput): Promise<GeneratedImageRecord> {
  const imageInput = input.imageInput?.trim()
    ? await normalizeRemoteModelImageInput(input.imageInput)
    : undefined;
  const generated = await fetchRemoteJson<GeneratedImagePublicRecord>("/api/image-generate", {
    prompt: input.prompt,
    imageInput,
    imageFileNameHint: input.imageFileNameHint,
    workflowPathOverride: input.workflowPathOverride,
    width: input.width,
    height: input.height,
    seed: input.seed,
    steps: input.steps,
    cfg: input.cfg,
    stripMetadata: input.stripMetadata,
    postToChannel: false
  });
  const imageData = await fetchRemoteBinary(
    `/api/generated-image-file?imageId=${encodeURIComponent(generated.id)}&file=${encodeURIComponent(generated.imageFileName)}`
  );
  return importGeneratedImageArtifact({
    record: generated,
    imageData
  });
}

export async function suggestModelMetadataViaRemoteWorker(input: {
  prompt?: string;
  imageInput?: string;
  preferVisualModel?: boolean;
}): Promise<{ fileName: string | null; description: string | null; }> {
  const normalizedImageInput = input.imageInput?.trim()
    ? await normalizeRemoteModelImageInput(input.imageInput)
    : "";
  const response = await fetchRemoteJson<{
    fileName?: string | null;
    description?: string | null;
  }>("/api/model3d-suggest-metadata", {
    prompt: input.prompt?.trim() || "",
    imageInput: normalizedImageInput,
    preferVisualModel: input.preferVisualModel === true,
    executionTarget: "local"
  });
  return {
    fileName: typeof response.fileName === "string" ? response.fileName : null,
    description: typeof response.description === "string" ? response.description : null
  };
}

export async function suggestLowPolyByComplexityViaRemoteWorker(input: {
  prompt?: string;
  imageInput?: string;
  context?: string;
  preferVisualModel?: boolean;
}): Promise<{
  targetFaceCount: number;
  sizeTier: "tiny" | "small" | "medium" | "large" | "huge";
  complexity: "simple" | "moderate" | "detailed";
  objectLabel?: string;
  subjectKind?: "character" | "animal" | "creature" | "object" | "vehicle" | "structure" | "scene" | "unknown";
  pose?: "standing" | "sitting" | "lying" | "floating" | "unknown";
  reason: string;
  usedVisionModel: boolean;
}> {
  const normalizedImageInput = input.imageInput?.trim()
    ? await normalizeRemoteModelImageInput(input.imageInput)
    : "";
  const response = await fetchRemoteJson<{
    targetFaceCount?: number;
    sizeTier?: "tiny" | "small" | "medium" | "large" | "huge";
    complexity?: "simple" | "moderate" | "detailed";
    objectLabel?: string;
    subjectKind?: string;
    pose?: string;
    reason?: string;
    usedVisionModel?: boolean;
  }>("/api/model3d-suggest-lowpoly", {
    prompt: input.prompt?.trim() || "",
    imageInput: normalizedImageInput,
    context: input.context?.trim() || "",
    preferVisualModel: input.preferVisualModel === true,
    executionTarget: "local"
  });
  const targetFaceCount = typeof response.targetFaceCount === "number" && Number.isFinite(response.targetFaceCount)
    ? Math.max(500, Math.min(5000, Math.round(response.targetFaceCount)))
    : 1500;
  const sizeTier = response.sizeTier === "tiny" || response.sizeTier === "small" || response.sizeTier === "large" || response.sizeTier === "huge"
    ? response.sizeTier
    : "medium";
  const complexity = response.complexity === "simple" || response.complexity === "detailed"
    ? response.complexity
    : "moderate";
  const reason = typeof response.reason === "string" ? response.reason.trim() : "";
  const objectLabel = typeof response.objectLabel === "string" && response.objectLabel.trim()
    ? normalizeVisualObjectLabel(response.objectLabel)
    : undefined;
  const subjectKind = response.subjectKind === undefined
    ? undefined
    : normalizeVisualSubjectKind(response.subjectKind);
  const pose = response.pose === undefined
    ? undefined
    : normalizeVisualSubjectPose(response.pose);
  await upsertCachedVisualInterpretation({
    imageInput: normalizedImageInput || input.imageInput,
    objectLabel: objectLabel || "object",
    subjectKind: subjectKind || "unknown",
    pose: pose || "unknown",
    summary: `Main subject: ${objectLabel || "object"}. Kind: ${subjectKind || "unknown"}. Pose: ${pose || "unknown"}. Complexity: ${complexity}. Suggested target faces: ${targetFaceCount}. ${reason || "No reason provided."}`
  });
  return {
    targetFaceCount,
    sizeTier,
    complexity,
    objectLabel,
    subjectKind,
    pose,
    reason,
    usedVisionModel: response.usedVisionModel === true
  };
}

export async function suggestModelMetallicDecisionViaRemoteWorker(input: {
  prompt?: string;
  imageInput?: string;
  context?: string;
  preferVisualModel?: boolean;
}): Promise<ModelMetallicDecision> {
  const normalizedImageInput = input.imageInput?.trim()
    ? await normalizeRemoteModelImageInput(input.imageInput)
    : "";
  const response = await fetchRemoteJson<{
    classification?: string;
    reason?: string;
    usedVisionModel?: boolean;
  }>("/api/model3d-suggest-metallic", {
    prompt: input.prompt?.trim() || "",
    imageInput: normalizedImageInput,
    context: input.context?.trim() || "",
    preferVisualModel: input.preferVisualModel === true,
    executionTarget: "local"
  });
  const rawClassification = typeof response.classification === "string" ? response.classification.trim().toLowerCase() : "";
  const classification = rawClassification === "metallic"
    ? "metallic"
    : (rawClassification === "non-metallic" || rawClassification === "nonmetallic" || rawClassification === "not-metal"
      ? "non-metallic"
      : "mixed");
  const reason = typeof response.reason === "string" && response.reason.trim()
    ? response.reason.trim()
    : "Fallback decision: mixed material composition.";
  return {
    classification,
    reason,
    usedVisionModel: response.usedVisionModel === true
  };
}

export async function suggestModelRealWorldHeightViaRemoteWorker(input: {
  prompt?: string;
  imageInput?: string;
  context?: string;
  preferVisualModel?: boolean;
}): Promise<ModelRealWorldHeightDecision> {
  const normalizedImageInput = input.imageInput?.trim()
    ? await normalizeRemoteModelImageInput(input.imageInput)
    : "";
  const response = await fetchRemoteJson<{
    objectLabel?: string;
    subjectKind?: string;
    pose?: string;
    heightMeters?: number;
    reason?: string;
    usedVisionModel?: boolean;
  }>("/api/model3d-suggest-realworld-height", {
    prompt: input.prompt?.trim() || "",
    imageInput: normalizedImageInput,
    context: input.context?.trim() || "",
    preferVisualModel: input.preferVisualModel === true,
    executionTarget: "local"
  });
  const objectLabel = typeof response.objectLabel === "string" && response.objectLabel.trim()
    ? response.objectLabel.trim().slice(0, 60)
    : "object";
  const heightMeters = typeof response.heightMeters === "number" && Number.isFinite(response.heightMeters)
    ? Math.max(0.03, Math.min(4000, response.heightMeters))
    : 1.8;
  const reason = typeof response.reason === "string" && response.reason.trim()
    ? response.reason.trim()
    : "Fallback estimate.";
  const subjectKind = normalizeVisualSubjectKind(response.subjectKind);
  const pose = normalizeVisualSubjectPose(response.pose);
  await upsertCachedVisualInterpretation({
    imageInput: normalizedImageInput || input.imageInput,
    objectLabel,
    subjectKind,
    pose,
    summary: `Main subject: ${objectLabel}. Kind: ${subjectKind}. Pose: ${pose}. Pose-aware height estimate: ${heightMeters.toFixed(2)}m. ${reason}`
  });
  return {
    objectLabel,
    subjectKind,
    pose,
    heightMeters,
    reason,
    usedVisionModel: response.usedVisionModel === true
  };
}

export async function ejectActiveLlmModelsViaRemoteWorker(): Promise<{
  attempted: Array<{ provider: "ollama" | "lmstudio"; model: string }>;
  unloaded: Array<{ provider: "ollama" | "lmstudio"; model: string }>;
  failed: Array<{ provider: "ollama" | "lmstudio"; model: string; error: string }>;
}> {
  const response = await fetchRemoteJson<{
    attempted?: Array<{ provider?: "ollama" | "lmstudio"; model?: string }>;
    unloaded?: Array<{ provider?: "ollama" | "lmstudio"; model?: string }>;
    failed?: Array<{ provider?: "ollama" | "lmstudio"; model?: string; error?: string }>;
  }>("/api/llm-eject-active", {
    executionTarget: "local"
  });
  const normalizeEntry = (entry: { provider?: "ollama" | "lmstudio"; model?: string }): { provider: "ollama" | "lmstudio"; model: string } | null => {
    const provider = entry.provider === "lmstudio" ? "lmstudio" : entry.provider === "ollama" ? "ollama" : null;
    const model = typeof entry.model === "string" ? entry.model.trim() : "";
    if (!provider || !model) {
      return null;
    }
    return { provider, model };
  };
  const normalizeFailedEntry = (entry: { provider?: "ollama" | "lmstudio"; model?: string; error?: string }): { provider: "ollama" | "lmstudio"; model: string; error: string } | null => {
    const base = normalizeEntry(entry);
    const error = typeof entry.error === "string" ? entry.error.trim() : "";
    if (!base || !error) {
      return null;
    }
    return {
      ...base,
      error
    };
  };
  return {
    attempted: Array.isArray(response.attempted)
      ? response.attempted.map(entry => normalizeEntry(entry)).filter((entry): entry is { provider: "ollama" | "lmstudio"; model: string } => entry !== null)
      : [],
    unloaded: Array.isArray(response.unloaded)
      ? response.unloaded.map(entry => normalizeEntry(entry)).filter((entry): entry is { provider: "ollama" | "lmstudio"; model: string } => entry !== null)
      : [],
    failed: Array.isArray(response.failed)
      ? response.failed.map(entry => normalizeFailedEntry(entry)).filter((entry): entry is { provider: "ollama" | "lmstudio"; model: string; error: string } => entry !== null)
      : []
  };
}
export async function loadActiveLlmModelsViaRemoteWorker(
  scope: "text" | "vision" | "both" = "both",
  contextLength?: number,
  selection?: { textModel?: string; visionModel?: string }
): Promise<{
  attempted: Array<{ provider: "ollama" | "lmstudio"; model: string }>;
  loaded: Array<{ provider: "ollama" | "lmstudio"; model: string }>;
  failed: Array<{ provider: "ollama" | "lmstudio"; model: string; error: string }>;
}> {
  const response = await fetchRemoteJson<{
    attempted?: Array<{ provider?: "ollama" | "lmstudio"; model?: string }>;
    loaded?: Array<{ provider?: "ollama" | "lmstudio"; model?: string }>;
    failed?: Array<{ provider?: "ollama" | "lmstudio"; model?: string; error?: string }>;
  }>("/api/llm-load-active", {
    executionTarget: "local",
    scope,
    textModel: selection?.textModel,
    visionModel: selection?.visionModel,
    contextLength: typeof contextLength === "number" && Number.isFinite(contextLength)
      ? Math.max(0, Math.round(contextLength))
      : undefined
  });
  const normalizeEntry = (entry: { provider?: "ollama" | "lmstudio"; model?: string }): { provider: "ollama" | "lmstudio"; model: string } | null => {
    const provider = entry.provider === "lmstudio" ? "lmstudio" : entry.provider === "ollama" ? "ollama" : null;
    const model = typeof entry.model === "string" ? entry.model.trim() : "";
    if (!provider || !model) {
      return null;
    }
    return { provider, model };
  };
  const normalizeFailedEntry = (entry: { provider?: "ollama" | "lmstudio"; model?: string; error?: string }): { provider: "ollama" | "lmstudio"; model: string; error: string } | null => {
    const base = normalizeEntry(entry);
    const error = typeof entry.error === "string" ? entry.error.trim() : "";
    if (!base || !error) {
      return null;
    }
    return {
      ...base,
      error
    };
  };
  return {
    attempted: Array.isArray(response.attempted)
      ? response.attempted.map(entry => normalizeEntry(entry)).filter((entry): entry is { provider: "ollama" | "lmstudio"; model: string } => entry !== null)
      : [],
    loaded: Array.isArray(response.loaded)
      ? response.loaded.map(entry => normalizeEntry(entry)).filter((entry): entry is { provider: "ollama" | "lmstudio"; model: string } => entry !== null)
      : [],
    failed: Array.isArray(response.failed)
      ? response.failed.map(entry => normalizeFailedEntry(entry)).filter((entry): entry is { provider: "ollama" | "lmstudio"; model: string; error: string } => entry !== null)
      : []
  };
}
export async function syncComfySettingsViaRemoteWorker(input: ComfyRuntimeSettings): Promise<ComfyRuntimeSettings> {
  const response = await fetchRemoteJson<Partial<ComfyRuntimeSettings>>("/api/comfy-settings", {
    comfyUiBaseUrl: input.comfyUiBaseUrl,
    comfyUiModelBaseUrl: input.comfyUiModelBaseUrl,
    comfyUiImageBaseUrl: input.comfyUiImageBaseUrl,
    comfyUiAudioBaseUrl: input.comfyUiAudioBaseUrl,
    comfyUiMusicBaseUrl: input.comfyUiMusicBaseUrl,
    comfyUiVideoBaseUrl: input.comfyUiVideoBaseUrl,
    comfyUiInputDir: input.comfyUiInputDir,
    comfyUiModelWorkflowPath: input.comfyUiModelWorkflowPath,
    comfyUiImageWorkflowPath: input.comfyUiImageWorkflowPath,
    comfyUiImageEditWorkflowPath: input.comfyUiImageEditWorkflowPath,
    comfyUiImageLayeredWorkflowPath: input.comfyUiImageLayeredWorkflowPath,
    comfyUiAudioWorkflowPath: input.comfyUiAudioWorkflowPath,
    comfyUiMusicWorkflowPath: input.comfyUiMusicWorkflowPath,
    comfyUiVideoWorkflowPath: input.comfyUiVideoWorkflowPath,
    comfyUiVideoImageWorkflowPath: input.comfyUiVideoImageWorkflowPath
  });
  return {
    comfyUiBaseUrl: typeof response.comfyUiBaseUrl === "string" ? response.comfyUiBaseUrl : input.comfyUiBaseUrl,
    comfyUiModelBaseUrl: typeof response.comfyUiModelBaseUrl === "string" ? response.comfyUiModelBaseUrl : input.comfyUiModelBaseUrl,
    comfyUiImageBaseUrl: typeof response.comfyUiImageBaseUrl === "string" ? response.comfyUiImageBaseUrl : input.comfyUiImageBaseUrl,
    comfyUiAudioBaseUrl: typeof response.comfyUiAudioBaseUrl === "string" ? response.comfyUiAudioBaseUrl : input.comfyUiAudioBaseUrl,
    comfyUiMusicBaseUrl: typeof response.comfyUiMusicBaseUrl === "string" ? response.comfyUiMusicBaseUrl : input.comfyUiMusicBaseUrl,
    comfyUiVideoBaseUrl: typeof response.comfyUiVideoBaseUrl === "string" ? response.comfyUiVideoBaseUrl : input.comfyUiVideoBaseUrl,
    comfyUiInputDir: typeof response.comfyUiInputDir === "string" ? response.comfyUiInputDir : input.comfyUiInputDir,
    comfyUiModelWorkflowPath: typeof response.comfyUiModelWorkflowPath === "string" ? response.comfyUiModelWorkflowPath : input.comfyUiModelWorkflowPath,
    comfyUiImageWorkflowPath: typeof response.comfyUiImageWorkflowPath === "string" ? response.comfyUiImageWorkflowPath : input.comfyUiImageWorkflowPath,
    comfyUiImageEditWorkflowPath: typeof response.comfyUiImageEditWorkflowPath === "string" ? response.comfyUiImageEditWorkflowPath : input.comfyUiImageEditWorkflowPath,
    comfyUiImageLayeredWorkflowPath: typeof response.comfyUiImageLayeredWorkflowPath === "string" ? response.comfyUiImageLayeredWorkflowPath : input.comfyUiImageLayeredWorkflowPath,
    comfyUiAudioWorkflowPath: typeof response.comfyUiAudioWorkflowPath === "string" ? response.comfyUiAudioWorkflowPath : input.comfyUiAudioWorkflowPath,
    comfyUiMusicWorkflowPath: typeof response.comfyUiMusicWorkflowPath === "string" ? response.comfyUiMusicWorkflowPath : input.comfyUiMusicWorkflowPath,
    comfyUiVideoWorkflowPath: typeof response.comfyUiVideoWorkflowPath === "string" ? response.comfyUiVideoWorkflowPath : input.comfyUiVideoWorkflowPath,
    comfyUiVideoImageWorkflowPath: typeof response.comfyUiVideoImageWorkflowPath === "string" ? response.comfyUiVideoImageWorkflowPath : input.comfyUiVideoImageWorkflowPath
  };
}
