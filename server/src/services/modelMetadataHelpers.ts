import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { askOllama, askVisionOllama, type LlmConnectionSettings } from "./llm/ollama.js";
import { resolveGeneratedImageApiSourceToFilePath } from "./internalGeneratedImageSource.js";

export function extractJsonObjectText(raw: string): string {
  const direct = raw.trim();
  if (direct.startsWith("{") && direct.endsWith("}")) return direct;
  const fencedMatch = direct.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch?.[1]) {
    const fenced = fencedMatch[1].trim();
    if (fenced.startsWith("{") && fenced.endsWith("}")) return fenced;
  }
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new Error("Could not find JSON metadata in model naming response.");
  return raw.slice(start, end + 1);
}

export function normalizeModelNameCandidate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/[^\w.\- ]+/g, " ").replace(/\s+/g, "_").replace(/^_+/, "").slice(0, 90);
  return normalized || null;
}

export function normalizeModelDescriptionCandidate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 1200) : null;
}

export function parseDataUrlPayload(input: string): { mimeType: string; bytes: Buffer; } | null {
  const matched = input.trim().match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);
  if (!matched || !matched[2]) return null;
  return { mimeType: matched[1]?.toLowerCase() ?? "image/png", bytes: Buffer.from(matched[2], "base64") };
}

export type VisualInterpretationSubjectKind = "character" | "animal" | "creature" | "object" | "vehicle" | "structure" | "scene" | "unknown";
export type VisualInterpretationPose = "standing" | "sitting" | "lying" | "floating" | "unknown";

export interface CachedVisualInterpretation {
  objectLabel: string;
  subjectKind: VisualInterpretationSubjectKind;
  pose: VisualInterpretationPose;
  summary: string;
}

interface CachedVisualInterpretationEntry extends CachedVisualInterpretation {
  updatedAtMs: number;
}

const visualInterpretationCache = new Map<string, CachedVisualInterpretationEntry>();
const visualInterpretationCacheLimit = 180;
const visualInterpretationCacheTtlMs = 6 * 60 * 60 * 1000;

function hashVisualCacheInput(input: Buffer | string): string {
  return createHash("sha256").update(input).digest("hex");
}

function normalizeVisualSummary(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized ? normalized.slice(0, 320) : null;
}

export function normalizeVisualObjectLabel(value: unknown): string {
  if (typeof value !== "string") return "object";
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized ? normalized.slice(0, 60) : "object";
}

export function normalizeVisualSubjectKind(value: unknown): VisualInterpretationSubjectKind {
  if (typeof value !== "string") return "unknown";
  const normalized = value.trim().toLowerCase();
  if (!normalized) return "unknown";
  if (/character|person|human|humanoid/.test(normalized)) return "character";
  if (/animal|pet|mammal|bird|fish|reptile|insect/.test(normalized)) return "animal";
  if (/creature|monster|beast|alien|dragon/.test(normalized)) return "creature";
  if (/vehicle|car|truck|bike|motorcycle|plane|aircraft|ship|boat|train/.test(normalized)) return "vehicle";
  if (/building|house|tower|castle|bridge|architecture|structure/.test(normalized)) return "structure";
  if (/scene|environment|landscape|background/.test(normalized)) return "scene";
  if (/object|prop|item|thing/.test(normalized)) return "object";
  return "unknown";
}

export function normalizeVisualSubjectPose(value: unknown): VisualInterpretationPose {
  if (typeof value !== "string") return "unknown";
  const normalized = value.trim().toLowerCase();
  if (!normalized) return "unknown";
  if (/stand|standing|upright/.test(normalized)) return "standing";
  if (/sit|sitting|seated|crouch|kneel/.test(normalized)) return "sitting";
  if (/lying|laying|prone|supine|reclined/.test(normalized)) return "lying";
  if (/float|floating|hover|flying|airborne|swimming/.test(normalized)) return "floating";
  return "unknown";
}

function buildVisualSummary(input: { objectLabel?: unknown; subjectKind?: unknown; pose?: unknown; summary?: unknown; }): string {
  const explicitSummary = normalizeVisualSummary(input.summary);
  if (explicitSummary) return explicitSummary;
  const objectLabel = normalizeVisualObjectLabel(input.objectLabel);
  const subjectKind = normalizeVisualSubjectKind(input.subjectKind);
  const pose = normalizeVisualSubjectPose(input.pose);
  return `Main subject: ${objectLabel}. Kind: ${subjectKind}. Pose: ${pose}.`;
}

function pruneVisualInterpretationCache(nowMs: number): void {
  if (visualInterpretationCache.size === 0) return;
  for (const [cacheKey, entry] of visualInterpretationCache.entries()) {
    if ((nowMs - entry.updatedAtMs) > visualInterpretationCacheTtlMs) visualInterpretationCache.delete(cacheKey);
  }
  if (visualInterpretationCache.size <= visualInterpretationCacheLimit) return;
  const entries = [...visualInterpretationCache.entries()].sort((left, right) => left[1].updatedAtMs - right[1].updatedAtMs);
  const overflow = visualInterpretationCache.size - visualInterpretationCacheLimit;
  for (let index = 0; index < overflow; index += 1) {
    const targetKey = entries[index]?.[0];
    if (targetKey) visualInterpretationCache.delete(targetKey);
  }
}

async function resolveVisualInterpretationCacheKey(imageInput: string | undefined): Promise<string> {
  const trimmed = imageInput?.trim() ?? "";
  if (!trimmed) return "";
  const generatedImagePath = await resolveGeneratedImageApiSourceToFilePath(trimmed);
  const resolvedInput = generatedImagePath || trimmed;
  const parsedDataUrl = parseDataUrlPayload(resolvedInput);
  if (parsedDataUrl) return `bytes:${hashVisualCacheInput(parsedDataUrl.bytes)}`;
  if (/^https?:\/\//i.test(resolvedInput)) return `url:${hashVisualCacheInput(resolvedInput.toLowerCase())}`;
  const normalizedPath = resolvedInput.replace(/^\"(.*)\"$/, "$1");
  try {
    const bytes = await readFile(normalizedPath);
    return `bytes:${hashVisualCacheInput(bytes)}`;
  } catch {
    return `text:${hashVisualCacheInput(resolvedInput.toLowerCase())}`;
  }
}

export async function getCachedVisualInterpretation(imageInput?: string): Promise<CachedVisualInterpretation | null> {
  const cacheKey = await resolveVisualInterpretationCacheKey(imageInput);
  if (!cacheKey) return null;
  const nowMs = Date.now();
  pruneVisualInterpretationCache(nowMs);
  const cached = visualInterpretationCache.get(cacheKey);
  if (!cached) return null;
  cached.updatedAtMs = nowMs;
  return { objectLabel: cached.objectLabel, subjectKind: cached.subjectKind, pose: cached.pose, summary: cached.summary };
}

export async function upsertCachedVisualInterpretation(input: { imageInput?: string; objectLabel?: unknown; subjectKind?: unknown; pose?: unknown; summary?: unknown; }): Promise<void> {
  const cacheKey = await resolveVisualInterpretationCacheKey(input.imageInput);
  if (!cacheKey) return;
  const nowMs = Date.now();
  visualInterpretationCache.set(cacheKey, {
    objectLabel: normalizeVisualObjectLabel(input.objectLabel),
    subjectKind: normalizeVisualSubjectKind(input.subjectKind),
    pose: normalizeVisualSubjectPose(input.pose),
    summary: buildVisualSummary(input),
    updatedAtMs: nowMs
  });
  pruneVisualInterpretationCache(nowMs);
}

export async function getCachedVisualInterpretationPromptHint(imageInput?: string): Promise<string> {
  const cached = await getCachedVisualInterpretation(imageInput);
  return cached ? cached.summary.trim() : "";
}

export function buildVisionInterpretationPrompt(input: { promptContext?: string; extraContext?: string; }): string {
  return [
    "Analyze the image for downstream 3D generation decisions.",
    "Return JSON only with this schema:",
    "{\"objectLabel\":\"short label\",\"subjectKind\":\"character|animal|creature|object|vehicle|structure|scene|unknown\",\"pose\":\"standing|sitting|lying|floating|unknown\",\"summary\":\"max 24 words\"}",
    "Rules:",
    "- objectLabel must be concise and specific",
    "- Use pose only for character/animal/creature; otherwise pose=unknown",
    "- summary should mention identity and posture if relevant",
    "",
    `Prompt context: ${input.promptContext?.trim() || "none"}`,
    `Extra context: ${input.extraContext?.trim() || "none"}`
  ].join("\n");
}

export async function ensureVisualInterpretationForImage(input: {
  imageInput?: string;
  promptContext?: string;
  extraContext?: string;
  llmConnectionSettings?: LlmConnectionSettings;
}): Promise<CachedVisualInterpretation | null> {
  const normalizedImageInput = await normalizeImageInputForVisionModel(input.imageInput);
  if (!normalizedImageInput) return null;
  const cached = await getCachedVisualInterpretation(normalizedImageInput);
  if (cached) return cached;
  try {
    const raw = await askVisionOllama(buildVisionInterpretationPrompt({
      promptContext: input.promptContext,
      extraContext: input.extraContext
    }), [normalizedImageInput], input.llmConnectionSettings);
    const parsed = JSON.parse(extractJsonObjectText(raw)) as Record<string, unknown>;
    await upsertCachedVisualInterpretation({
      imageInput: normalizedImageInput,
      objectLabel: parsed.objectLabel,
      subjectKind: parsed.subjectKind,
      pose: parsed.pose,
      summary: parsed.summary
    });
    return getCachedVisualInterpretation(normalizedImageInput);
  } catch (error) {
    console.warn("Failed to build cached visual interpretation context.", error);
    return null;
  }
}

export function extensionFromMimeType(mimeType: string): string {
  const normalized = mimeType.toLowerCase();
  if (normalized.includes("png")) return ".png";
  if (normalized.includes("jpeg") || normalized.includes("jpg")) return ".jpg";
  if (normalized.includes("webp")) return ".webp";
  if (normalized.includes("gif")) return ".gif";
  if (normalized.includes("bmp")) return ".bmp";
  if (normalized.includes("tiff")) return ".tiff";
  return ".png";
}

export function sanitizeDiscordUploadFileName(value: string, fallback: string): string {
  const raw = value.trim() || fallback;
  const fromPath = raw.split(/[\\/]/).pop() || fallback;
  const cleaned = fromPath.replace(/[^\w.\- ]+/g, "_").replace(/\s+/g, "_").slice(0, 96);
  return cleaned || fallback;
}

export function inferSourceImageFileName(imageInput: string, fileNameHint?: string): string {
  if (fileNameHint?.trim()) return sanitizeDiscordUploadFileName(fileNameHint, "model-source.png");
  const parsedDataUrl = parseDataUrlPayload(imageInput);
  if (parsedDataUrl) return `model-source${extensionFromMimeType(parsedDataUrl.mimeType)}`;
  const trimmed = imageInput.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const pathname = new URL(trimmed).pathname;
      const fromUrl = pathname.split("/").pop() ?? "";
      return sanitizeDiscordUploadFileName(fromUrl, "model-source.png");
    } catch {
      return "model-source.png";
    }
  }
  return sanitizeDiscordUploadFileName(trimmed, "model-source.png");
}

export async function buildModelSourceImageAttachment(input: { imageInput: string; fileNameHint?: string; }): Promise<{ attachment: string | Buffer; name: string }> {
  const parsedDataUrl = parseDataUrlPayload(input.imageInput);
  const name = inferSourceImageFileName(input.imageInput, input.fileNameHint);
  if (parsedDataUrl) return { attachment: parsedDataUrl.bytes, name };
  const generatedImagePath = await resolveGeneratedImageApiSourceToFilePath(input.imageInput);
  if (generatedImagePath) return { attachment: generatedImagePath, name };
  return { attachment: input.imageInput, name };
}

export function buildImageDataUrl(input: { bytes: Buffer; contentType: string; }): string {
  const contentType = input.contentType.trim() || "image/png";
  return `data:${contentType};base64,${input.bytes.toString("base64")}`;
}

export function contentTypeFromImageFileExtension(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  if (ext === ".bmp") return "image/bmp";
  if (ext === ".tif" || ext === ".tiff") return "image/tiff";
  return "image/png";
}

export async function normalizeImageInputForVisionModel(imageInput: string | undefined): Promise<string> {
  const trimmed = imageInput?.trim() ?? "";
  if (!trimmed) return "";
  const generatedImagePath = await resolveGeneratedImageApiSourceToFilePath(trimmed);
  if (generatedImagePath) return generatedImagePath;
  if (/^data:image\/[a-z0-9.+-]+;base64,/i.test(trimmed) || /^https?:\/\//i.test(trimmed)) return trimmed;
  const normalizedPath = trimmed.replace(/^\"(.*)\"$/, "$1");
  try {
    const bytes = await readFile(normalizedPath);
    return buildImageDataUrl({ bytes, contentType: contentTypeFromImageFileExtension(normalizedPath) });
  } catch {
    return trimmed;
  }
}

export async function suggestModelFileNameAndDescription(input: {
  prompt: string;
  sourceImageInput?: string;
  preferVisualModel?: boolean;
  llmConnectionSettings?: LlmConnectionSettings;
}): Promise<{ fileName: string | null; description: string | null; }> {
  const promptText = input.prompt.trim();
  if (!promptText) return { fileName: null, description: null };
  const suggestionPrompt = [
    "You create concise metadata for a generated 3D model.",
    "If a source image is attached, use BOTH the source image and the text prompt together.",
    "Given the context below, return JSON only with:",
    "{\"fileName\":\"short-file-name-without-extension\",\"description\":\"one short Discord-friendly sentence\"}",
    "Rules:",
    "- fileName: 2-6 words, lowercase or snake_case, no extension",
    "- description: max 1 sentence",
    "- no markdown, no extra keys",
    "",
    "Text prompt context:",
    promptText
  ].join("\n");
  let response = "";
  const normalizedVisionImageInput = await normalizeImageInputForVisionModel(input.sourceImageInput);
  if (input.preferVisualModel && normalizedVisionImageInput) {
    try {
      response = await askVisionOllama(suggestionPrompt, [normalizedVisionImageInput], input.llmConnectionSettings);
    } catch (error) {
      console.warn("Visual metadata generation failed. Falling back to text-only metadata prompt.", error);
      response = "";
    }
  }
  if (!response) response = await askOllama(suggestionPrompt, false, input.llmConnectionSettings);
  const parsed = JSON.parse(extractJsonObjectText(response)) as Record<string, unknown>;
  return {
    fileName: normalizeModelNameCandidate(parsed.fileName),
    description: normalizeModelDescriptionCandidate(parsed.description)
  };
}
