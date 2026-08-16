import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { comfyImageRemoveBackgroundWorkflowRelativePaths, type ComfyImageRemoveBackgroundWorkflowMode } from "../../shared/comfyWorkflowPaths.js";
import { repositoryRootCandidates } from "@urage/server/config/repositoryPaths";
import { appConfig } from "../runtime/botBridge.js";

const uploadedModelImagesDirectory = path.resolve(appConfig.dataDirectory, "uploaded-model-images");
const removeBackgroundWorkflowRelativePaths = comfyImageRemoveBackgroundWorkflowRelativePaths;

export interface ParsedModel3dPostSettings {
  postTargetMode: "channel" | "thread" | "forum-post" | "forum-create-and-post";
  threadNameMode: "fixed" | "increment" | "model-name";
  threadName: string;
  threadNameBase: string;
  modelNameSource: "llm" | "filename";
  forumChannelId: string;
  forumChannelName: string;
  lowPolyForumChannelId: string;
  lowPolyForumChannelName: string;
  extraContent: string;
  initialExtraContent: string;
  sendInitialToSelectedChannel: boolean;
  modelUploadTarget: "selected" | "target";
  includeModelFile: boolean;
  includePreviewMedia: boolean;
  includeEmbed: boolean;
  includeEmbedInInitial: boolean;
  includeButtons: boolean;
  uploadTextureMessages: boolean;
  uploadMultiViewTextures: boolean;
  uploadUvMapTextures: boolean;
  uploadNormalMapTextures: boolean;
  textureUploadTarget: "selected" | "target";
  generateLowPolyVersion: boolean;
  lowPolyExecutionTarget: "local" | "remote";
  lowPolyUseLlmTargetFaces: boolean;
  lowPolyLlmDecisionSource: "input-image" | "model-render";
  lowPolyTargetFaceCount: number;
}

export function sanitizeUploadFileName(input: string): string {
  const base = path.basename((input || "").trim());
  const cleaned = base.replace(/[^\w.\-]+/g, "_").replace(/^_+/, "").slice(0, 100);
  return cleaned || "model_source.png";
}

export function extensionFromMime(mimeType: string): string {
  const normalized = mimeType.toLowerCase();
  if (normalized.includes("png")) return ".png";
  if (normalized.includes("jpeg") || normalized.includes("jpg")) return ".jpg";
  if (normalized.includes("webp")) return ".webp";
  if (normalized.includes("gif")) return ".gif";
  if (normalized.includes("bmp")) return ".bmp";
  if (normalized.includes("tiff")) return ".tiff";
  return ".png";
}

export function sanitizeImportedImageFileName(input: string, mimeType: string): string {
  const fallbackExtension = extensionFromMime(mimeType);
  const base = path.basename((input || "").trim()) || `imported-image${fallbackExtension}`;
  const cleaned = base.replace(/[^\w.\-]+/g, "_").replace(/^_+/, "").slice(0, 100);
  const withName = cleaned || `imported-image${fallbackExtension}`;
  return path.extname(withName) ? withName : `${withName}${fallbackExtension}`;
}

export async function resolveWorkspaceRelativePath(relativePath: string): Promise<string | null> {
  for (const workspaceRoot of repositoryRootCandidates) {
    const candidate = path.resolve(workspaceRoot, relativePath);
    try {
      await stat(candidate);
      return candidate;
    } catch {
      continue;
    }
  }
  return null;
}

export async function resolveRemoveBackgroundWorkflowPath(mode: string): Promise<{ mode: ComfyImageRemoveBackgroundWorkflowMode; workflowPath: string; }> {
  const normalizedMode: ComfyImageRemoveBackgroundWorkflowMode = mode === "lora" || mode === "lora-crop" ? mode : "source";
  const preferredOrder: ComfyImageRemoveBackgroundWorkflowMode[] = normalizedMode === "source" ? ["source", "lora-crop", "lora"] : [normalizedMode, "source"];
  for (const candidateMode of preferredOrder) {
    const workflowPath = await resolveWorkspaceRelativePath(removeBackgroundWorkflowRelativePaths[candidateMode]);
    if (workflowPath) {
      return { mode: candidateMode, workflowPath };
    }
  }
  throw new Error("No remove background workflow was found in comfyui-workflows/image.");
}

export async function resolveWorkflowPathOverridePath(overridePath: string): Promise<string | null> {
  const normalizedPath = String(overridePath || "").trim();
  if (!normalizedPath) {
    return null;
  }
  if (path.isAbsolute(normalizedPath)) {
    try {
      await stat(normalizedPath);
      return normalizedPath;
    } catch {
      return null;
    }
  }
  return resolveWorkspaceRelativePath(normalizedPath);
}

export function mergePromptWithRandomLine(prompt: string, randomLine: string): string {
  const promptText = prompt.trim();
  const lineText = randomLine.trim();
  if (!lineText) {
    return promptText;
  }
  if (!promptText) {
    return lineText;
  }
  if (promptText.includes("{line}")) {
    return promptText.replaceAll("{line}", lineText).trim();
  }
  return `${promptText}\n${lineText}`;
}

export function parseOptionalNumericInput(value: unknown, input: { min: number; max: number; integer?: boolean }): number | undefined {
  const parsed = typeof value === "number" ? value : (typeof value === "string" && value.trim() ? Number(value.trim()) : Number.NaN);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  const clamped = Math.min(input.max, Math.max(input.min, parsed));
  return input.integer === false ? clamped : Math.round(clamped);
}

function asWorkflowRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function asWorkflowArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

type WorkflowNumberOptions = {
  integer?: boolean;
};

export interface ImageWorkflowMetadata {
  width: number | null;
  height: number | null;
  seed: number | null;
  steps: number | null;
  cfg: number | null;
  usesSubgraphs: boolean;
  nodeTypes: string[];
  modelFileInputs: ImageWorkflowModelFileInput[];
}

export interface ImageWorkflowModelFileInput {
  nodeType: string;
  inputName: string;
  modelFile: string;
}

function parseWorkflowNumber(value: unknown, options?: WorkflowNumberOptions): number | null {
  const integer = options?.integer !== false;
  if (typeof value === "number" && Number.isFinite(value)) {
    return integer ? Math.round(value) : value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? (integer ? Math.round(parsed) : parsed) : null;
  }
  return null;
}

function readWorkflowNodeInputNumber(node: Record<string, unknown>, key: string, options?: WorkflowNumberOptions): number | null {
  const inputs = asWorkflowRecord(node.inputs);
  if (!inputs) {
    return null;
  }
  return parseWorkflowNumber(inputs[key], options);
}

function readUiWorkflowNodeInputNumber(node: Record<string, unknown>, key: string, options?: WorkflowNumberOptions): number | null {
  const inputs = asWorkflowArray(node.inputs);
  const widgetValues = asWorkflowArray(node.widgets_values);
  let widgetIndex = 0;
  for (const rawInput of inputs) {
    const input = asWorkflowRecord(rawInput);
    const hasWidget = asWorkflowRecord(input?.widget) !== null;
    if (input?.name === key && hasWidget) {
      return parseWorkflowNumber(widgetValues[widgetIndex], options);
    }
    if (hasWidget) {
      widgetIndex += 1;
    }
  }
  return null;
}

function isModelFileName(value: string): boolean {
  return /\.(safetensors|ckpt|pt|pth|gguf|onnx|engine|bin)$/i.test(value);
}

function readWorkflowModelFileInputs(nodes: Record<string, unknown>[]): ImageWorkflowModelFileInput[] {
  const result: ImageWorkflowModelFileInput[] = [];
  for (const node of nodes) {
    const nodeType = typeof node.class_type === "string" ? node.class_type.trim() : "";
    const inputs = asWorkflowRecord(node.inputs);
    if (!nodeType || !inputs) {
      continue;
    }
    for (const [inputName, value] of Object.entries(inputs)) {
      const modelFile = typeof value === "string" ? value.trim() : "";
      if (modelFile && isModelFileName(modelFile)) {
        result.push({ nodeType, inputName, modelFile });
      }
    }
  }
  return result;
}

export async function readImageWorkflowMetadata(workflowPath: string): Promise<ImageWorkflowMetadata | null> {
  const raw = await readFile(workflowPath, "utf8");
  const workflow = asWorkflowRecord(JSON.parse(raw.replace(/^\uFEFF/, "")));
  if (!workflow) {
    return null;
  }
  const nodes = asWorkflowArray(workflow.nodes).length > 0
    ? asWorkflowArray(workflow.nodes).map(asWorkflowRecord).filter((node): node is Record<string, unknown> => node !== null)
    : Object.values(workflow).map(asWorkflowRecord).filter((node): node is Record<string, unknown> => node !== null);
  const metadata: ImageWorkflowMetadata = {
    width: null,
    height: null,
    seed: null,
    steps: null,
    cfg: null,
    usesSubgraphs: asWorkflowArray(asWorkflowRecord(workflow.definitions)?.subgraphs).length > 0,
    nodeTypes: [...new Set(nodes.map(node => {
      const uiNodeType = typeof node.type === "string" ? node.type.trim() : "";
      const apiNodeType = typeof node.class_type === "string" ? node.class_type.trim() : "";
      return uiNodeType || apiNodeType;
    }).filter(Boolean))].sort((left, right) => left.localeCompare(right)),
    modelFileInputs: readWorkflowModelFileInputs(nodes)
  };
  for (const node of nodes) {
    const width = readWorkflowNodeInputNumber(node, "width") ?? readUiWorkflowNodeInputNumber(node, "width");
    const height = readWorkflowNodeInputNumber(node, "height") ?? readUiWorkflowNodeInputNumber(node, "height");
    const seed = readWorkflowNodeInputNumber(node, "seed") ?? readUiWorkflowNodeInputNumber(node, "seed");
    const steps = readWorkflowNodeInputNumber(node, "steps") ?? readUiWorkflowNodeInputNumber(node, "steps");
    const cfg = readWorkflowNodeInputNumber(node, "cfg", { integer: false }) ?? readUiWorkflowNodeInputNumber(node, "cfg", { integer: false });
    if (metadata.width === null && typeof width === "number" && width > 0) metadata.width = width;
    if (metadata.height === null && typeof height === "number" && height > 0) metadata.height = height;
    if (metadata.seed === null && typeof seed === "number") {
      if (seed <= 0)
        metadata.seed = Math.floor(Math.random() * 18446744073709552000);
      else
        metadata.seed = seed;
    }
    if (metadata.steps === null && typeof steps === "number" && steps > 0) metadata.steps = steps;
    if (metadata.cfg === null && typeof cfg === "number" && cfg >= 0) metadata.cfg = cfg;
    if (metadata.width !== null && metadata.height !== null && metadata.seed !== null && metadata.steps !== null && metadata.cfg !== null) {
      return metadata;
    }
  }
  return Object.values(metadata).some(value => value !== null && value !== false && (!Array.isArray(value) || value.length > 0)) ? metadata : null;
}

export async function readImageWorkflowDimensions(workflowPath: string): Promise<{ width: number; height: number } | null> {
  const metadata = await readImageWorkflowMetadata(workflowPath);
  if (!metadata?.width || !metadata?.height) {
    return null;
  }
  return { width: metadata.width, height: metadata.height };
}

export async function ensureUniqueUploadPath(fileName: string): Promise<{ absolutePath: string; fileName: string }> {
  await mkdir(uploadedModelImagesDirectory, { recursive: true });
  const safe = sanitizeUploadFileName(fileName);
  const ext = path.extname(safe) || ".png";
  const stem = path.basename(safe, ext) || "model_source";
  let candidate = `${stem}${ext}`;
  let counter = 1;
  while (true) {
    const absolutePath = path.join(uploadedModelImagesDirectory, candidate);
    try {
      await writeFile(absolutePath, Buffer.alloc(0), { flag: "wx" });
      return { absolutePath, fileName: candidate };
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code !== "EEXIST") {
        throw error;
      }
      candidate = `${stem}_${counter}${ext}`;
      counter += 1;
    }
  }
}

export function parseModel3dPostSettings(body: Record<string, unknown>): ParsedModel3dPostSettings {
  return {
    postTargetMode: body.postTargetMode === "thread" || body.postTargetMode === "forum-post" || body.postTargetMode === "forum-create-and-post" ? body.postTargetMode : "channel",
    threadNameMode: body.threadNameMode === "increment" || body.threadNameMode === "model-name" ? body.threadNameMode : "fixed",
    threadName: typeof body.threadName === "string" ? body.threadName.trim() : "",
    threadNameBase: typeof body.threadNameBase === "string" ? body.threadNameBase.trim() : "",
    modelNameSource: body.modelNameSource === "filename" ? "filename" : "llm",
    forumChannelId: typeof body.forumChannelId === "string" ? body.forumChannelId.trim() : "",
    forumChannelName: typeof body.forumChannelName === "string" ? body.forumChannelName.trim() : "",
    lowPolyForumChannelId: typeof body.lowPolyForumChannelId === "string" ? body.lowPolyForumChannelId.trim() : "",
    lowPolyForumChannelName: typeof body.lowPolyForumChannelName === "string" ? body.lowPolyForumChannelName.trim() : "",
    extraContent: typeof body.extraContent === "string" ? body.extraContent.trim() : "",
    initialExtraContent: typeof body.initialExtraContent === "string" ? body.initialExtraContent.trim() : "",
    sendInitialToSelectedChannel: body.sendInitialToSelectedChannel === true,
    modelUploadTarget: body.modelUploadTarget === "target" ? "target" : "selected",
    includeModelFile: body.includeModelFile !== false,
    includePreviewMedia: body.includePreviewMedia !== false,
    includeEmbed: body.includeEmbed !== false,
    includeEmbedInInitial: body.includeEmbedInInitial !== false,
    includeButtons: body.includeButtons !== false,
    uploadTextureMessages: body.uploadTextureMessages === true,
    uploadMultiViewTextures: body.uploadMultiViewTextures !== false,
    uploadUvMapTextures: body.uploadUvMapTextures !== false,
    uploadNormalMapTextures: body.uploadNormalMapTextures !== false,
    textureUploadTarget: body.textureUploadTarget === "selected" ? "selected" : "target",
    generateLowPolyVersion: body.generateLowPolyVersion === true,
    lowPolyExecutionTarget: body.lowPolyExecutionTarget === "remote" ? "remote" : "local",
    lowPolyUseLlmTargetFaces: body.lowPolyUseLlmTargetFaces === true,
    lowPolyLlmDecisionSource: body.lowPolyLlmDecisionSource === "model-render" ? "model-render" : "input-image",
    lowPolyTargetFaceCount: typeof body.lowPolyTargetFaceCount === "number" && Number.isFinite(body.lowPolyTargetFaceCount) ? Math.max(1, Math.round(body.lowPolyTargetFaceCount)) : 1500
  };
}
