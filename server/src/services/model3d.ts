import { copyFile, mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { appConfig } from "../config/appConfig.js";
import { getComfyRuntimeSettings, resolveComfyWorkspacePath } from "./comfyRuntimeSettings.js";
import { runLowPolyModelScript, runModelAlbedoToGeometryScript, runModelAutoRigPreviewScript, runModelAutoRigScript, runModelDecimateToFacesScript, runModelMaterialScript, runModelMergeVerticesScript, runModelMetallicScript, runModelScaleScript, runModelSeparateByLoosePartsScript } from "./model3d/lowPolyModelService.js";
import {
  comfyGetJson,
  comfyPostJson,
  downloadComfyAsset,
  extractComfyImageAssets,
  extractHistoryOutputs,
  findFallbackModelAsset,
  parseModelAssetFromNode,
  waitForComfyHistoryOutputsByPolling,
  waitForComfyPromptCompletion,
  type ComfyImageAsset
} from "./model3d/comfyClient.js";
import {
  buildPublicModelFileUrl,
  extensionFromFileName,
  extensionToContentType,
  mimeToExtension,
  sanitizeFileName
} from "./model3d/fileNaming.js";
import { indexGeneratedModelAssetsWithRust, type RustAssetIndexResult } from "./model3d/assetIndexer.js";
import { ensureUniqueFileName } from "./model3d/fsHelpers.js";
import { resolveLowPolyTargetFaceCount } from "./model3d/lowPolyTarget.js";
import { validateModelFileWithRust, type RustAssetValidationResult } from "./model3d/assetValidator.js";
import { renderModelCaptureWithBlender, type ModelCaptureAction, type ModelCaptureVariant } from "./model3d/capture.js";
import { inspectModelFileWithRust, type RustModelInspectionResult } from "./model3d/modelInspector.js";
import { createPreviewGifFromMultiView, renderModelPreviewMedia } from "./model3d/previewMedia.js";
import { asArray, asInteger, asPositiveNumber, asRecord, asString, createId, parseJsonWithOptionalBom, sleep } from "./model3d/primitives.js";
import {
  deriveRealWorldSizeTierFromDimensions,
  normalizeRealWorldDimensions,
  parseRealWorldDimensionsText,
  parseRealWorldSizeTier,
  readRecordRealWorldDimensions,
  type RealWorldDimensions,
  type RealWorldSizeTier
} from "./model3d/realWorld.js";
import { stageImageInputForComfy, stageMeshInputForComfy, stageSourceImage } from "./model3d/sourceImageStage.js";
import type {
  AutoRigVerificationPreview,
  GeneratedModelLodArtifact,
  GeneratedModelPublicRecord,
  GeneratedModelRecord,
  SeparateByLoosePartsResult
} from "@urage/shared/model3d/contracts";
export type {
  RustAssetIndexResult,
  RustIndexedDirectoryFile,
  RustIndexedModelArtifact
} from "@urage/shared/model3d/assetIndexContracts";
export type { RealWorldDimensions, RealWorldSizeTier } from "./model3d/realWorld.js";
export {
  deriveRealWorldSizeTierFromDimensions,
  parseRealWorldDimensionsText,
  parseRealWorldSizeTier
} from "./model3d/realWorld.js";
export type {
  AutoRigVerificationPreview,
  GeneratedModelLodArtifact,
  GeneratedModelPublicRecord,
  GeneratedModelRecord,
  SeparateByLoosePartsResult
} from "@urage/shared/model3d/contracts";

export interface GenerateModelInput {
  imageInput: string;
  imageFileNameHint?: string;
  meshInput?: string;
  meshFileNameHint?: string;
  workflowPathOverride?: string;
  workflowImageInputNodeId?: string;
  workflowMeshInputNodeId?: string;
  workflowOutputNodeId?: string;
  workflowPreviewNodeId?: string;
  multiViewImageInputs?: Partial<Record<"front" | "back" | "left" | "right", string>>;
  prompt?: string;
  seed?: number;
  stripMetadata?: boolean;
  onModelReady?: (record: GeneratedModelRecord) => void | Promise<void>;
  onPromptQueued?: (promptId: string) => void | Promise<void>;
  signal?: AbortSignal;
}

export interface GenerateLowPolyModelInput {
  modelId: string;
  targetFaceCount?: number;
  realWorldSizeTier?: RealWorldSizeTier;
  realWorldReference?: string;
  realWorldDimensions?: RealWorldDimensions;
  force?: boolean;
  mergeVertices?: boolean;
  shouldDecimate?: boolean;
  maxColors?: number;
  blockSize?: number;
  newMeshName?: string;
}

export type GeneratedModelArtifactVariant = "merged" | "original" | "lowpoly" | "albedo";

const dataDirectory = path.resolve(appConfig.dataDirectory);
const generatedModelsDirectory = path.join(dataDirectory, "generated-models");
const indexPath = path.join(generatedModelsDirectory, "index.json");
const MODEL_PREVIEW_TURNTABLE_FRAME_COUNT = 32;
const MODEL_PREVIEW_TURNTABLE_FRAME_DELAY_MS = 90;
const MODEL_PREVIEW_MAX_FRAME_SIZE = 640;
const MULTIVIEW_PREVIEW_FRAME_DELAY_MS = 180;

let generatedModelMutationQueue: Promise<unknown> = Promise.resolve();
let warnedMissingUvInpaintNodeId = false;
let warnedMissingNormalNodeId = false;
let warnedMissingPromptNodeId = false;

function normalizeAutoRigLandmarks(value: unknown): Record<string, [number, number, number]> | null {
  const raw = asRecord(value);
  if (!raw) {
    return null;
  }
  const landmarks: Record<string, [number, number, number]> = {};
  for (const [key, entry] of Object.entries(raw)) {
    if (!Array.isArray(entry) || entry.length !== 3) {
      continue;
    }
    const x = Number(entry[0]);
    const y = Number(entry[1]);
    const z = Number(entry[2]);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      continue;
    }
    landmarks[key] = [x, y, z];
  }
  return Object.keys(landmarks).length > 0 ? landmarks : null;
}

function normalizeAutoRigPreviewPayload(modelId: string, value: unknown): AutoRigVerificationPreview {
  const raw = asRecord(value);
  if (!raw) {
    throw new Error("AutoRig preview payload is invalid.");
  }
  const landmarks = normalizeAutoRigLandmarks(raw.landmarks);
  if (!landmarks) {
    throw new Error("AutoRig preview did not include editable landmarks.");
  }
  const previewImages = asArray(raw.previewImages)
    .map(entry => {
      const item = asRecord(entry);
      const view = asString(item?.view);
      const dataUrl = asString(item?.dataUrl);
      return view && dataUrl ? { view, dataUrl } : null;
    })
    .filter((entry): entry is { view: string; dataUrl: string } => entry !== null);
  const rawMarkerProjection = asRecord(raw.markerProjection);
  const centerX = Number(rawMarkerProjection?.centerX);
  const centerZ = Number(rawMarkerProjection?.centerZ);
  const orthoScale = Number(rawMarkerProjection?.orthoScale);
  const markerProjection = Number.isFinite(centerX) && Number.isFinite(centerZ) && Number.isFinite(orthoScale) && orthoScale > 0
    ? { centerX, centerZ, orthoScale }
    : null;
  return {
    modelId,
    classification: asRecord(raw.classification) ?? {},
    rigProfile: asString(raw.rigProfile) || "auto",
    landmarks,
    markerProjection,
    editableLandmarks: asArray(raw.editableLandmarks).map(entry => asString(entry)).filter((entry): entry is string => entry !== null),
    previewImages
  };
}

function warnMissingOptionalModelNodeConfig(): void {
  if (!appConfig.comfyUiModelUvInpaintNodeId && !warnedMissingUvInpaintNodeId) {
    warnedMissingUvInpaintNodeId = true;
    console.warn("COMFYUI_3D_UV_INPAINT_NODE_ID is not set. uvMapInpaintFileName will stay null.");
  }
  if (!appConfig.comfyUiModelNormalNodeId && !warnedMissingNormalNodeId) {
    warnedMissingNormalNodeId = true;
    console.warn("COMFYUI_3D_NORMAL_NODE_ID is not set. normalMapFileName will stay null.");
  }
}

function applyOptionalModelPrompt(workflowRoot: Record<string, unknown>, promptText: string): void {
  if (!promptText) {
    return;
  }
  const promptNodeId = appConfig.comfyUiModelPromptNodeId.trim();
  if (!promptNodeId) {
    if (!warnedMissingPromptNodeId) {
      warnedMissingPromptNodeId = true;
      console.warn("COMFYUI_3D_PROMPT_NODE_ID is not set. Prompt text will only be stored as metadata.");
    }
    return;
  }
  const promptNode = asRecord(workflowRoot[promptNodeId]);
  if (!promptNode) {
    throw new Error(`Workflow node "${promptNodeId}" for 3D prompt text was not found.`);
  }
  const inputs = asRecord(promptNode.inputs) ?? {};
  inputs[appConfig.comfyUiModelPromptInputKey] = promptText;
  promptNode.inputs = inputs;
}
function normalizeWorkflowSeed(value: unknown): number | null {
  const numeric = typeof value === "number" ? value : Number.NaN;
  if (!Number.isFinite(numeric)) {
    return null;
  }
  return Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.round(numeric)));
}
function nodeHasInput(node: Record<string, unknown>, inputKey: string): boolean {
  const normalized = inputKey.trim();
  const inputs = asRecord(node.inputs);
  return Boolean(normalized && inputs && normalized in inputs);
}
function resolvePreferredInputKey(node: Record<string, unknown>, configuredKey: string, fallbackKeys: string[]): string {
  const inputs = asRecord(node.inputs);
  if (!inputs) {
    return configuredKey.trim() || fallbackKeys[0] || "";
  }
  const normalizedConfiguredKey = configuredKey.trim();
  if (normalizedConfiguredKey && normalizedConfiguredKey in inputs) {
    return normalizedConfiguredKey;
  }
  for (const fallbackKey of fallbackKeys) {
    if (fallbackKey in inputs) {
      return fallbackKey;
    }
  }
  return normalizedConfiguredKey || fallbackKeys[0] || "";
}
function applyOptionalModelSeed(workflowRoot: Record<string, unknown>, seedInput: unknown): void {
  const seed = normalizeWorkflowSeed(seedInput);
  if (seed === null) {
    return;
  }
  const configuredInputKey = "seed";
  const nodeEntry = Object.entries(workflowRoot).find(([, rawNode]) => {
    const node = asRecord(rawNode);
    return Boolean(node && (nodeHasInput(node, configuredInputKey) || nodeHasInput(node, "noise_seed")));
  }) || null;
  const node = nodeEntry ? asRecord(nodeEntry[1]) : null;
  if (!node) {
    return;
  }
  const inputs = asRecord(node.inputs) ?? {};
  const inputKey = resolvePreferredInputKey(node, configuredInputKey, ["seed", "noise_seed"]);
  if (inputKey) {
    inputs[inputKey] = seed;
    node.inputs = inputs;
  }
}

type Model3dMultiViewName = "front" | "back" | "left" | "right";

function getModel3dMultiViewInputs(input: GenerateModelInput): Partial<Record<Model3dMultiViewName, string>> {
  const rawInputs = input.multiViewImageInputs ?? {};
  const normalized: Partial<Record<Model3dMultiViewName, string>> = {};
  for (const viewName of ["front", "back", "left", "right"] as const) {
    const value = String(rawInputs[viewName] || "").trim();
    if (value) {
      normalized[viewName] = value;
    }
  }
  return normalized;
}

function resolveModel3dMultiViewInputs(input: GenerateModelInput): Record<Model3dMultiViewName, string> | null {
  const normalized = getModel3dMultiViewInputs(input);
  const front = String(normalized.front || "").trim();
  const back = String(normalized.back || "").trim();
  if (!front || !back) {
    return null;
  }
  return {
    front,
    back,
    left: String(normalized.left || front).trim(),
    right: String(normalized.right || back).trim()
  };
}

function findModel3dLoadImageNodeIdForView(workflowRoot: Record<string, unknown>, viewName: Model3dMultiViewName): string {
  const normalizedView = viewName.toLowerCase();
  const matchingEntry = Object.entries(workflowRoot).find(([, rawNode]) => {
    const node = asRecord(rawNode);
    if (!node || asString(node.class_type) !== "LoadImage") {
      return false;
    }
    const inputs = asRecord(node.inputs);
    const meta = asRecord(node._meta);
    const imageName = asString(inputs?.image)?.toLowerCase() || "";
    const title = asString(meta?.title)?.toLowerCase() || "";
    return imageName.includes(normalizedView) || title.includes(normalizedView);
  });
  return matchingEntry ? matchingEntry[0] : "";
}

function setModel3dWorkflowLoadImage(workflowRoot: Record<string, unknown>, nodeId: string, fileName: string): void {
  const imageNode = asRecord(workflowRoot[nodeId]);
  if (!imageNode) {
    throw new Error(`Workflow node "${nodeId}" for input image was not found.`);
  }
  const existingInputs = asRecord(imageNode.inputs) ?? {};
  existingInputs.image = fileName;
  imageNode.inputs = existingInputs;
}

function setModel3dWorkflowMesh(workflowRoot: Record<string, unknown>, nodeId: string, fileName: string): void {
  const meshNode = asRecord(workflowRoot[nodeId]);
  if (!meshNode) {
    throw new Error(`Workflow node "${nodeId}" for input mesh was not found.`);
  }
  const existingInputs = asRecord(meshNode.inputs) ?? {};
  existingInputs.mesh = fileName;
  meshNode.inputs = existingInputs;
}

async function stageAndApplyModel3dImages(workflowRoot: Record<string, unknown>, input: GenerateModelInput): Promise<{ fileName: string }> {
  const resolvedMultiViewInputs = resolveModel3dMultiViewInputs(input);
  if (!resolvedMultiViewInputs) {
    const stagedSourceImage = await stageSourceImage(input);
    setModel3dWorkflowLoadImage(workflowRoot, input.workflowImageInputNodeId?.trim() || appConfig.comfyUiModelImageInputNodeId, stagedSourceImage.fileName);
    if (input.meshInput) {
      const stagedMesh = await stageMeshInputForComfy({ meshInput: input.meshInput, meshFileNameHint: input.meshFileNameHint });
      setModel3dWorkflowMesh(workflowRoot, input.workflowMeshInputNodeId?.trim() || "", stagedMesh.fileName);
    }
    return stagedSourceImage;
  }
  let frontImage: { fileName: string } | null = null;
  for (const [viewName, imageInput] of Object.entries(resolvedMultiViewInputs) as Array<[Model3dMultiViewName, string]>) {
    const staged = await stageImageInputForComfy({
      imageInput,
      imageFileNameHint: viewName === "front" ? input.imageFileNameHint : undefined,
      stripMetadata: input.stripMetadata,
      fallbackPrefix: "model_" + viewName + "_input"
    });
    const nodeId = findModel3dLoadImageNodeIdForView(workflowRoot, viewName);
    if (!nodeId) {
      throw new Error(`MultiView workflow is missing a LoadImage node for ${viewName}.`);
    }
    setModel3dWorkflowLoadImage(workflowRoot, nodeId, staged.fileName);
    if (viewName === "front") {
      frontImage = staged;
    }
  }
  return frontImage || { fileName: "" };
}

function resolveTargetFaceCountFromInputs(inputs: Record<string, unknown>): number | null {
  const preferredKeys = [
    "target_face_count",
    "target_faces",
    "targetFaceCount",
    "face_count",
    "faces",
    "target_triangles",
    "triangles",
    "target_polycount",
    "polycount"
  ];
  for (const key of preferredKeys) {
    const value = asInteger(inputs[key]);
    if (value !== null) {
      return value;
    }
  }
  for (const [key, rawValue] of Object.entries(inputs)) {
    if (!/face|tri|poly/i.test(key)) {
      continue;
    }
    const value = asInteger(rawValue);
    if (value !== null) {
      return value;
    }
  }
  return null;
}

function getWorkflowTargetFaceCount(workflowRoot: Record<string, unknown>): number | null {
  const configuredNodeId = appConfig.comfyUiModelTargetFaceNodeId.trim();
  const configuredInputKey = appConfig.comfyUiModelTargetFaceInputKey.trim();
  if (configuredNodeId) {
    const configuredNode = asRecord(workflowRoot[configuredNodeId]);
    const configuredInputs = asRecord(configuredNode?.inputs);
    if (!configuredInputs) {
      return null;
    }
    if (configuredInputKey) {
      return asInteger(configuredInputs[configuredInputKey]);
    }
    return resolveTargetFaceCountFromInputs(configuredInputs);
  }
  for (const rawNode of Object.values(workflowRoot)) {
    const node = asRecord(rawNode);
    const inputs = asRecord(node?.inputs);
    if (!inputs) {
      continue;
    }
    const value = resolveTargetFaceCountFromInputs(inputs);
    if (value !== null) {
      return value;
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

async function ensureGeneratedModelStore(): Promise<void> {
  await mkdir(generatedModelsDirectory, { recursive: true });
  try {
    await readFile(indexPath, "utf8");
  } catch {
    await writeFile(indexPath, JSON.stringify([], null, 2), "utf8");
  }
}

function sanitizeGeneratedModelRecord(value: unknown): GeneratedModelRecord | null {
  const raw = asRecord(value);
  if (!raw) {
    return null;
  }

  const id = asString(raw.id);
  const createdAt = asString(raw.createdAt);
  const prompt = typeof raw.prompt === "string" ? raw.prompt : "";
  const description = typeof raw.description === "string" ? raw.description.trim() : "";
  const targetFaceCount = asInteger(raw.targetFaceCount);
  const lowPolyTargetFaceCount = asInteger(raw.lowPolyTargetFaceCount);
  const sourceImageFileName = asString(raw.sourceImageFileName);
  const comfyPromptId = asString(raw.comfyPromptId);
  const generationDurationSeconds = asPositiveNumber(raw.generationDurationSeconds);
  const modelFileName = asString(raw.modelFileName);
  const originalModelFileName = asString(raw.originalModelFileName);
  const lowPolyModelFileName = asString(raw.lowPolyModelFileName);
  const albedoGeometryModelFileName = asString(raw.albedoGeometryModelFileName);
  const albedoGeometryPreviewImageFileName = asString(raw.albedoGeometryPreviewImageFileName);
  const albedoGeometryPreviewGifFileName = asString(raw.albedoGeometryPreviewGifFileName);
  const lowPolyPreviewImageFileName = asString(raw.lowPolyPreviewImageFileName);
  const lowPolyPreviewGifFileName = asString(raw.lowPolyPreviewGifFileName);
  const lowPolyRealWorldSizeTier = parseRealWorldSizeTier(raw.lowPolyRealWorldSizeTier);
  const lowPolyRealWorldReference = asString(raw.lowPolyRealWorldReference);
  const lowPolyRealWorldWidthMeters = asPositiveNumber(raw.lowPolyRealWorldWidthMeters);
  const lowPolyRealWorldHeightMeters = asPositiveNumber(raw.lowPolyRealWorldHeightMeters);
  const lowPolyRealWorldDepthMeters = asPositiveNumber(raw.lowPolyRealWorldDepthMeters);
  const previewGifFileName = asString(raw.previewGifFileName);
  const previewImageFileName = asString(raw.previewImageFileName);
  const uvMapFileName = asString(raw.uvMapFileName);
  const uvMapInpaintFileName = asString(raw.uvMapInpaintFileName);
  const normalMapFileName = asString(raw.normalMapFileName);
  const multiViewFileNames = asArray(raw.multiViewFileNames)
    .map(entry => asString(entry))
    .filter((entry): entry is string => entry !== null);
  const lodArtifacts = asArray(raw.lodArtifacts)
    .map(entry => {
      const artifact = asRecord(entry);
      const level = asInteger(artifact?.level);
      const targetFaceCount = asInteger(artifact?.targetFaceCount);
      const fileName = asString(artifact?.fileName);
      return level && targetFaceCount && fileName ? { level, targetFaceCount, fileName } : null;
    })
    .filter((entry): entry is GeneratedModelLodArtifact => entry !== null)
    .sort((left, right) => left.level - right.level);

  if (!id || !createdAt || !sourceImageFileName || !comfyPromptId || !modelFileName) {
    return null;
  }

  return {
    id,
    createdAt,
    prompt,
    ...(description ? { description } : {}),
    targetFaceCount,
    lowPolyTargetFaceCount,
    sourceImageFileName,
    comfyPromptId,
    generationDurationSeconds,
    modelFileName,
    originalModelFileName,
    lowPolyModelFileName,
    albedoGeometryModelFileName,
    albedoGeometryPreviewImageFileName,
    albedoGeometryPreviewGifFileName,
    lowPolyPreviewImageFileName,
    lowPolyPreviewGifFileName,
    lowPolyRealWorldSizeTier,
    lowPolyRealWorldReference,
    lowPolyRealWorldWidthMeters,
    lowPolyRealWorldHeightMeters,
    lowPolyRealWorldDepthMeters,
    previewGifFileName,
    previewImageFileName,
    uvMapFileName,
    uvMapInpaintFileName,
    normalMapFileName,
    multiViewFileNames,
    lodArtifacts
  };
}

async function readGeneratedModelIndex(): Promise<GeneratedModelRecord[]> {
  await ensureGeneratedModelStore();
  const raw = await readFile(indexPath, "utf8");
  const parsed = parseJsonWithOptionalBom<unknown>(raw);
  const items = asArray(parsed)
    .map(entry => sanitizeGeneratedModelRecord(entry))
    .filter((entry): entry is GeneratedModelRecord => entry !== null);

  return items.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

async function writeGeneratedModelIndex(entries: GeneratedModelRecord[]): Promise<void> {
  const task = generatedModelMutationQueue.then(async () => {
    await ensureGeneratedModelStore();
    await writeFile(indexPath, JSON.stringify(entries, null, 2), "utf8");
  });
  generatedModelMutationQueue = task.catch(() => undefined);
  await task;
}

async function addGeneratedModelRecord(record: GeneratedModelRecord): Promise<void> {
  const existing = await readGeneratedModelIndex();
  const next = [record, ...existing.filter(entry => entry.id !== record.id)].slice(0, 250);
  await writeGeneratedModelIndex(next);
}

function getBlockingValidationIssues(issues: RustAssetValidationResult["issues"]): RustAssetValidationResult["issues"] {
  return issues.filter(issue => issue.severity === "error" && issue.code !== "inspection_failed");
}

function formatBlockingValidationIssues(issues: RustAssetValidationResult["issues"]): string {
  const blocking = getBlockingValidationIssues(issues);
  if (blocking.length === 0) return "";
  const summary = blocking.slice(0, 3).map(issue => issue.message.trim()).filter(Boolean).join("; ");
  return blocking.length > 3 ? `${summary}; ${blocking.length - 3} more` : summary;
}

async function assertRustValidatedModelArtifact(inputPath: string, contextLabel: string): Promise<void> {
  const validation = await validateModelFileWithRust(inputPath);
  const blockingSummary = formatBlockingValidationIssues(validation.issues);
  if (!blockingSummary) return;
  throw new Error(`${contextLabel} failed Rust asset validation: ${blockingSummary}`);
}

export async function createImportedModelPreviewMedia(modelId: string, modelFileName: string): Promise<void> {
  await mutateGeneratedModelRecord(modelId, async record => {
    const modelDirectory = path.join(generatedModelsDirectory, modelId);
    let previewImageFileName = record.previewImageFileName;
    let previewGifFileName = record.previewGifFileName;
    try {
      const previewMedia = await renderModelPreviewMedia({
        modelDirectory,
        modelFileName,
        frameCount: MODEL_PREVIEW_TURNTABLE_FRAME_COUNT,
        frameDelayMs: MODEL_PREVIEW_TURNTABLE_FRAME_DELAY_MS
      });
      previewImageFileName = previewMedia.previewImageFileName;
      previewGifFileName = previewMedia.previewGifFileName;
    } catch (error) {
      console.warn("Failed to render preview media for imported split part.", error);
      previewImageFileName = null;
      previewGifFileName = null;
    }
    return {
      ...record,
      previewImageFileName,
      previewGifFileName
    };
  });
}

async function createMergedModelCopyArtifact(input: {
  modelDirectory: string;
  sourceFileName: string;
  outputFileName?: string;
  mergeDistance?: number;
}): Promise<string> {
  const sourceFileName = sanitizeFileName(input.sourceFileName, "");
  if (!sourceFileName) {
    throw new Error("A valid source model file name is required for vertex merge.");
  }
  const sourceModelPath = path.join(input.modelDirectory, sourceFileName);
  await stat(sourceModelPath);
  const sourceExtension = path.extname(sourceFileName) || ".glb";
  const outputExtension = input.outputFileName ? path.extname(input.outputFileName) || sourceExtension : ".fbx";
  const stem = path.basename(sourceFileName, sourceExtension) || "model";
  const preferredOutputName = sanitizeFileName(
    input.outputFileName || `${stem}_merged${outputExtension}`,
    `model_merged${outputExtension}`
  );
  const requestedOutputName = preferredOutputName === sourceFileName
    ? sanitizeFileName(`${stem}_merged_copy${outputExtension}`, `model_merged_copy${outputExtension}`)
    : preferredOutputName;
  const finalOutputName = await ensureUniqueFileName(input.modelDirectory, requestedOutputName);
  const requestedOutputPath = path.join(input.modelDirectory, finalOutputName);
  const resolvedOutputPath = await runModelMergeVerticesScript({
    sourceModelPath,
    outputModelPath: requestedOutputPath,
    mergeDistance: input.mergeDistance
  });
  const resolvedAbsolute = path.resolve(resolvedOutputPath);
  const requestedAbsolute = path.resolve(requestedOutputPath);
  if (resolvedAbsolute !== requestedAbsolute) {
    if (path.resolve(path.dirname(resolvedAbsolute)) === path.resolve(input.modelDirectory)) {
      await rename(resolvedAbsolute, requestedOutputPath);
    } else {
      await copyFile(resolvedAbsolute, requestedOutputPath);
      try {
        await rm(resolvedAbsolute, { force: true });
      } catch {}
    }
  }
  return finalOutputName;
}

async function mutateGeneratedModelRecord(
  modelId: string,
  mutator: (record: GeneratedModelRecord) => Promise<GeneratedModelRecord>
): Promise<GeneratedModelRecord> {
  const task = generatedModelMutationQueue.then(async () => {
    const entries = await readGeneratedModelIndex();
    const index = entries.findIndex(entry => entry.id === modelId);
    if (index === -1) {
      throw new Error("Model entry was not found.");
    }
    const current = entries[index];
    if (!current) {
      throw new Error("Model entry was not found.");
    }
    const updated = await mutator(current);
    entries[index] = updated;
    await ensureGeneratedModelStore();
    await writeFile(indexPath, JSON.stringify(entries, null, 2), "utf8");
    return updated;
  });
  generatedModelMutationQueue = task.catch(() => undefined);
  return task;
}

async function ensureUniqueModelId(preferredId: string): Promise<string> {
  const knownIds = new Set((await readGeneratedModelIndex()).map(entry => entry.id));
  const base = sanitizeFileName(preferredId, createId()) || createId();
  let candidate = base;
  let counter = 1;
  while (knownIds.has(candidate)) {
    candidate = `${base}_${counter}`;
    counter += 1;
  }
  return candidate;
}

async function collectGeneratedModelSidecarFiles(sourceModelPath: string): Promise<Array<{ relativePath: string; data: Buffer }>> {
  const sourceDirectory = path.dirname(sourceModelPath);
  const sourceStem = path.basename(sourceModelPath, path.extname(sourceModelPath));
  const sidecarDirectory = path.join(sourceDirectory, `${sourceStem}.fbm`);
  try {
    const sidecarStat = await stat(sidecarDirectory);
    if (!sidecarStat.isDirectory()) {
      return [];
    }
  } catch {
    return [];
  }
  const files: Array<{ relativePath: string; data: Buffer }> = [];
  const queue = [sidecarDirectory];
  while (queue.length > 0) {
    const currentDirectory = queue.shift();
    if (!currentDirectory) {
      continue;
    }
    const entries = await readdir(currentDirectory, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(currentDirectory, entry.name);
      if (entry.isDirectory()) {
        queue.push(absolutePath);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      const relativePath = path.relative(sourceDirectory, absolutePath).replace(/\\/g, "/");
      const normalizedPath = normalizeGeneratedModelRequestedFilePath(relativePath);
      if (normalizedPath) {
        files.push({ relativePath: normalizedPath, data: await readFile(absolutePath) });
      }
    }
  }
  return files;
}

async function writeUploadedModelSidecarFiles(input: {
  modelDirectory: string;
  modelFileName: string;
  sidecarFiles?: Array<{ relativePath: string; data: Buffer }>;
}): Promise<void> {
  for (const file of input.sidecarFiles || []) {
    if (!file.data || file.data.length === 0) {
      continue;
    }
    const relativePath = normalizeGeneratedModelRequestedFilePath(file.relativePath);
    if (!relativePath || relativePath === input.modelFileName) {
      continue;
    }
    const absolutePath = path.resolve(input.modelDirectory, relativePath);
    const allowedPrefix = path.resolve(input.modelDirectory) + path.sep;
    if (!absolutePath.startsWith(allowedPrefix)) {
      continue;
    }
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, file.data);
  }
}

export async function importUploadedSourceModel(input: {
  fileName: string;
  fileData: Buffer;
  contentType?: string;
  prompt?: string;
  mergedModelFileName?: string;
  useSourceAsCurrent?: boolean;
  sidecarFiles?: Array<{ relativePath: string; data: Buffer }>;
}): Promise<GeneratedModelRecord> {
  if (!input.fileData || input.fileData.length === 0) {
    throw new Error("Uploaded model payload is empty.");
  }
  const safeHintName = sanitizeFileName(input.fileName, "");
  const hintExtension = extensionFromFileName(safeHintName);
  const fallbackExtension = hintExtension || mimeToExtension(input.contentType) || ".glb";
  const fallbackName = sanitizeFileName(`uploaded_model${fallbackExtension}`, "uploaded_model.glb");
  const desiredName = safeHintName && hintExtension
    ? safeHintName
    : sanitizeFileName(`${path.basename(safeHintName || "uploaded_model", hintExtension || "")}${fallbackExtension}`, fallbackName);
  const modelId = await ensureUniqueModelId(createId());
  const modelDirectory = path.join(generatedModelsDirectory, modelId);
  await mkdir(modelDirectory, { recursive: true });
  const modelFileName = await ensureUniqueFileName(modelDirectory, desiredName || fallbackName);
  await writeFile(path.join(modelDirectory, modelFileName), input.fileData);
  await writeUploadedModelSidecarFiles({ modelDirectory, modelFileName, sidecarFiles: input.sidecarFiles });
  const currentModelFileName = input.useSourceAsCurrent === true
    ? modelFileName
    : await createMergedModelCopyArtifact({ modelDirectory, sourceFileName: modelFileName, outputFileName: input.mergedModelFileName });
  await assertRustValidatedModelArtifact(path.join(modelDirectory, currentModelFileName), "Uploaded source model");
  const record: GeneratedModelRecord = {
    id: modelId,
    createdAt: new Date().toISOString(),
    prompt: input.prompt?.trim() ?? "",
    ...(input.prompt?.trim() ? { description: input.prompt.trim() } : {}),
    targetFaceCount: null,
    lowPolyTargetFaceCount: null,
    sourceImageFileName: modelFileName,
    comfyPromptId: "uploaded-source",
    generationDurationSeconds: null,
    modelFileName: currentModelFileName,
    originalModelFileName: input.useSourceAsCurrent === true ? null : modelFileName,
    lowPolyModelFileName: null,
    albedoGeometryModelFileName: null,
    albedoGeometryPreviewImageFileName: null,
    albedoGeometryPreviewGifFileName: null,
    lowPolyPreviewImageFileName: null,
    lowPolyPreviewGifFileName: null,
    lowPolyRealWorldSizeTier: null,
    lowPolyRealWorldReference: null,
    lowPolyRealWorldWidthMeters: null,
    lowPolyRealWorldHeightMeters: null,
    lowPolyRealWorldDepthMeters: null,
    previewGifFileName: null,
    previewImageFileName: null,
    uvMapFileName: null,
    uvMapInpaintFileName: null,
    normalMapFileName: null,
    multiViewFileNames: [],
    lodArtifacts: []
  };
  await addGeneratedModelRecord(record);
  // Imported assets need the same preview contract as generated ones. Without
  // this, a valid GLTF is selectable but appears as an empty recent-model tile.
  await createImportedModelPreviewMedia(modelId, currentModelFileName);
  const previewedRecord = (await readGeneratedModelIndex()).find(entry => entry.id === modelId);
  return previewedRecord ?? record;
}


export function toGeneratedModelPublicRecord(record: GeneratedModelRecord): GeneratedModelPublicRecord {
  return {
    ...record,
    modelUrl: buildPublicModelFileUrl(record.id, record.modelFileName),
    sourceImageUrl: record.sourceImageFileName ? buildPublicModelFileUrl(record.id, record.sourceImageFileName) : null,
    originalModelUrl: record.originalModelFileName ? buildPublicModelFileUrl(record.id, record.originalModelFileName) : null,
    lowPolyModelUrl: record.lowPolyModelFileName ? buildPublicModelFileUrl(record.id, record.lowPolyModelFileName) : null,
    albedoGeometryModelUrl: record.albedoGeometryModelFileName ? buildPublicModelFileUrl(record.id, record.albedoGeometryModelFileName) : null,
    albedoGeometryPreviewImageUrl: record.albedoGeometryPreviewImageFileName ? buildPublicModelFileUrl(record.id, record.albedoGeometryPreviewImageFileName) : null,
    albedoGeometryPreviewGifUrl: record.albedoGeometryPreviewGifFileName ? buildPublicModelFileUrl(record.id, record.albedoGeometryPreviewGifFileName) : null,
    lowPolyPreviewImageUrl: record.lowPolyPreviewImageFileName ? buildPublicModelFileUrl(record.id, record.lowPolyPreviewImageFileName) : null,
    lowPolyPreviewGifUrl: record.lowPolyPreviewGifFileName ? buildPublicModelFileUrl(record.id, record.lowPolyPreviewGifFileName) : null,
    previewGifUrl: record.previewGifFileName ? buildPublicModelFileUrl(record.id, record.previewGifFileName) : null,
    previewImageUrl: record.previewImageFileName ? buildPublicModelFileUrl(record.id, record.previewImageFileName) : null,
    uvMapUrl: record.uvMapFileName ? buildPublicModelFileUrl(record.id, record.uvMapFileName) : null,
    uvMapInpaintUrl: record.uvMapInpaintFileName ? buildPublicModelFileUrl(record.id, record.uvMapInpaintFileName) : null,
    normalMapUrl: record.normalMapFileName ? buildPublicModelFileUrl(record.id, record.normalMapFileName) : null,
    multiViewUrls: record.multiViewFileNames.map(fileName => buildPublicModelFileUrl(record.id, fileName)),
    lodArtifacts: record.lodArtifacts.map(artifact => ({
      ...artifact,
      url: buildPublicModelFileUrl(record.id, artifact.fileName)
    }))
  };
}

function listModelReferencedFiles(record: GeneratedModelRecord, includeSourceImage = false): string[] {
  return [
    ...(includeSourceImage ? [record.sourceImageFileName] : []),
    record.modelFileName,
    record.originalModelFileName,
    record.lowPolyModelFileName,
    record.albedoGeometryModelFileName,
    record.albedoGeometryPreviewImageFileName,
    record.albedoGeometryPreviewGifFileName,
    record.lowPolyPreviewImageFileName,
    record.lowPolyPreviewGifFileName,
    record.previewGifFileName,
    record.previewImageFileName,
    record.uvMapFileName,
    record.uvMapInpaintFileName,
    record.normalMapFileName,
    ...record.multiViewFileNames,
    ...record.lodArtifacts.map(artifact => artifact.fileName)
  ].filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
}

export async function importGeneratedModelArtifact(input: {
  record: GeneratedModelRecord;
  files: Array<{ fileName: string; data: Buffer }>;
}): Promise<GeneratedModelRecord> {
  const sanitizedRecord = sanitizeGeneratedModelRecord(input.record);
  if (!sanitizedRecord) {
    throw new Error("Remote generated model record is invalid.");
  }
  const requiredFileNames = listModelReferencedFiles(sanitizedRecord, false);
  const optionalFileNames = listModelReferencedFiles(sanitizedRecord, true)
    .filter(fileName => !requiredFileNames.includes(fileName));
  if (requiredFileNames.length === 0) {
    throw new Error("Remote generated model does not include any files.");
  }
  const providedFiles = new Map<string, Buffer>();
  for (const file of input.files) {
    const safeName = sanitizeFileName(file.fileName, "");
    if (!safeName || file.data.length === 0) {
      continue;
    }
    providedFiles.set(safeName, file.data);
  }
  for (const fileName of requiredFileNames) {
    if (!providedFiles.has(fileName)) {
      throw new Error(`Remote generated model is missing file "${fileName}".`);
    }
  }
  const modelId = await ensureUniqueModelId(sanitizedRecord.id);
  const modelDirectory = path.join(generatedModelsDirectory, modelId);
  await mkdir(modelDirectory, { recursive: true });
  const writtenFileNames = new Map<string, string>();
  for (const fileName of [...requiredFileNames, ...optionalFileNames]) {
    if (writtenFileNames.has(fileName)) {
      continue;
    }
    const bytes = providedFiles.get(fileName);
    if (!bytes) {
      continue;
    }
    const finalName = await ensureUniqueFileName(modelDirectory, fileName);
    await writeFile(path.join(modelDirectory, finalName), bytes);
    writtenFileNames.set(fileName, finalName);
  }
  const resolveName = (value: string | null): string | null => {
    if (!value) {
      return null;
    }
    return writtenFileNames.get(value) ?? null;
  };
  const importedRecord: GeneratedModelRecord = {
    ...sanitizedRecord,
    id: modelId,
    lowPolyTargetFaceCount: sanitizedRecord.lowPolyTargetFaceCount,
    sourceImageFileName: resolveName(sanitizedRecord.sourceImageFileName) ?? sanitizedRecord.sourceImageFileName,
    modelFileName: resolveName(sanitizedRecord.modelFileName) ?? sanitizedRecord.modelFileName,
    originalModelFileName: resolveName(sanitizedRecord.originalModelFileName),
    lowPolyModelFileName: resolveName(sanitizedRecord.lowPolyModelFileName),
    albedoGeometryModelFileName: resolveName(sanitizedRecord.albedoGeometryModelFileName),
    albedoGeometryPreviewImageFileName: resolveName(sanitizedRecord.albedoGeometryPreviewImageFileName),
    albedoGeometryPreviewGifFileName: resolveName(sanitizedRecord.albedoGeometryPreviewGifFileName),
    lowPolyPreviewImageFileName: resolveName(sanitizedRecord.lowPolyPreviewImageFileName),
    lowPolyPreviewGifFileName: resolveName(sanitizedRecord.lowPolyPreviewGifFileName),
    lowPolyRealWorldSizeTier: sanitizedRecord.lowPolyRealWorldSizeTier,
    lowPolyRealWorldReference: sanitizedRecord.lowPolyRealWorldReference,
    previewGifFileName: resolveName(sanitizedRecord.previewGifFileName),
    previewImageFileName: resolveName(sanitizedRecord.previewImageFileName),
    uvMapFileName: resolveName(sanitizedRecord.uvMapFileName),
    uvMapInpaintFileName: resolveName(sanitizedRecord.uvMapInpaintFileName),
    normalMapFileName: resolveName(sanitizedRecord.normalMapFileName),
    multiViewFileNames: sanitizedRecord.multiViewFileNames.map(fileName => resolveName(fileName) ?? fileName),
    lodArtifacts: sanitizedRecord.lodArtifacts
      .map(artifact => {
        const fileName = resolveName(artifact.fileName);
        return fileName ? { ...artifact, fileName } : null;
      })
      .filter((entry): entry is GeneratedModelLodArtifact => entry !== null)
  };
  await addGeneratedModelRecord(importedRecord);
  return importedRecord;
}

export async function syncGeneratedModelArtifact(input: {
  modelId: string;
  record: GeneratedModelRecord;
  files: Array<{ fileName: string; data: Buffer }>;
}): Promise<GeneratedModelPublicRecord> {
  const safeModelId = sanitizeFileName(input.modelId, "");
  if (!safeModelId) {
    throw new Error("Invalid model id.");
  }
  const sanitizedRecord = sanitizeGeneratedModelRecord(input.record);
  if (!sanitizedRecord) {
    throw new Error("Remote generated model record is invalid.");
  }
  const providedFiles = new Map<string, Buffer>();
  for (const file of input.files) {
    const safeName = sanitizeFileName(file.fileName, "");
    if (!safeName || file.data.length === 0) {
      continue;
    }
    providedFiles.set(safeName, file.data);
  }
  const updated = await mutateGeneratedModelRecord(safeModelId, async currentRecord => {
    const modelDirectory = path.join(generatedModelsDirectory, safeModelId);
    await mkdir(modelDirectory, { recursive: true });
    const requiredFileNames = listModelReferencedFiles(sanitizedRecord, false);
    for (const fileName of requiredFileNames) {
      const targetPath = path.join(modelDirectory, fileName);
      if (!providedFiles.has(fileName) && !(await fileExists(targetPath))) {
        throw new Error(`Remote generated model is missing file "${fileName}".`);
      }
    }
    for (const [fileName, bytes] of providedFiles.entries()) {
      await writeFile(path.join(modelDirectory, fileName), bytes);
    }
    const resolveName = (nextName: string | null, fallbackName: string | null): string | null => {
      if (!nextName) {
        return null;
      }
      if (providedFiles.has(nextName)) {
        return nextName;
      }
      return fallbackName;
    };
    const nextSourceImageFileName = resolveName(sanitizedRecord.sourceImageFileName, currentRecord.sourceImageFileName) ?? currentRecord.sourceImageFileName;
    const nextModelFileName = resolveName(sanitizedRecord.modelFileName, currentRecord.modelFileName) ?? currentRecord.modelFileName;
    const nextOriginalModelFileName = resolveName(sanitizedRecord.originalModelFileName, currentRecord.originalModelFileName);
    const nextMultiViewNames = sanitizedRecord.multiViewFileNames
      .map(fileName => resolveName(fileName, null))
      .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
    return {
      ...currentRecord,
      createdAt: sanitizedRecord.createdAt,
      prompt: sanitizedRecord.prompt,
      targetFaceCount: sanitizedRecord.targetFaceCount,
      lowPolyTargetFaceCount: sanitizedRecord.lowPolyTargetFaceCount,
      sourceImageFileName: nextSourceImageFileName,
      comfyPromptId: sanitizedRecord.comfyPromptId || currentRecord.comfyPromptId,
      modelFileName: nextModelFileName,
      originalModelFileName: nextOriginalModelFileName,
      lowPolyModelFileName: resolveName(sanitizedRecord.lowPolyModelFileName, currentRecord.lowPolyModelFileName),
      albedoGeometryModelFileName: resolveName(sanitizedRecord.albedoGeometryModelFileName, currentRecord.albedoGeometryModelFileName),
      albedoGeometryPreviewImageFileName: resolveName(sanitizedRecord.albedoGeometryPreviewImageFileName, currentRecord.albedoGeometryPreviewImageFileName),
      albedoGeometryPreviewGifFileName: resolveName(sanitizedRecord.albedoGeometryPreviewGifFileName, currentRecord.albedoGeometryPreviewGifFileName),
      lowPolyPreviewImageFileName: resolveName(sanitizedRecord.lowPolyPreviewImageFileName, currentRecord.lowPolyPreviewImageFileName),
      lowPolyPreviewGifFileName: resolveName(sanitizedRecord.lowPolyPreviewGifFileName, currentRecord.lowPolyPreviewGifFileName),
      lowPolyRealWorldSizeTier: sanitizedRecord.lowPolyRealWorldSizeTier,
      lowPolyRealWorldReference: sanitizedRecord.lowPolyRealWorldReference,
      lowPolyRealWorldWidthMeters: sanitizedRecord.lowPolyRealWorldWidthMeters,
      lowPolyRealWorldHeightMeters: sanitizedRecord.lowPolyRealWorldHeightMeters,
      lowPolyRealWorldDepthMeters: sanitizedRecord.lowPolyRealWorldDepthMeters,
      previewGifFileName: resolveName(sanitizedRecord.previewGifFileName, currentRecord.previewGifFileName),
      previewImageFileName: resolveName(sanitizedRecord.previewImageFileName, currentRecord.previewImageFileName),
      uvMapFileName: resolveName(sanitizedRecord.uvMapFileName, currentRecord.uvMapFileName),
      uvMapInpaintFileName: resolveName(sanitizedRecord.uvMapInpaintFileName, currentRecord.uvMapInpaintFileName),
      normalMapFileName: resolveName(sanitizedRecord.normalMapFileName, currentRecord.normalMapFileName),
      multiViewFileNames: nextMultiViewNames.length > 0 ? nextMultiViewNames : currentRecord.multiViewFileNames
    };
  });
  return toGeneratedModelPublicRecord(updated);
}

export async function listGeneratedModels(): Promise<GeneratedModelRecord[]> {
  return readGeneratedModelIndex();
}

export async function listGeneratedModelsPublic(): Promise<GeneratedModelPublicRecord[]> {
  return (await listGeneratedModels()).map(entry => toGeneratedModelPublicRecord(entry));
}

export async function indexGeneratedModelStoreWithRust(): Promise<RustAssetIndexResult> {
  await ensureGeneratedModelStore();
  return indexGeneratedModelAssetsWithRust(generatedModelsDirectory);
}

export async function getGeneratedModelPublicById(modelId: string): Promise<GeneratedModelPublicRecord | null> {
  const safeModelId = sanitizeFileName(modelId, "");
  if (!safeModelId) {
    return null;
  }
  const record = (await listGeneratedModels()).find(entry => entry.id === safeModelId);
  return record ? toGeneratedModelPublicRecord(record) : null;
}
export async function deleteGeneratedModel(modelId: string): Promise<boolean> {
  const safeModelId = sanitizeFileName(modelId, "");
  if (!safeModelId) {
    throw new Error("Invalid generated model delete request.");
  }
  const records = await readGeneratedModelIndex();
  if (!records.some(entry => entry.id === safeModelId)) {
    return false;
  }
  await writeGeneratedModelIndex(records.filter(entry => entry.id !== safeModelId));
  await rm(path.join(generatedModelsDirectory, safeModelId), {
    recursive: true,
    force: true
  });
  return true;
}

export async function deleteGeneratedModelVariant(modelId: string, variant: GeneratedModelArtifactVariant, fileName?: string): Promise<GeneratedModelPublicRecord | null> {
  const safeModelId = sanitizeFileName(modelId, "");
  const safeFileName = sanitizeFileName(fileName ?? "", "");
  if (!safeModelId) {
    throw new Error("Invalid generated model variant delete request.");
  }
  const record = (await readGeneratedModelIndex()).find(entry => entry.id === safeModelId);
  if (!record) {
    throw new Error("Model entry was not found.");
  }
  const expectedFileName = variant === "original"
    ? record.originalModelFileName
    : variant === "lowpoly"
      ? record.lowPolyModelFileName
      : variant === "albedo"
        ? record.albedoGeometryModelFileName
        : record.modelFileName;
  if (!expectedFileName || (safeFileName && safeFileName !== expectedFileName)) {
    throw new Error("Model variant was not found.");
  }
  const remainingFileName = variant === "merged"
    ? (record.originalModelFileName || record.lowPolyModelFileName || record.albedoGeometryModelFileName)
    : record.modelFileName;
  if (variant === "merged" && (!remainingFileName || remainingFileName === expectedFileName)) {
    throw new Error("The merged artifact is the model's only remaining variant. Delete the model entry explicitly instead.");
  }
  const filesToDelete = [expectedFileName];
  const updated = await mutateGeneratedModelRecord(safeModelId, async current => {
    if (variant === "original") {
      return { ...current, originalModelFileName: null };
    }
    if (variant === "lowpoly") {
      filesToDelete.push(current.lowPolyPreviewImageFileName || "", current.lowPolyPreviewGifFileName || "");
      return {
        ...current,
        lowPolyModelFileName: null,
        lowPolyPreviewImageFileName: null,
        lowPolyPreviewGifFileName: null,
        lowPolyRealWorldSizeTier: null,
        lowPolyRealWorldReference: null,
        lowPolyRealWorldWidthMeters: null,
        lowPolyRealWorldHeightMeters: null,
        lowPolyRealWorldDepthMeters: null
      };
    }
    if (variant === "albedo") {
      filesToDelete.push(current.albedoGeometryPreviewImageFileName || "", current.albedoGeometryPreviewGifFileName || "");
      return {
        ...current,
        albedoGeometryModelFileName: null,
        albedoGeometryPreviewImageFileName: null,
        albedoGeometryPreviewGifFileName: null
      };
    }
    filesToDelete.push(current.previewImageFileName || "", current.previewGifFileName || "");
    if (current.originalModelFileName) {
      return { ...current, modelFileName: current.originalModelFileName, originalModelFileName: null, previewImageFileName: null, previewGifFileName: null };
    }
    return {
      ...current,
      modelFileName: current.lowPolyModelFileName || current.modelFileName,
      lowPolyModelFileName: null,
      lowPolyPreviewImageFileName: null,
      lowPolyPreviewGifFileName: null,
      lowPolyRealWorldSizeTier: null,
      lowPolyRealWorldReference: null,
      lowPolyRealWorldWidthMeters: null,
      lowPolyRealWorldHeightMeters: null,
      lowPolyRealWorldDepthMeters: null,
      previewImageFileName: null,
      previewGifFileName: null
    };
  });
  const retainedNames = new Set([
    updated.sourceImageFileName,
    updated.modelFileName,
    updated.originalModelFileName,
    updated.lowPolyModelFileName,
    updated.albedoGeometryModelFileName,
    updated.previewImageFileName,
    updated.previewGifFileName,
    updated.lowPolyPreviewImageFileName,
    updated.lowPolyPreviewGifFileName,
    updated.albedoGeometryPreviewImageFileName,
    updated.albedoGeometryPreviewGifFileName,
    updated.uvMapFileName,
    updated.uvMapInpaintFileName,
    updated.normalMapFileName,
    ...updated.multiViewFileNames,
    ...updated.lodArtifacts.map(artifact => artifact.fileName)
  ].filter((name): name is string => Boolean(name)));
  await Promise.all(filesToDelete
    .map(name => sanitizeFileName(name, ""))
    .filter(name => name && !retainedNames.has(name))
    .map(name => rm(path.join(generatedModelsDirectory, safeModelId, name), { force: true })));
  return toGeneratedModelPublicRecord(updated);
}

export async function setGeneratedModelPreviewGif(
  modelId: string,
  gifBytes: Buffer,
  fileNameHint?: string
): Promise<GeneratedModelPublicRecord> {
  if (gifBytes.length === 0) {
    throw new Error("GIF payload is empty.");
  }
  const safeModelId = sanitizeFileName(modelId, "");
  if (!safeModelId) {
    throw new Error("Invalid model id.");
  }
  const updated = await mutateGeneratedModelRecord(safeModelId, async record => {
    const modelDirectory = path.join(generatedModelsDirectory, safeModelId);
    await mkdir(modelDirectory, { recursive: true });
    const requestedName = sanitizeFileName(fileNameHint ?? "preview-threejs.gif", "preview-threejs.gif");
    const stem = path.basename(requestedName, path.extname(requestedName)) || "preview-threejs";
    const normalizedName = `${stem}.gif`;
    await writeFile(path.join(modelDirectory, normalizedName), gifBytes);
    return {
      ...record,
      previewGifFileName: normalizedName
    };
  });
  return toGeneratedModelPublicRecord(updated);
}

export async function setGeneratedModelPreviewImage(
  modelId: string,
  imageBytes: Buffer,
  fileNameHint?: string
): Promise<GeneratedModelPublicRecord> {
  if (imageBytes.length === 0) {
    throw new Error("Preview image payload is empty.");
  }
  const safeModelId = sanitizeFileName(modelId, "");
  if (!safeModelId) {
    throw new Error("Invalid model id.");
  }
  const updated = await mutateGeneratedModelRecord(safeModelId, async record => {
    const modelDirectory = path.join(generatedModelsDirectory, safeModelId);
    await mkdir(modelDirectory, { recursive: true });
    const requestedName = sanitizeFileName(fileNameHint ?? "preview-llm.png", "preview-llm.png");
    const extension = extensionFromFileName(requestedName) || ".png";
    const stem = path.basename(requestedName, path.extname(requestedName)) || "preview-llm";
    const normalizedName = `${stem}${extension}`;
    await writeFile(path.join(modelDirectory, normalizedName), imageBytes);
    return {
      ...record,
      previewImageFileName: normalizedName
    };
  });
  return toGeneratedModelPublicRecord(updated);
}

export async function renameGeneratedLowPolyModelFileName(
  modelId: string,
  fileNameHint: string
): Promise<GeneratedModelPublicRecord> {
  const safeModelId = sanitizeFileName(modelId, "");
  const trimmedHint = fileNameHint.trim();
  if (!safeModelId) {
    throw new Error("Invalid model id.");
  }
  if (!trimmedHint) {
    throw new Error("A low poly model file name is required.");
  }
  const updated = await mutateGeneratedModelRecord(safeModelId, async record => {
    if (!record.lowPolyModelFileName) {
      throw new Error("Low poly model entry has no generated file to rename.");
    }
    const modelDirectory = path.join(generatedModelsDirectory, safeModelId);
    await mkdir(modelDirectory, { recursive: true });
    const currentExt = path.extname(record.lowPolyModelFileName) || ".fbx";
    const requestedName = sanitizeFileName(trimmedHint, `lowpoly${currentExt}`);
    const requestedStem = path.basename(requestedName, path.extname(requestedName)) || "lowpoly";
    const normalizedName = `${requestedStem}${currentExt}`;
    if (normalizedName === record.lowPolyModelFileName) {
      return record;
    }
    const finalName = await ensureUniqueFileName(modelDirectory, normalizedName);
    await rename(
      path.join(modelDirectory, record.lowPolyModelFileName),
      path.join(modelDirectory, finalName)
    );
    return {
      ...record,
      lowPolyModelFileName: finalName
    };
  });
  return toGeneratedModelPublicRecord(updated);
}
export async function renameGeneratedModelFileName(
  modelId: string,
  fileNameHint: string
): Promise<GeneratedModelPublicRecord> {
  const safeModelId = sanitizeFileName(modelId, "");
  const trimmedHint = fileNameHint.trim();
  if (!safeModelId) {
    throw new Error("Invalid model id.");
  }
  if (!trimmedHint) {
    throw new Error("A model file name is required.");
  }
  const updated = await mutateGeneratedModelRecord(safeModelId, async record => {
    const modelDirectory = path.join(generatedModelsDirectory, safeModelId);
    await mkdir(modelDirectory, { recursive: true });
    const currentExt = path.extname(record.modelFileName) || ".glb";
    const requestedName = sanitizeFileName(trimmedHint, `model${currentExt}`);
    const requestedStem = path.basename(requestedName, path.extname(requestedName)) || "model";
    const normalizedName = `${requestedStem}${currentExt}`;
    if (normalizedName === record.modelFileName) {
      return record;
    }
    const finalName = await ensureUniqueFileName(modelDirectory, normalizedName);
    await rename(
      path.join(modelDirectory, record.modelFileName),
      path.join(modelDirectory, finalName)
    );
    return {
      ...record,
      modelFileName: finalName
    };
  });
  return toGeneratedModelPublicRecord(updated);
}

export async function updateGeneratedModelDescription(
  modelId: string,
  description: string
): Promise<GeneratedModelPublicRecord> {
  const safeModelId = sanitizeFileName(modelId, "");
  if (!safeModelId) {
    throw new Error("Invalid model id.");
  }
  const normalizedDescription = description.trim();
  const updated = await mutateGeneratedModelRecord(safeModelId, async record => normalizedDescription
    ? { ...record, description: normalizedDescription }
    : { ...record, description: undefined });
  return toGeneratedModelPublicRecord(updated);
}

async function fileExists(absolutePath: string): Promise<boolean> {
  try {
    await stat(absolutePath);
    return true;
  } catch {
    return false;
  }
}

export async function generateLowPolyModel(input: GenerateLowPolyModelInput): Promise<GeneratedModelPublicRecord> {
  const safeModelId = sanitizeFileName(input.modelId, "");
  if (!safeModelId) {
    throw new Error("Invalid model id.");
  }
  const updated = await mutateGeneratedModelRecord(safeModelId, async record => {
    const modelDirectory = path.join(generatedModelsDirectory, safeModelId);
    await mkdir(modelDirectory, { recursive: true });
    const existingDimensions = readRecordRealWorldDimensions(record);
    const requestedDimensions = normalizeRealWorldDimensions(input.realWorldDimensions);
    const nextDimensions = requestedDimensions ?? existingDimensions;
    const requestedRealWorldSizeTier = parseRealWorldSizeTier(input.realWorldSizeTier);
    const nextRealWorldSizeTier = requestedRealWorldSizeTier
      ?? deriveRealWorldSizeTierFromDimensions(nextDimensions)
      ?? record.lowPolyRealWorldSizeTier;
    const nextRealWorldReference = (input.realWorldReference?.trim() ?? "") || record.lowPolyRealWorldReference || null;
    const targetFaceCount = resolveLowPolyTargetFaceCount(
      input.targetFaceCount,
      record.lowPolyTargetFaceCount ?? record.targetFaceCount,
      nextRealWorldSizeTier,
      nextDimensions
    );
    const canReuseExisting = input.force !== true
      && record.lowPolyModelFileName !== null
      && record.lowPolyTargetFaceCount === targetFaceCount
      && await fileExists(path.join(modelDirectory, record.lowPolyModelFileName));
    if (canReuseExisting) {
      const existingPreviewPath = record.lowPolyPreviewImageFileName
        ? path.join(modelDirectory, record.lowPolyPreviewImageFileName)
        : "";
      const existingPreviewGifPath = record.lowPolyPreviewGifFileName
        ? path.join(modelDirectory, record.lowPolyPreviewGifFileName)
        : "";
      if (existingPreviewPath && await fileExists(existingPreviewPath) && existingPreviewGifPath && await fileExists(existingPreviewGifPath)) {
        return {
          ...record,
          lowPolyRealWorldSizeTier: nextRealWorldSizeTier,
          lowPolyRealWorldReference: nextRealWorldReference,
          lowPolyRealWorldWidthMeters: nextDimensions?.widthMeters ?? record.lowPolyRealWorldWidthMeters,
          lowPolyRealWorldHeightMeters: nextDimensions?.heightMeters ?? record.lowPolyRealWorldHeightMeters,
          lowPolyRealWorldDepthMeters: nextDimensions?.depthMeters ?? record.lowPolyRealWorldDepthMeters
        };
      }
      try {
        const previewMedia = await renderModelPreviewMedia({
          modelDirectory,
          modelFileName: record.lowPolyModelFileName as string,
          frameCount: MODEL_PREVIEW_TURNTABLE_FRAME_COUNT,
          frameDelayMs: MODEL_PREVIEW_TURNTABLE_FRAME_DELAY_MS
        });
        return {
          ...record,
          lowPolyPreviewImageFileName: previewMedia.previewImageFileName ?? record.lowPolyPreviewImageFileName,
          lowPolyPreviewGifFileName: previewMedia.previewGifFileName ?? record.lowPolyPreviewGifFileName,
          lowPolyRealWorldSizeTier: nextRealWorldSizeTier,
          lowPolyRealWorldReference: nextRealWorldReference,
          lowPolyRealWorldWidthMeters: nextDimensions?.widthMeters ?? record.lowPolyRealWorldWidthMeters,
          lowPolyRealWorldHeightMeters: nextDimensions?.heightMeters ?? record.lowPolyRealWorldHeightMeters,
          lowPolyRealWorldDepthMeters: nextDimensions?.depthMeters ?? record.lowPolyRealWorldDepthMeters
        };
      } catch (error) {
        console.warn("Failed to render low poly preview media from existing output.", error);
      }
      return {
        ...record,
        lowPolyRealWorldSizeTier: nextRealWorldSizeTier,
        lowPolyRealWorldReference: nextRealWorldReference,
        lowPolyRealWorldWidthMeters: nextDimensions?.widthMeters ?? record.lowPolyRealWorldWidthMeters,
        lowPolyRealWorldHeightMeters: nextDimensions?.heightMeters ?? record.lowPolyRealWorldHeightMeters,
        lowPolyRealWorldDepthMeters: nextDimensions?.depthMeters ?? record.lowPolyRealWorldDepthMeters
      };
    }
    const sourceModelPath = path.join(modelDirectory, record.modelFileName);
    await stat(sourceModelPath);
    const sourceStem = path.basename(record.modelFileName, path.extname(record.modelFileName)) || "model";
    const desiredOutputName = sanitizeFileName(`${sourceStem}_lowpoly.fbx`, "model_lowpoly.fbx");
    const outputFileName = await ensureUniqueFileName(modelDirectory, desiredOutputName);
    const outputModelPath = path.join(modelDirectory, outputFileName);
    const resolvedOutputPath = await runLowPolyModelScript({
      sourceModelPath,
      outputModelPath,
      targetFaceCount,
      newMeshName: input.newMeshName,
      mergeVertices: input.mergeVertices,
      shouldDecimate: input.shouldDecimate,
      maxColors: input.maxColors,
      blockSize: input.blockSize
    });
    const resolvedOutputDirectory = path.dirname(resolvedOutputPath);
    const resolvedOutputFileName = path.basename(resolvedOutputPath);
    const outputFileNameForRecord = path.resolve(resolvedOutputDirectory) === path.resolve(modelDirectory)
      ? resolvedOutputFileName
      : await (async () => {
        const copiedName = await ensureUniqueFileName(modelDirectory, sanitizeFileName(resolvedOutputFileName, "model_lowpoly.fbx"));
        await copyFile(resolvedOutputPath, path.join(modelDirectory, copiedName));
        return copiedName;
      })();
    await assertRustValidatedModelArtifact(path.join(modelDirectory, outputFileNameForRecord), "Generated low poly model");
    let lowPolyPreviewImageFileName = record.lowPolyPreviewImageFileName;
    let lowPolyPreviewGifFileName = record.lowPolyPreviewGifFileName;
    try {
      const previewMedia = await renderModelPreviewMedia({
        modelDirectory,
        modelFileName: outputFileNameForRecord,
        frameCount: MODEL_PREVIEW_TURNTABLE_FRAME_COUNT,
        frameDelayMs: MODEL_PREVIEW_TURNTABLE_FRAME_DELAY_MS
      });
      lowPolyPreviewImageFileName = previewMedia.previewImageFileName;
      lowPolyPreviewGifFileName = previewMedia.previewGifFileName;
    } catch (error) {
      console.warn("Failed to render low poly preview media.", error);
      lowPolyPreviewImageFileName = null;
      lowPolyPreviewGifFileName = null;
    }
    return {
      ...record,
      lowPolyModelFileName: outputFileNameForRecord,
      lowPolyPreviewImageFileName,
      lowPolyPreviewGifFileName,
      lowPolyTargetFaceCount: targetFaceCount,
      lowPolyRealWorldSizeTier: nextRealWorldSizeTier,
      lowPolyRealWorldReference: nextRealWorldReference,
      lowPolyRealWorldWidthMeters: nextDimensions?.widthMeters ?? record.lowPolyRealWorldWidthMeters,
      lowPolyRealWorldHeightMeters: nextDimensions?.heightMeters ?? record.lowPolyRealWorldHeightMeters,
      lowPolyRealWorldDepthMeters: nextDimensions?.depthMeters ?? record.lowPolyRealWorldDepthMeters
    };
  });
  return toGeneratedModelPublicRecord(updated);
}

export async function generateGeneratedModelLods(input: {
  modelId: string;
  targetFaceCounts: number[];
}): Promise<GeneratedModelPublicRecord> {
  const safeModelId = sanitizeFileName(input.modelId, "");
  if (!safeModelId) {
    throw new Error("Invalid model id.");
  }
  const targetFaceCounts = [...new Set(input.targetFaceCounts
    .map(value => Math.round(Number(value)))
    .filter(value => Number.isFinite(value) && value > 0))]
    .sort((left, right) => right - left)
    .slice(0, 5);
  if (targetFaceCounts.length === 0) {
    throw new Error("At least one positive LOD target face count is required.");
  }
  const updated = await mutateGeneratedModelRecord(safeModelId, async record => {
    const modelDirectory = path.join(generatedModelsDirectory, safeModelId);
    const sourceModelPath = path.join(modelDirectory, record.modelFileName);
    await stat(sourceModelPath);
    const sourceExtension = path.extname(record.modelFileName).toLowerCase();
    const outputExtension = sourceExtension === ".gltf" ? ".glb" : sourceExtension;
    if (![".fbx", ".glb"].includes(outputExtension)) {
      throw new Error(`LOD generation does not support "${sourceExtension || "unknown"}" model files.`);
    }
    const sourceStem = path.basename(record.modelFileName, sourceExtension) || "model";
    const generatedArtifacts: GeneratedModelLodArtifact[] = [];
    try {
      for (let index = 0; index < targetFaceCounts.length; index += 1) {
        const targetFaceCount = targetFaceCounts[index];
        if (!targetFaceCount) {
          continue;
        }
        const level = index + 1;
        const desiredName = sanitizeFileName(`${sourceStem}_lod${level}_${targetFaceCount}${outputExtension}`, `model_lod${level}${outputExtension}`);
        const fileName = await ensureUniqueFileName(modelDirectory, desiredName);
        const outputModelPath = path.join(modelDirectory, fileName);
        await runModelDecimateToFacesScript({ sourceModelPath, outputModelPath, targetFaceCount });
        await assertRustValidatedModelArtifact(outputModelPath, `Generated LOD ${level}`);
        generatedArtifacts.push({ level, targetFaceCount, fileName });
      }
    } catch (error) {
      await Promise.all(generatedArtifacts.map(artifact => rm(path.join(modelDirectory, artifact.fileName), { force: true }).catch(() => undefined)));
      throw error;
    }
    const generatedNames = new Set(generatedArtifacts.map(artifact => artifact.fileName));
    await Promise.all(record.lodArtifacts
      .filter(artifact => !generatedNames.has(artifact.fileName))
      .map(artifact => rm(path.join(modelDirectory, artifact.fileName), { force: true }).catch(() => undefined)));
    return { ...record, lodArtifacts: generatedArtifacts };
  });
  return toGeneratedModelPublicRecord(updated);
}

export async function applyGeneratedModelSeparateByLooseParts(input: {
  modelId: string;
  exportMode?: "per_part" | "single_file";
  mergeDistance?: number;
}): Promise<SeparateByLoosePartsResult> {
  const safeModelId = sanitizeFileName(input.modelId, "");
  if (!safeModelId) {
    throw new Error("Invalid model id.");
  }
  const exportMode = input.exportMode === "single_file" ? "single_file" : "per_part";
  const sourceRecord = (await readGeneratedModelIndex()).find(entry => entry.id === safeModelId);
  if (!sourceRecord) {
    throw new Error("Model entry was not found.");
  }
  const resolveLoosePartsSourceFileName = (record: GeneratedModelRecord): string => {
    const originalName = String(record.originalModelFileName || "").trim();
    const currentName = String(record.modelFileName || "").trim();
    const originalExtension = path.extname(originalName).toLowerCase();
    return originalName && [".glb", ".gltf"].includes(originalExtension) ? originalName : currentName;
  };
  if (exportMode === "single_file") {
    const updated = await mutateGeneratedModelRecord(safeModelId, async record => {
      const modelDirectory = path.join(generatedModelsDirectory, safeModelId);
      await mkdir(modelDirectory, { recursive: true });
      const sourceModelPath = path.join(modelDirectory, record.modelFileName);
      await stat(sourceModelPath);
      const sourceExt = path.extname(record.modelFileName) || ".glb";
      const sourceStem = path.basename(record.modelFileName, sourceExt) || "model";
      const tempOutputName = await ensureUniqueFileName(
        modelDirectory,
        sanitizeFileName(`${sourceStem}_loose_parts_tmp${sourceExt}`, `model_loose_parts_tmp${sourceExt}`)
      );
      const tempOutputPath = path.join(modelDirectory, tempOutputName);
      const result = await runModelSeparateByLoosePartsScript({
        sourceModelPath,
        outputModelPath: tempOutputPath,
        exportMode,
        mergeDistance: input.mergeDistance
      });
      const resolvedOutputPath = result.outputPaths[0];
      if (!resolvedOutputPath) {
        throw new Error("Separate by loose parts did not export a model file.");
      }
      const resolvedOutputAbsolute = path.resolve(resolvedOutputPath);
      const sourceAbsolute = path.resolve(sourceModelPath);
      await assertRustValidatedModelArtifact(resolvedOutputAbsolute, "Separated loose-parts model");
      if (resolvedOutputAbsolute !== sourceAbsolute) {
        try {
          await rm(sourceModelPath, { force: true });
        } catch {}
        if (path.resolve(path.dirname(resolvedOutputAbsolute)) === path.resolve(modelDirectory)) {
          await rename(resolvedOutputAbsolute, sourceModelPath);
        } else {
          await copyFile(resolvedOutputAbsolute, sourceModelPath);
        }
      }
      if (resolvedOutputAbsolute !== sourceAbsolute) {
        try {
          await rm(resolvedOutputAbsolute, { force: true });
        } catch {}
      }
      let previewImageFileName = record.previewImageFileName;
      let previewGifFileName = record.previewGifFileName;
      try {
        const previewMedia = await renderModelPreviewMedia({
          modelDirectory,
          modelFileName: record.modelFileName,
          frameCount: MODEL_PREVIEW_TURNTABLE_FRAME_COUNT,
          frameDelayMs: MODEL_PREVIEW_TURNTABLE_FRAME_DELAY_MS
        });
        previewImageFileName = previewMedia.previewImageFileName;
        previewGifFileName = previewMedia.previewGifFileName;
      } catch (error) {
        console.warn("Failed to render preview media after loose-parts separation.", error);
        previewImageFileName = null;
        previewGifFileName = null;
      }
      return {
        ...record,
        previewImageFileName,
        previewGifFileName
      };
    });
    const generated = toGeneratedModelPublicRecord(updated);
    return {
      generated,
      models: [generated],
      partCount: 1,
      exportMode
    };
  }
  const modelDirectory = path.join(generatedModelsDirectory, safeModelId);
  await mkdir(modelDirectory, { recursive: true });
  const splitSourceFileName = resolveLoosePartsSourceFileName(sourceRecord);
  const sourceModelPath = path.join(modelDirectory, splitSourceFileName);
  await stat(sourceModelPath);
  const sourceExt = path.extname(splitSourceFileName) || ".glb";
  const sourceStem = path.basename(splitSourceFileName, sourceExt) || "model";
  const tempOutputPath = path.join(modelDirectory, sanitizeFileName(`${sourceStem}_loose_parts.glb`, "model_loose_parts.glb"));
  const result = await runModelSeparateByLoosePartsScript({
    sourceModelPath,
    outputModelPath: tempOutputPath,
    exportMode,
    mergeDistance: input.mergeDistance
  });
  const models: GeneratedModelPublicRecord[] = [];
  for (const outputPath of result.outputPaths) {
    const fileBuffer = await readFile(outputPath);
    const outputBaseName = path.basename(outputPath, path.extname(outputPath));
    const sidecarFiles = await collectGeneratedModelSidecarFiles(outputPath);
    const imported = await importUploadedSourceModel({
      fileName: path.basename(outputPath),
      fileData: fileBuffer,
      prompt: sourceRecord.prompt,
      mergedModelFileName: `${outputBaseName}_merged.glb`,
      useSourceAsCurrent: true,
      sidecarFiles
    });
    await createImportedModelPreviewMedia(imported.id, imported.modelFileName);
    const importedRecord = await getGeneratedModelPublicById(imported.id);
    if (importedRecord) {
      models.push(importedRecord);
    }
  }
  return {
    generated: models[0] ?? null,
    models,
    partCount: result.partCount,
    exportMode
  };
}

export async function applyGeneratedModelMetallic(input: {
  modelId: string;
  metallicEnabled: boolean;
}): Promise<GeneratedModelPublicRecord> {
  const safeModelId = sanitizeFileName(input.modelId, "");
  if (!safeModelId) {
    throw new Error("Invalid model id.");
  }
  const updated = await mutateGeneratedModelRecord(safeModelId, async record => {
    const modelDirectory = path.join(generatedModelsDirectory, safeModelId);
    await mkdir(modelDirectory, { recursive: true });
    const sourceModelPath = path.join(modelDirectory, record.modelFileName);
    await stat(sourceModelPath);
    const sourceExt = path.extname(record.modelFileName) || ".glb";
    const sourceStem = path.basename(record.modelFileName, sourceExt) || "model";
    const tempOutputName = await ensureUniqueFileName(
      modelDirectory,
      sanitizeFileName(`${sourceStem}_metallic_tmp${sourceExt}`, `model_metallic_tmp${sourceExt}`)
    );
    const tempOutputPath = path.join(modelDirectory, tempOutputName);
    const resolvedOutputPath = await runModelMetallicScript({
      sourceModelPath,
      outputModelPath: tempOutputPath,
      metallicEnabled: input.metallicEnabled
    });
    const resolvedOutputAbsolute = path.resolve(resolvedOutputPath);
    const sourceAbsolute = path.resolve(sourceModelPath);
    await assertRustValidatedModelArtifact(resolvedOutputAbsolute, "Metallic-adjusted model");
    if (resolvedOutputAbsolute !== sourceAbsolute) {
      try {
        await rm(sourceModelPath, { force: true });
      } catch {}
      if (path.resolve(path.dirname(resolvedOutputAbsolute)) === path.resolve(modelDirectory)) {
        await rename(resolvedOutputAbsolute, sourceModelPath);
      } else {
        await copyFile(resolvedOutputAbsolute, sourceModelPath);
      }
    }
    if (resolvedOutputAbsolute !== sourceAbsolute) {
      try {
        await rm(resolvedOutputAbsolute, { force: true });
      } catch {}
    }
    let previewImageFileName = record.previewImageFileName;
    let previewGifFileName = record.previewGifFileName;
    try {
      const previewMedia = await renderModelPreviewMedia({
        modelDirectory,
        modelFileName: record.modelFileName,
        frameCount: MODEL_PREVIEW_TURNTABLE_FRAME_COUNT,
        frameDelayMs: MODEL_PREVIEW_TURNTABLE_FRAME_DELAY_MS
      });
      previewImageFileName = previewMedia.previewImageFileName;
      previewGifFileName = previewMedia.previewGifFileName;
    } catch (error) {
      console.warn("Failed to render preview media after metallic pass.", error);
      previewImageFileName = null;
      previewGifFileName = null;
    }
    return {
      ...record,
      previewImageFileName,
      previewGifFileName
    };
  });
  return toGeneratedModelPublicRecord(updated);
}

export async function applyGeneratedModelMaterialFinish(input: {
  modelId: string;
  metallicEnabled?: boolean | null;
  roughnessValue?: number | null;
}): Promise<GeneratedModelPublicRecord> {
  const safeModelId = sanitizeFileName(input.modelId, "");
  if (!safeModelId) {
    throw new Error("Invalid model id.");
  }
  const hasMetallicOverride = typeof input.metallicEnabled === "boolean";
  const roughnessValue = typeof input.roughnessValue === "number" && Number.isFinite(input.roughnessValue)
    ? Math.max(0, Math.min(1, input.roughnessValue))
    : null;
  if (!hasMetallicOverride && roughnessValue === null) {
    throw new Error("No material override was provided.");
  }
  const updated = await mutateGeneratedModelRecord(safeModelId, async record => {
    const modelDirectory = path.join(generatedModelsDirectory, safeModelId);
    await mkdir(modelDirectory, { recursive: true });
    const sourceModelPath = path.join(modelDirectory, record.modelFileName);
    await stat(sourceModelPath);
    const sourceExt = path.extname(record.modelFileName) || ".glb";
    const sourceStem = path.basename(record.modelFileName, sourceExt) || "model";
    const tempOutputName = await ensureUniqueFileName(
      modelDirectory,
      sanitizeFileName(`${sourceStem}_material_tmp${sourceExt}`, `model_material_tmp${sourceExt}`)
    );
    const tempOutputPath = path.join(modelDirectory, tempOutputName);
    const resolvedOutputPath = await runModelMaterialScript({
      sourceModelPath,
      outputModelPath: tempOutputPath,
      metallicEnabled: hasMetallicOverride ? input.metallicEnabled === true : null,
      roughnessValue
    });
    const resolvedOutputAbsolute = path.resolve(resolvedOutputPath);
    const sourceAbsolute = path.resolve(sourceModelPath);
    await assertRustValidatedModelArtifact(resolvedOutputAbsolute, "Material-adjusted model");
    if (resolvedOutputAbsolute !== sourceAbsolute) {
      try {
        await rm(sourceModelPath, { force: true });
      } catch {}
      if (path.resolve(path.dirname(resolvedOutputAbsolute)) === path.resolve(modelDirectory)) {
        await rename(resolvedOutputAbsolute, sourceModelPath);
      } else {
        await copyFile(resolvedOutputAbsolute, sourceModelPath);
      }
    }
    if (resolvedOutputAbsolute !== sourceAbsolute) {
      try {
        await rm(resolvedOutputAbsolute, { force: true });
      } catch {}
    }
    let previewImageFileName = record.previewImageFileName;
    let previewGifFileName = record.previewGifFileName;
    try {
      const previewMedia = await renderModelPreviewMedia({
        modelDirectory,
        modelFileName: record.modelFileName,
        frameCount: MODEL_PREVIEW_TURNTABLE_FRAME_COUNT,
        frameDelayMs: MODEL_PREVIEW_TURNTABLE_FRAME_DELAY_MS
      });
      previewImageFileName = previewMedia.previewImageFileName;
      previewGifFileName = previewMedia.previewGifFileName;
    } catch (error) {
      console.warn("Failed to render preview media after material finish pass.", error);
      previewImageFileName = null;
      previewGifFileName = null;
    }
    return {
      ...record,
      previewImageFileName,
      previewGifFileName
    };
  });
  return toGeneratedModelPublicRecord(updated);
}

export async function applyGeneratedModelAlbedoToGeometry(input: {
  modelId: string;
  sourceVariant?: GeneratedModelArtifactVariant;
  strength?: number;
  subdivisions?: number;
  topologyMode?: "subdivision" | "multiresolution";
  blur?: number;
  autoSmooth?: boolean;
  selectedFacesOnly?: boolean;
  mergeBeforeSubdivide?: boolean;
  mergeAfterSubdivide?: boolean;
  mergeDistance?: number;
}): Promise<GeneratedModelPublicRecord> {
  const safeModelId = sanitizeFileName(input.modelId, "");
  if (!safeModelId) {
    throw new Error("Invalid model id.");
  }
  const updated = await mutateGeneratedModelRecord(safeModelId, async record => {
    const modelDirectory = path.join(generatedModelsDirectory, safeModelId);
    await mkdir(modelDirectory, { recursive: true });
    const sourceVariant = input.sourceVariant ?? "merged";
    const sourceModelFileName = sourceVariant === "original"
      ? record.originalModelFileName || record.modelFileName
      : sourceVariant === "lowpoly"
        ? record.lowPolyModelFileName
        : sourceVariant === "albedo"
          ? record.albedoGeometryModelFileName
          : record.modelFileName;
    if (!sourceModelFileName) {
      throw new Error(`Model artifact for variant "${sourceVariant}" was not found.`);
    }
    const sourceModelPath = path.join(modelDirectory, sourceModelFileName);
    await stat(sourceModelPath);
    const sourceExt = path.extname(sourceModelFileName) || ".glb";
    const sourceStem = path.basename(sourceModelFileName, sourceExt) || "model";
    const outputModelFileName = await ensureUniqueFileName(
      modelDirectory,
      sanitizeFileName(`${sourceStem}_geometry_from_albedo${sourceExt}`, `model_geometry_from_albedo${sourceExt}`)
    );
    const outputModelPath = path.join(modelDirectory, outputModelFileName);
    const resolvedOutputPath = await runModelAlbedoToGeometryScript({
      sourceModelPath,
      outputModelPath,
      strength: input.strength,
      subdivisions: input.subdivisions,
      topologyMode: input.topologyMode,
      blur: input.blur,
      autoSmooth: input.autoSmooth,
      selectedFacesOnly: input.selectedFacesOnly,
      mergeBeforeSubdivide: input.mergeBeforeSubdivide,
      mergeAfterSubdivide: input.mergeAfterSubdivide,
      mergeDistance: input.mergeDistance
    });
    const resolvedOutputAbsolute = path.resolve(resolvedOutputPath);
    await assertRustValidatedModelArtifact(resolvedOutputAbsolute, "Albedo-to-geometry model");
    if (resolvedOutputAbsolute !== path.resolve(outputModelPath)) {
      await copyFile(resolvedOutputAbsolute, outputModelPath);
      await rm(resolvedOutputAbsolute, { force: true });
    }
    let albedoGeometryPreviewImageFileName: string | null = null;
    let albedoGeometryPreviewGifFileName: string | null = null;
    try {
      const previewMedia = await renderModelPreviewMedia({
        modelDirectory,
        modelFileName: outputModelFileName,
        frameCount: MODEL_PREVIEW_TURNTABLE_FRAME_COUNT,
        frameDelayMs: MODEL_PREVIEW_TURNTABLE_FRAME_DELAY_MS
      });
      albedoGeometryPreviewImageFileName = previewMedia.previewImageFileName;
      albedoGeometryPreviewGifFileName = previewMedia.previewGifFileName;
    } catch (error) {
      console.warn("Failed to render preview media after albedo-to-geometry pass.", error);
    }
    const oldFiles = [
      record.albedoGeometryModelFileName,
      record.albedoGeometryPreviewImageFileName,
      record.albedoGeometryPreviewGifFileName
    ].filter((fileName): fileName is string => Boolean(fileName)
      && fileName !== outputModelFileName
      && fileName !== albedoGeometryPreviewImageFileName
      && fileName !== albedoGeometryPreviewGifFileName);
    await Promise.all(oldFiles.map(fileName => rm(path.join(modelDirectory, fileName), { force: true }).catch(() => undefined)));
    return {
      ...record,
      albedoGeometryModelFileName: outputModelFileName,
      albedoGeometryPreviewImageFileName,
      albedoGeometryPreviewGifFileName
    };
  });
  return toGeneratedModelPublicRecord(updated);
}

export async function applyGeneratedModelScaleToHeight(input: {
  modelId: string;
  targetHeightMeters: number;
}): Promise<GeneratedModelPublicRecord> {
  const safeModelId = sanitizeFileName(input.modelId, "");
  if (!safeModelId) {
    throw new Error("Invalid model id.");
  }
  const targetHeightMeters = typeof input.targetHeightMeters === "number" && Number.isFinite(input.targetHeightMeters)
    ? Math.max(0.03, Math.min(4000, input.targetHeightMeters))
    : 1.8;
  const updated = await mutateGeneratedModelRecord(safeModelId, async record => {
    const modelDirectory = path.join(generatedModelsDirectory, safeModelId);
    await mkdir(modelDirectory, { recursive: true });
    const sourceModelPath = path.join(modelDirectory, record.modelFileName);
    await stat(sourceModelPath);
    const sourceExt = path.extname(record.modelFileName) || ".glb";
    const sourceStem = path.basename(record.modelFileName, sourceExt) || "model";
    const tempOutputName = await ensureUniqueFileName(
      modelDirectory,
      sanitizeFileName(`${sourceStem}_scaled_tmp${sourceExt}`, `model_scaled_tmp${sourceExt}`)
    );
    const tempOutputPath = path.join(modelDirectory, tempOutputName);
    const resolvedOutputPath = await runModelScaleScript({
      sourceModelPath,
      outputModelPath: tempOutputPath,
      targetHeightMeters
    });
    const resolvedOutputAbsolute = path.resolve(resolvedOutputPath);
    const sourceAbsolute = path.resolve(sourceModelPath);
    await assertRustValidatedModelArtifact(resolvedOutputAbsolute, "Scaled model");
    if (resolvedOutputAbsolute !== sourceAbsolute) {
      try {
        await rm(sourceModelPath, { force: true });
      } catch {}
      if (path.resolve(path.dirname(resolvedOutputAbsolute)) === path.resolve(modelDirectory)) {
        await rename(resolvedOutputAbsolute, sourceModelPath);
      } else {
        await copyFile(resolvedOutputAbsolute, sourceModelPath);
      }
    }
    if (resolvedOutputAbsolute !== sourceAbsolute) {
      try {
        await rm(resolvedOutputAbsolute, { force: true });
      } catch {}
    }
    let previewImageFileName = record.previewImageFileName;
    let previewGifFileName = record.previewGifFileName;
    try {
      const previewMedia = await renderModelPreviewMedia({
        modelDirectory,
        modelFileName: record.modelFileName,
        frameCount: MODEL_PREVIEW_TURNTABLE_FRAME_COUNT,
        frameDelayMs: MODEL_PREVIEW_TURNTABLE_FRAME_DELAY_MS
      });
      previewImageFileName = previewMedia.previewImageFileName;
      previewGifFileName = previewMedia.previewGifFileName;
    } catch (error) {
      console.warn("Failed to render preview media after scale pass.", error);
      previewImageFileName = null;
      previewGifFileName = null;
    }
    return {
      ...record,
      previewImageFileName,
      previewGifFileName
    };
  });
  return toGeneratedModelPublicRecord(updated);
}

export async function applyGeneratedModelAutoRig(input: {
  modelId: string;
  llmProvider: "ollama" | "lmstudio" | "none";
  llmModel: string;
  ollamaUrl?: string;
  lmStudioBaseUrl?: string;
  lmStudioApiKey?: string;
  rigProfile?: string;
  useVision?: boolean;
  landmarks?: Record<string, [number, number, number]> | null;
}): Promise<GeneratedModelPublicRecord> {
  const safeModelId = sanitizeFileName(input.modelId, "");
  if (!safeModelId) {
    throw new Error("Invalid model id.");
  }
  const updated = await mutateGeneratedModelRecord(safeModelId, async record => {
    const modelDirectory = path.join(generatedModelsDirectory, safeModelId);
    await mkdir(modelDirectory, { recursive: true });
    const sourceModelPath = path.join(modelDirectory, record.modelFileName);
    await stat(sourceModelPath);
    const sourceExt = path.extname(record.modelFileName) || ".glb";
    const sourceStem = path.basename(record.modelFileName, sourceExt) || "model";
    const tempOutputName = await ensureUniqueFileName(
      modelDirectory,
      sanitizeFileName(`${sourceStem}_autorig_tmp${sourceExt}`, `model_autorig_tmp${sourceExt}`)
    );
    const tempOutputPath = path.join(modelDirectory, tempOutputName);
    const landmarksPath = input.landmarks
      ? path.join(modelDirectory, sanitizeFileName(`${sourceStem}_autorig_landmarks.json`, "autorig_landmarks.json"))
      : "";
    if (input.landmarks) {
      await writeFile(landmarksPath, JSON.stringify({ landmarks: input.landmarks }, null, 2), "utf8");
    }
    const resolvedOutputPath = await runModelAutoRigScript({
      sourceModelPath,
      outputModelPath: tempOutputPath,
      llmProvider: input.llmProvider,
      llmModel: input.llmModel,
      ollamaUrl: input.ollamaUrl,
      lmStudioBaseUrl: input.lmStudioBaseUrl,
      lmStudioApiKey: input.lmStudioApiKey,
      rigProfile: input.rigProfile,
      useVision: input.useVision,
      landmarksPath: landmarksPath || undefined
    });
    const resolvedOutputAbsolute = path.resolve(resolvedOutputPath);
    const sourceAbsolute = path.resolve(sourceModelPath);
    await assertRustValidatedModelArtifact(resolvedOutputAbsolute, "Auto-rigged model");
    if (resolvedOutputAbsolute !== sourceAbsolute) {
      try {
        await rm(sourceModelPath, { force: true });
      } catch {}
      if (path.resolve(path.dirname(resolvedOutputAbsolute)) === path.resolve(modelDirectory)) {
        await rename(resolvedOutputAbsolute, sourceModelPath);
      } else {
        await copyFile(resolvedOutputAbsolute, sourceModelPath);
      }
    }
    if (resolvedOutputAbsolute !== sourceAbsolute) {
      try {
        await rm(resolvedOutputAbsolute, { force: true });
      } catch {}
    }
    let previewImageFileName = record.previewImageFileName;
    let previewGifFileName = record.previewGifFileName;
    try {
      const previewMedia = await renderModelPreviewMedia({
        modelDirectory,
        modelFileName: record.modelFileName,
        frameCount: MODEL_PREVIEW_TURNTABLE_FRAME_COUNT,
        frameDelayMs: MODEL_PREVIEW_TURNTABLE_FRAME_DELAY_MS
      });
      previewImageFileName = previewMedia.previewImageFileName;
      previewGifFileName = previewMedia.previewGifFileName;
    } catch (error) {
      console.warn("Failed to render preview media after AutoRig pass.", error);
      previewImageFileName = null;
      previewGifFileName = null;
    }
    return {
      ...record,
      previewImageFileName,
      previewGifFileName
    };
  });
  return toGeneratedModelPublicRecord(updated);
}

export async function previewGeneratedModelAutoRig(input: {
  modelId: string;
  llmProvider: "ollama" | "lmstudio" | "none";
  llmModel: string;
  ollamaUrl?: string;
  lmStudioBaseUrl?: string;
  lmStudioApiKey?: string;
  rigProfile?: string;
  useVision?: boolean;
  landmarks?: Record<string, [number, number, number]> | null;
}): Promise<AutoRigVerificationPreview> {
  const safeModelId = sanitizeFileName(input.modelId, "");
  if (!safeModelId) {
    throw new Error("Invalid model id.");
  }
  const models = await readGeneratedModelIndex();
  const record = models.find(entry => entry.id === safeModelId);
  if (!record) {
    throw new Error("Model entry was not found.");
  }
  const modelDirectory = path.join(generatedModelsDirectory, safeModelId);
  const sourceModelPath = path.join(modelDirectory, record.modelFileName);
  await stat(sourceModelPath);
  const previewDirectoryPath = path.join(modelDirectory, "autorig-preview");
  await mkdir(previewDirectoryPath, { recursive: true });
  const resultJsonPath = path.join(previewDirectoryPath, "autorig-preview.json");
  const landmarksPath = input.landmarks ? path.join(previewDirectoryPath, "autorig-preview-landmarks.json") : "";
  if (input.landmarks) {
    await writeFile(landmarksPath, JSON.stringify({ landmarks: input.landmarks }, null, 2), "utf8");
  }
  const resolvedJsonPath = await runModelAutoRigPreviewScript({
    sourceModelPath,
    resultJsonPath,
    previewDirectoryPath,
    llmProvider: input.llmProvider,
    llmModel: input.llmModel,
    ollamaUrl: input.ollamaUrl,
    lmStudioBaseUrl: input.lmStudioBaseUrl,
    lmStudioApiKey: input.lmStudioApiKey,
    rigProfile: input.rigProfile,
    useVision: input.useVision,
    landmarksPath: landmarksPath || undefined
  });
  const parsed = parseJsonWithOptionalBom<unknown>(await readFile(resolvedJsonPath, "utf8"));
  return normalizeAutoRigPreviewPayload(safeModelId, parsed);
}

export async function importGeneratedModelLowPolyArtifact(input: {
  modelId: string;
  lowPolyFileName: string;
  lowPolyFileData: Buffer;
  lowPolyPreviewImageFileName?: string | null;
  lowPolyPreviewImageData?: Buffer | null;
  lowPolyPreviewGifFileName?: string | null;
  lowPolyPreviewGifData?: Buffer | null;
  lowPolyTargetFaceCount?: number | null;
  lowPolyRealWorldSizeTier?: RealWorldSizeTier | null;
  lowPolyRealWorldReference?: string | null;
  lowPolyRealWorldDimensions?: RealWorldDimensions | null;
}): Promise<GeneratedModelPublicRecord> {
  const safeModelId = sanitizeFileName(input.modelId, "");
  const normalizedInputName = sanitizeFileName(input.lowPolyFileName, "");
  if (!safeModelId || !normalizedInputName) {
    throw new Error("Invalid model id or low poly file name.");
  }
  if (!input.lowPolyFileData || input.lowPolyFileData.length === 0) {
    throw new Error("Low poly model payload is empty.");
  }
  const updated = await mutateGeneratedModelRecord(safeModelId, async record => {
    const normalizedDimensions = normalizeRealWorldDimensions(input.lowPolyRealWorldDimensions);
    const modelDirectory = path.join(generatedModelsDirectory, safeModelId);
    await mkdir(modelDirectory, { recursive: true });
    const defaultOutputName = `${path.basename(record.modelFileName, path.extname(record.modelFileName)) || "model"}_lowpoly.fbx`;
    const extension = extensionFromFileName(normalizedInputName) || ".fbx";
    const desiredName = sanitizeFileName(normalizedInputName, sanitizeFileName(defaultOutputName, "model_lowpoly.fbx"));
    const stem = path.basename(desiredName, path.extname(desiredName)) || "model_lowpoly";
    const normalizedName = `${stem}${extension}`;
    const finalName = await ensureUniqueFileName(modelDirectory, normalizedName);
    await writeFile(path.join(modelDirectory, finalName), input.lowPolyFileData);
    await assertRustValidatedModelArtifact(path.join(modelDirectory, finalName), "Imported low poly model");
    let lowPolyPreviewImageFileName: string | null = null;
    const previewInputName = sanitizeFileName(input.lowPolyPreviewImageFileName ?? "", "");
    const previewBytes = input.lowPolyPreviewImageData ?? null;
    if (previewInputName && previewBytes && previewBytes.length > 0) {
      const previewExt = extensionFromFileName(previewInputName) || ".png";
      const previewStem = path.basename(previewInputName, path.extname(previewInputName)) || `${stem}_preview`;
      const previewDesiredName = sanitizeFileName(`${previewStem}${previewExt}`, `${stem}_preview.png`);
      const previewFinalName = await ensureUniqueFileName(modelDirectory, previewDesiredName);
      await writeFile(path.join(modelDirectory, previewFinalName), previewBytes);
      lowPolyPreviewImageFileName = previewFinalName;
    }
    let lowPolyPreviewGifFileName: string | null = null;
    const previewGifInputName = sanitizeFileName(input.lowPolyPreviewGifFileName ?? "", "");
    const previewGifBytes = input.lowPolyPreviewGifData ?? null;
    if (previewGifInputName && previewGifBytes && previewGifBytes.length > 0) {
      const previewGifDesiredName = sanitizeFileName(
        `${path.basename(previewGifInputName, path.extname(previewGifInputName)) || `${stem}_preview`}.gif`,
        `${stem}_preview.gif`
      );
      const previewGifFinalName = await ensureUniqueFileName(modelDirectory, previewGifDesiredName);
      await writeFile(path.join(modelDirectory, previewGifFinalName), previewGifBytes);
      lowPolyPreviewGifFileName = previewGifFinalName;
    }
    return {
      ...record,
      lowPolyModelFileName: finalName,
      lowPolyPreviewImageFileName,
      lowPolyPreviewGifFileName,
      lowPolyTargetFaceCount: asInteger(input.lowPolyTargetFaceCount) ?? asInteger(record.lowPolyTargetFaceCount),
      lowPolyRealWorldSizeTier: parseRealWorldSizeTier(input.lowPolyRealWorldSizeTier) ?? record.lowPolyRealWorldSizeTier,
      lowPolyRealWorldReference: (input.lowPolyRealWorldReference?.trim() ?? "") || record.lowPolyRealWorldReference || null,
      lowPolyRealWorldWidthMeters: normalizedDimensions?.widthMeters ?? record.lowPolyRealWorldWidthMeters,
      lowPolyRealWorldHeightMeters: normalizedDimensions?.heightMeters ?? record.lowPolyRealWorldHeightMeters,
      lowPolyRealWorldDepthMeters: normalizedDimensions?.depthMeters ?? record.lowPolyRealWorldDepthMeters
    };
  });
  return toGeneratedModelPublicRecord(updated);
}

async function findGeneratedModelArtifactSidecarByBaseName(modelDirectory: string, fileName: string, maxDepth = 3): Promise<string | null> {
  const targetBaseName = path.basename(fileName).toLowerCase();
  if (!targetBaseName) {
    return null;
  }
  const queue: Array<{ directory: string; depth: number; }> = [{ directory: modelDirectory, depth: 0 }];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }
    const entries = await readdir(current.directory, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(current.directory, entry.name);
      if (entry.isFile() && entry.name.toLowerCase() === targetBaseName) {
        return absolutePath;
      }
      if (entry.isDirectory() && current.depth < maxDepth) {
        queue.push({ directory: absolutePath, depth: current.depth + 1 });
      }
    }
  }
  return null;
}

const generatedModelFbxTextureFallbackPrefix = "__fbx-texture-fallback__/";

async function findGeneratedModelTextureFallbackPath(modelDirectory: string, model: GeneratedModelRecord, requestedFilePath: string): Promise<string | null> {
  const normalizedRequest = normalizeGeneratedModelRequestedFilePath(requestedFilePath).toLowerCase();
  const requestedBaseName = path.basename(normalizedRequest);
  const fallbackFileNames = [
    model.uvMapFileName,
    model.uvMapInpaintFileName,
    model.previewImageFileName,
    model.normalMapFileName,
    ...model.multiViewFileNames
  ].map(fileName => String(fileName || "").trim()).filter(Boolean);
  const orderedFileNames = [
    ...fallbackFileNames.filter(fileName => path.basename(fileName).toLowerCase() === requestedBaseName),
    ...fallbackFileNames.filter(fileName => path.basename(fileName).toLowerCase() !== requestedBaseName)
  ];
  for (const fileName of orderedFileNames) {
    const fallbackPath = path.join(modelDirectory, fileName);
    try {
      await stat(fallbackPath);
      return fallbackPath;
    } catch {}
  }
  return null;
}

function normalizeGeneratedModelRequestedFilePath(fileName: string): string {
  const trimmed = String(fileName || "").trim();
  if (!trimmed) {
    return "";
  }
  const normalized = trimmed.replace(/\\/g, "/");
  if (/^[a-z]+:/i.test(normalized) || normalized.startsWith("//")) {
    return "";
  }
  const cleaned = normalized.replace(/^(\.\/)+/, "").replace(/^\/+/, "");
  const segments = cleaned.split("/").map(segment => segment.trim()).filter(Boolean);
  if (!segments.length || segments.some(segment => segment === "." || segment === "..")) {
    return "";
  }
  return segments.join("/");
}

export async function resolveGeneratedModelFilePath(modelId: string, fileName: string): Promise<string> {
  const safeModelId = sanitizeFileName(modelId, "");
  const rawRequestedFilePath = normalizeGeneratedModelRequestedFilePath(fileName);
  const prefersTextureFallback = rawRequestedFilePath.startsWith(generatedModelFbxTextureFallbackPrefix);
  const requestedFilePath = prefersTextureFallback
    ? normalizeGeneratedModelRequestedFilePath(rawRequestedFilePath.slice(generatedModelFbxTextureFallbackPrefix.length))
    : rawRequestedFilePath;
  if (!safeModelId || !requestedFilePath) {
    throw new Error("Invalid model file request.");
  }

  const models = await readGeneratedModelIndex();
  const model = models.find(entry => entry.id === safeModelId);
  if (!model) {
    throw new Error("Model entry was not found.");
  }

  const allowed = new Set<string>([
    model.sourceImageFileName,
    model.modelFileName,
    ...(model.originalModelFileName ? [model.originalModelFileName] : []),
    ...(model.lowPolyModelFileName ? [model.lowPolyModelFileName] : []),
    ...(model.lowPolyPreviewImageFileName ? [model.lowPolyPreviewImageFileName] : []),
    ...(model.lowPolyPreviewGifFileName ? [model.lowPolyPreviewGifFileName] : []),
    ...(model.previewGifFileName ? [model.previewGifFileName] : []),
    ...(model.previewImageFileName ? [model.previewImageFileName] : []),
    ...(model.uvMapFileName ? [model.uvMapFileName] : []),
    ...(model.uvMapInpaintFileName ? [model.uvMapInpaintFileName] : []),
      ...(model.normalMapFileName ? [model.normalMapFileName] : []),
      ...model.multiViewFileNames,
      ...model.lodArtifacts.map(artifact => artifact.fileName)
    ]);

  const modelDirectory = path.join(generatedModelsDirectory, safeModelId);
  if (!prefersTextureFallback && allowed.has(requestedFilePath)) {
    const absolutePath = path.join(modelDirectory, requestedFilePath);
    await stat(absolutePath);
    return absolutePath;
  }

  const nestedCandidatePath = path.resolve(modelDirectory, requestedFilePath);
  const allowedPrefix = path.resolve(modelDirectory) + path.sep;
  if (nestedCandidatePath.startsWith(allowedPrefix)) {
    try {
      await stat(nestedCandidatePath);
      return nestedCandidatePath;
    } catch {}
  }

  if (!prefersTextureFallback) {
    const sidecarPath = await findGeneratedModelArtifactSidecarByBaseName(modelDirectory, requestedFilePath);
    if (sidecarPath) {
      return sidecarPath;
    }
  }
  if (prefersTextureFallback) {
    const textureFallbackPath = await findGeneratedModelTextureFallbackPath(modelDirectory, model, requestedFilePath);
    if (textureFallbackPath) {
      return textureFallbackPath;
    }
  }
  throw new Error("Requested file is not part of this model artifact.");
}

export async function inspectGeneratedModelArtifact(input: {
  modelId: string;
  variant?: GeneratedModelArtifactVariant;
}): Promise<RustModelInspectionResult> {
  const safeModelId = sanitizeFileName(input.modelId, "");
  if (!safeModelId) {
    throw new Error("Invalid model id.");
  }

  const model = (await readGeneratedModelIndex()).find(entry => entry.id === safeModelId);
  if (!model) {
    throw new Error("Model entry was not found.");
  }

  const variant = input.variant ?? "merged";
  const fileName = variant === "original"
    ? model.originalModelFileName || model.modelFileName
    : variant === "lowpoly"
      ? model.lowPolyModelFileName
      : variant === "albedo"
        ? model.albedoGeometryModelFileName
        : model.modelFileName;
  if (!fileName) {
    throw new Error(`Model artifact for variant "${variant}" was not found.`);
  }

  const absolutePath = await resolveGeneratedModelFilePath(safeModelId, fileName);
  return inspectModelFileWithRust(absolutePath);
}

export async function validateGeneratedModelArtifact(input: {
  modelId: string;
  variant?: GeneratedModelArtifactVariant;
}): Promise<RustAssetValidationResult> {
  const safeModelId = sanitizeFileName(input.modelId, "");
  if (!safeModelId) {
    throw new Error("Invalid model id.");
  }
  const model = (await readGeneratedModelIndex()).find(entry => entry.id === safeModelId);
  if (!model) {
    throw new Error("Model entry was not found.");
  }
  const variant = input.variant ?? "merged";
  const fileName = variant === "original"
    ? model.originalModelFileName || model.modelFileName
    : variant === "lowpoly"
      ? model.lowPolyModelFileName
      : variant === "albedo"
        ? model.albedoGeometryModelFileName
        : model.modelFileName;
  if (!fileName) {
    throw new Error(`Model artifact for variant "${variant}" was not found.`);
  }

  const absolutePath = await resolveGeneratedModelFilePath(safeModelId, fileName);
  return validateModelFileWithRust(absolutePath);
}

export async function readGeneratedModelFile(modelId: string, fileName: string): Promise<{ data: Buffer; contentType: string }> {
  const absolutePath = await resolveGeneratedModelFilePath(modelId, fileName);
  return {
    data: await readFile(absolutePath),
    contentType: extensionToContentType(absolutePath)
  };
}

export async function captureGeneratedModelArtifact(input: {
  modelId: string;
  variant?: ModelCaptureVariant;
  action: ModelCaptureAction;
  options?: {
    width?: number;
    height?: number;
    quality?: number;
    engine?: "BLENDER_EEVEE_NEXT" | "CYCLES" | "BLENDER_WORKBENCH";
    projection?: "ORTHO" | "PERSP";
    shading?: "TEXTURE" | "MATERIAL";
    shadows?: "on" | "off";
    zoom?: number;
    rotateTarget?: "camera" | "object";
    axis?: "X" | "Y" | "Z";
    degrees?: number;
    frames?: number;
    background?: "transparent" | "solidcolor" | "skybox";
    bgColor?: string;
  };
}): Promise<{ data: Buffer; mimeType: "image/png" | "image/gif"; fileName: string }> {
  const safeModelId = sanitizeFileName(input.modelId, "");
  if (!safeModelId) {
    throw new Error("Invalid model id.");
  }
  const model = (await readGeneratedModelIndex()).find(entry => entry.id === safeModelId);
  if (!model) {
    throw new Error("Model entry was not found.");
  }
  const variant = input.variant ?? "merged";
  const fileName = variant === "original"
    ? model.originalModelFileName || model.modelFileName
    : variant === "lowpoly"
      ? model.lowPolyModelFileName
      : variant === "albedo"
        ? model.albedoGeometryModelFileName
        : model.modelFileName;
  if (!fileName) {
    throw new Error(`Model artifact for variant "${variant}" was not found.`);
  }
  const absolutePath = await resolveGeneratedModelFilePath(safeModelId, fileName);
  const baseStem = sanitizeFileName(path.basename(fileName, path.extname(fileName)) || `${safeModelId}-${variant}`, `${safeModelId}-${variant}`);
  const rendered = await renderModelCaptureWithBlender({
    sourceModelPath: absolutePath,
    action: input.action,
    outputStem: `${baseStem}-${input.action}`,
    options: input.options
  });
  return rendered;
}

export async function generate3dModelFromImage(input: GenerateModelInput): Promise<GeneratedModelRecord> {
  if (input.signal?.aborted) {
    const error = new Error("3D model generation was aborted.");
    error.name = "AbortError";
    throw error;
  }
  warnMissingOptionalModelNodeConfig();
  const promptText = (input.prompt ?? "").trim();
  const comfySettings = getComfyRuntimeSettings();
  const workflowPath = input.workflowPathOverride?.trim()
    ? resolveComfyWorkspacePath(input.workflowPathOverride)
    : comfySettings.comfyUiModelWorkflowPath;
  const workflowRaw = parseJsonWithOptionalBom<unknown>(await readFile(workflowPath, "utf8"));
  const workflowRoot = asRecord(workflowRaw);
  if (!workflowRoot) {
    throw new Error("ComfyUI 3D workflow JSON is invalid.");
  }
  const stagedSourceImage = await stageAndApplyModel3dImages(workflowRoot, input);
  applyOptionalModelPrompt(workflowRoot, promptText);
  applyOptionalModelSeed(workflowRoot, input.seed);
  const targetFaceCount = getWorkflowTargetFaceCount(workflowRoot);

  const timeoutMs = Math.max(30_000, appConfig.comfyUiModelTimeoutMs);
  const pollMs = Math.max(1_000, appConfig.comfyUiModelPollMs);
  const timeoutAt = Date.now() + timeoutMs;
  const comfyClientId = createId();

  const generationStartedAt = Date.now();
  const promptResponse = asRecord(await comfyPostJson("/prompt", {
    prompt: workflowRaw,
    client_id: comfyClientId
  }, input.signal));
  const promptId = asString(promptResponse?.prompt_id);
  if (!promptId) {
    throw new Error("ComfyUI did not return a prompt_id.");
  }
  await input.onPromptQueued?.(promptId);
  if (input.signal?.aborted) {
    const error = new Error("3D model generation was aborted.");
    error.name = "AbortError";
    throw error;
  }

  let outputs: Record<string, unknown> | null = null;
  let comfyExecutionDurationSeconds: number | null = null;
  const websocketWaitMs = Math.max(1_000, timeoutAt - Date.now());
  const completedViaWebSocket = await waitForComfyPromptCompletion(promptId, comfyClientId, websocketWaitMs, input.signal);
  if (input.signal?.aborted) {
    const error = new Error("3D model generation was aborted.");
    error.name = "AbortError";
    throw error;
  }
  if (completedViaWebSocket) {
    const historyPayload = await comfyGetJson(`/history/${encodeURIComponent(promptId)}`, input.signal);
    comfyExecutionDurationSeconds = extractComfyExecutionDurationSeconds(historyPayload);
    outputs = extractHistoryOutputs(historyPayload, promptId);
  }

  const outputNodeId = input.workflowOutputNodeId?.trim() || appConfig.comfyUiModelOutputNodeId;
  const previewNodeId = input.workflowPreviewNodeId?.trim() || appConfig.comfyUiModelPreviewNodeId;
  if (!outputs || !(parseModelAssetFromNode(outputs, outputNodeId) ?? findFallbackModelAsset(outputs))) {
    outputs = await waitForComfyHistoryOutputsByPolling(promptId, timeoutAt, pollMs, input.signal);
  }

  if (!outputs) {
    throw new Error("ComfyUI model generation did not produce history outputs in time.");
  }
  const generationDurationSeconds = comfyExecutionDurationSeconds ?? Math.max(0.01, (Date.now() - generationStartedAt) / 1000);

  const modelAsset = parseModelAssetFromNode(outputs, outputNodeId) ?? findFallbackModelAsset(outputs);
  if (!modelAsset) {
    throw new Error("ComfyUI did not produce a GLB/GLTF output for this run.");
  }

  const previewAsset = extractComfyImageAssets(outputs, previewNodeId)[0] ?? null;
  const uvAsset = extractComfyImageAssets(outputs, appConfig.comfyUiModelUvNodeId)[0] ?? null;
  const uvInpaintAsset = appConfig.comfyUiModelUvInpaintNodeId
    ? extractComfyImageAssets(outputs, appConfig.comfyUiModelUvInpaintNodeId)[0] ?? null
    : null;
  const normalAsset = appConfig.comfyUiModelNormalNodeId
    ? extractComfyImageAssets(outputs, appConfig.comfyUiModelNormalNodeId)[0] ?? null
    : null;
  const multiViewAssets = extractComfyImageAssets(outputs, appConfig.comfyUiModelMultiViewNodeId);

  const modelId = createId();
  const modelDirectory = path.join(generatedModelsDirectory, modelId);
  await mkdir(modelDirectory, { recursive: true });

  const writeDownloadedAsset = async (
    asset: ComfyImageAsset,
    fallbackBaseName: string
  ): Promise<string> => {
    const extension = extensionFromFileName(asset.filename) || extensionFromFileName(fallbackBaseName) || ".bin";
    const desiredName = sanitizeFileName(asset.filename, `${fallbackBaseName}${extension}`);
    const finalName = await ensureUniqueFileName(modelDirectory, desiredName);
    await writeFile(path.join(modelDirectory, finalName), await downloadComfyAsset(asset, input.signal));
    return finalName;
  };

  const originalModelFileName = await writeDownloadedAsset(modelAsset, "model.glb");
  const modelFileName = await createMergedModelCopyArtifact({ modelDirectory, sourceFileName: originalModelFileName });
  await assertRustValidatedModelArtifact(path.join(modelDirectory, modelFileName), "Generated 3D model");
  let sourceImageFileName = stagedSourceImage.fileName;
  try {
    const sourceNameFallback = `source-${createId()}${extensionFromFileName(stagedSourceImage.fileName) || ".png"}`;
    const desiredSourceName = sanitizeFileName(stagedSourceImage.fileName, sourceNameFallback);
    const finalSourceName = await ensureUniqueFileName(modelDirectory, desiredSourceName);
    await copyFile(
      path.join(comfySettings.comfyUiInputDir, stagedSourceImage.fileName),
      path.join(modelDirectory, finalSourceName)
    );
    sourceImageFileName = finalSourceName;
  } catch (error) {
    console.warn("Failed to persist source image inside model artifact.", error);
  }
  let record: GeneratedModelRecord = {
    id: modelId,
    createdAt: new Date().toISOString(),
    prompt: promptText,
    ...(promptText ? { description: promptText } : {}),
    targetFaceCount,
    lowPolyTargetFaceCount: null,
    sourceImageFileName,
    comfyPromptId: promptId,
    generationDurationSeconds,
    modelFileName,
    originalModelFileName,
    lowPolyModelFileName: null,
    albedoGeometryModelFileName: null,
    albedoGeometryPreviewImageFileName: null,
    albedoGeometryPreviewGifFileName: null,
    lowPolyPreviewImageFileName: null,
    lowPolyPreviewGifFileName: null,
    lowPolyRealWorldSizeTier: null,
    lowPolyRealWorldReference: null,
    lowPolyRealWorldWidthMeters: null,
    lowPolyRealWorldHeightMeters: null,
    lowPolyRealWorldDepthMeters: null,
    previewGifFileName: null,
    previewImageFileName: null,
    uvMapFileName: null,
    uvMapInpaintFileName: null,
    normalMapFileName: null,
    multiViewFileNames: [],
    lodArtifacts: []
  };
  await addGeneratedModelRecord(record);
  if (typeof input.onModelReady === "function") {
    await input.onModelReady(record);
  }
  let previewImageFileName = previewAsset ? await writeDownloadedAsset(previewAsset, "preview.png") : null;
  const uvMapFileName = uvAsset ? await writeDownloadedAsset(uvAsset, "uv-map.png") : null;
  const uvMapInpaintFileName = uvInpaintAsset ? await writeDownloadedAsset(uvInpaintAsset, "uv-map-inpaint.png") : null;
  const normalMapFileName = normalAsset ? await writeDownloadedAsset(normalAsset, "normal-map.png") : null;
  const multiViewFileNames: string[] = [];

  for (let index = 0; index < multiViewAssets.length; index += 1) {
    const asset = multiViewAssets[index];
    if (!asset) {
      continue;
    }
    multiViewFileNames.push(await writeDownloadedAsset(asset, `multiview-${index + 1}.png`));
  }

  let previewGifFileName: string | null = null;
  try {
    previewGifFileName = await createPreviewGifFromMultiView(modelDirectory, multiViewFileNames);
  } catch (error) {
    console.warn("Failed to create preview GIF from multiview frames.", error);
    previewGifFileName = null;
  }
  if (!previewGifFileName && previewImageFileName && /\.gif$/i.test(previewImageFileName)) {
    previewGifFileName = previewImageFileName;
  }
  try {
      const renderedPreview = await renderModelPreviewMedia({
        modelDirectory,
        modelFileName,
        frameCount: MODEL_PREVIEW_TURNTABLE_FRAME_COUNT,
        frameDelayMs: MODEL_PREVIEW_TURNTABLE_FRAME_DELAY_MS
      });
    if (renderedPreview.previewImageFileName) {
      previewImageFileName = renderedPreview.previewImageFileName;
    }
    if (renderedPreview.previewGifFileName) {
      previewGifFileName = renderedPreview.previewGifFileName;
    }
  } catch (error) {
    console.warn("Failed to render model turntable preview media.", error);
  }
  record = {
    ...record,
    previewGifFileName,
    previewImageFileName,
    uvMapFileName,
    uvMapInpaintFileName,
    normalMapFileName,
    multiViewFileNames
  };
  await mutateGeneratedModelRecord(modelId, async currentRecord => ({
    ...currentRecord,
    ...record
  }));
  return record;
}
