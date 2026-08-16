import type { DashboardDependencies } from "../runtime/botBridge.js";
import type { ChatSkillArtifact, ChatSkillModelUpload } from "./types.js";

export type AskModelFn = DashboardDependencies["askModel"];

export function buildSingleImageBatchPrompt(prompt: string, index: number, total: number): string {
  const basePrompt = String(prompt || "").trim();
  if (!basePrompt) {
    return "";
  }
  if (total <= 1) {
    return basePrompt;
  }
  return [
    basePrompt,
    "",
    `Batch variation ${index + 1} of ${total}.`,
    "Generate exactly one standalone image for this call.",
    "If the user asked for multiple images, treat that as multiple separate outputs across calls, not multiple subjects or panels inside one image."
  ].join("\n").trim();
}

function buildSingleSubjectImagePrompt(subjectPrompt: string): string {
  const prompt = String(subjectPrompt || "").trim();
  if (!prompt) {
    return "";
  }
  return `single ${prompt}, centered composition, one complete uninterrupted image, one main subject, clean simple background`;
}

function buildImagePromptPlannerFallback(prompt: string, count: number): string[] {
  const normalizedCount = Math.max(1, Math.min(8, Math.round(count || 1)));
  const cleanedPrompt = String(prompt || "").trim();
  if (!cleanedPrompt) {
    return [];
  }
  if (normalizedCount <= 1) {
    return [buildSingleSubjectImagePrompt(cleanedPrompt)];
  }
  return Array.from({ length: normalizedCount }, () => buildSingleSubjectImagePrompt(cleanedPrompt));
}

export async function resolveStandaloneImagePrompts(input: {
  prompt: string;
  count: number;
  askModel: AskModelFn;
}): Promise<string[]> {
  const normalizedCount = Math.max(1, Math.min(8, Math.round(input.count || 1)));
  const fallbackPrompts = buildImagePromptPlannerFallback(input.prompt, normalizedCount);
  const plannerPrompt = [
    "You are writing prompts for an image generation model.",
    `Return only compact JSON: an array with exactly ${normalizedCount} strings.`,
    "Each string must be a polished visual prompt for exactly one standalone generated image.",
    "Do not include workflow instructions, numbering, markdown, explanations, or mentions of skills.",
    "If the user names multiple subjects, make one prompt per named subject and preserve shared style words in every prompt.",
    "Each prompt must describe one main subject only, with no collage, contact sheet, grid, split panel, or multiple-image layout.",
    "User request:",
    String(input.prompt || "").trim() || "(empty)"
  ].join("\n").trim();
  try {
    const answer = await input.askModel(plannerPrompt);
    const parsed = parseStringArrayJson(answer);
    if (parsed && parsed.length > 0) {
      return Array.from({ length: normalizedCount }, (_, index) =>
        buildSingleSubjectImagePrompt(parsed[index] || parsed[parsed.length - 1] || fallbackPrompts[index] || input.prompt)
      );
    }
  } catch {}
  return fallbackPrompts;
}

export function buildSingleModelSourcePrompt(prompt: string, index: number, total: number): string {
  const basePrompt = String(prompt || "").trim();
  if (!basePrompt) {
    return "";
  }
  return [
    basePrompt,
    total > 1 ? `\nSource image ${index + 1} of ${total}.` : "",
    "Generate exactly one standalone main subject for this image.",
    "Do not include multiple animals, characters, objects, group shots, collages, or panels.",
    "Keep the subject centered and fully visible on a simple neutral background for clean 3D model generation."
  ].filter(Boolean).join("\n").trim();
}

export function parseStringArrayJson(raw: string): string[] | null {
  const text = String(raw || "").trim();
  if (!text) {
    return null;
  }
  const candidates = [text];
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start >= 0 && end > start) {
    candidates.push(text.slice(start, end + 1));
  }
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (Array.isArray(parsed)) {
        const values = parsed.map(normalizePromptPlannerEntry).filter(Boolean);
        if (values.length > 0) {
          return values;
        }
      }
      if (parsed && typeof parsed === "object") {
        const record = parsed as Record<string, unknown>;
        const arrayCandidate = Array.isArray(record.prompts)
          ? record.prompts
          : Array.isArray(record.items)
            ? record.items
            : Array.isArray(record.results)
              ? record.results
              : null;
        const values = arrayCandidate ? arrayCandidate.map(normalizePromptPlannerEntry).filter(Boolean) : [];
        if (values.length > 0) {
          return values;
        }
      }
    } catch {}
  }
  return null;
}

function normalizePromptPlannerEntry(entry: unknown): string {
  if (typeof entry === "string") {
    return entry.trim();
  }
  if (!entry || typeof entry !== "object") {
    return "";
  }
  const record = entry as Record<string, unknown>;
  const candidates = [
    record.prompt,
    record.sourcePrompt,
    record.imagePrompt,
    record.modelPrompt,
    record.text,
    record.description,
    record.subject
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  return "";
}

export async function resolveStandaloneModelSourcePrompts(input: {
  prompt: string;
  count: number;
  askModel: AskModelFn;
}): Promise<string[]> {
  const normalizedCount = Math.max(1, Math.min(8, Math.round(input.count || 1)));
  const plannerPrompt = [
    "You are preparing source-image prompts for a 3D model generation pipeline.",
    `Return only compact JSON: an array with exactly ${normalizedCount} strings.`,
    "Each string must be a standalone prompt for exactly one subject that will become its own 3D model.",
    "Preserve the user's style, mood, and quality intent.",
    "If the user asked for multiple different animals/characters/objects without naming each one, choose distinct fitting subjects.",
    "Every prompt must clearly describe a single centered subject on a simple neutral background.",
    "Never describe multiple main subjects in one prompt. No group shots, no collages, no split panels, no scenes with multiple animals.",
    "User request:",
    String(input.prompt || "").trim() || "(empty)"
  ].join("\n").trim();
  try {
    const answer = await input.askModel(plannerPrompt);
    const parsed = parseStringArrayJson(answer);
    if (parsed && parsed.length > 0) {
      return Array.from({ length: normalizedCount }, (_, index) =>
        buildSingleModelSourcePrompt(parsed[index] || parsed[parsed.length - 1] || input.prompt, index, normalizedCount)
      );
    }
  } catch {}
  return Array.from({ length: normalizedCount }, (_, index) => buildSingleModelSourcePrompt(input.prompt, index, normalizedCount));
}

export function getImageTransformPrompt(action: "remove-background" | "delight-image" | "create-normal-map", originalPrompt: string): string {
  const sourcePrompt = String(originalPrompt || "").trim();
  if (action === "remove-background") {
    return "Remove the background from this image. Keep the main subject sharp and clean. Preserve subject details." + (sourcePrompt ? "\nOriginal prompt: " + sourcePrompt : "");
  }
  if (action === "delight-image") {
    return "Delight this image for texture use: remove strong lighting and baked shadows, keep color and surface details neutral and even." + (sourcePrompt ? "\nOriginal prompt: " + sourcePrompt : "");
  }
  return "Create a tangent-space normal map from this image. Output only the clean normal map texture." + (sourcePrompt ? "\nOriginal prompt: " + sourcePrompt : "");
}

export function parseBase64DataUrl(dataUrl: string): { mimeType: string; base64Data: string; } | null {
  const match = dataUrl.match(/^data:([^,]*),(.*)$/i);
  if (!match) {
    return null;
  }
  const headerParts = String(match[1] || "").split(";").map(part => part.trim()).filter(Boolean);
  const mimeType = headerParts.find(part => !part.includes("=") && part.toLowerCase() !== "base64") || "application/octet-stream";
  const rawData = String(match[2] || "").trim();
  const base64Data = headerParts.some(part => part.toLowerCase() === "base64")
    ? rawData
    : Buffer.from(decodeURIComponent(rawData), "utf8").toString("base64");
  if (!base64Data) {
    return null;
  }
  return { mimeType, base64Data };
}

export function buildDataUrlFromBuffer(contentType: string, data: Buffer): string {
  const mimeType = String(contentType || "application/octet-stream").trim() || "application/octet-stream";
  return `data:${mimeType};base64,${data.toString("base64")}`;
}

export async function buildChatSkillInputsFromArtifacts(
  artifacts: ChatSkillArtifact[],
  dependencies: DashboardDependencies
): Promise<{ images: string[]; imageFileNames: string[]; models: ChatSkillModelUpload[] }> {
  const images: string[] = [];
  const imageFileNames: string[] = [];
  const models: ChatSkillModelUpload[] = [];
  for (const artifact of artifacts) {
    if (artifact.kind === "image") {
      const file = await dependencies.readGeneratedImageFile(artifact.imageId, artifact.fileName);
      images.push(buildDataUrlFromBuffer(file.contentType, file.data));
      imageFileNames.push(artifact.fileName);
      continue;
    }
    if (artifact.kind === "model") {
      const file = await dependencies.readGeneratedModelFile(artifact.modelId, artifact.fileName);
      models.push({
        modelId: artifact.modelId,
        fileName: artifact.fileName,
        dataUrl: buildDataUrlFromBuffer(file.contentType, file.data)
      });
    }
  }
  return { images, imageFileNames, models };
}
