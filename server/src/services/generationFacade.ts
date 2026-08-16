import { appConfig } from "../config/appConfig.js";
import { askOllama, askVisionOllama, type LlmConnectionSettings } from "./llm/ollama.js";
import {
  generateAudioFromPrompt as generateAudioFromPromptLocal,
  generateMusicFromPrompt as generateMusicFromPromptLocal,
  type GenerateAudioInput,
  type GenerateMusicInput
} from "./audioGeneration.js";
import {
  applyGeneratedModelMetallic as applyGeneratedModelMetallicLocal,
  applyGeneratedModelScaleToHeight as applyGeneratedModelScaleToHeightLocal,
  generate3dModelFromImage as generate3dModelFromImageLocal,
  generateLowPolyModel as generateLowPolyModelLocal,
  type GenerateLowPolyModelInput,
  type GenerateModelInput,
  type GeneratedModelPublicRecord,
  type GeneratedModelRecord
} from "./model3d.js";
import {
  generateImageFromPrompt as generateImageFromPromptLocal,
  type GenerateImageInput,
  type GeneratedImageRecord
} from "./imageGeneration.js";
import {
  type GeneratedAudioPublicRecord,
  type GeneratedAudioRecord,
  type GeneratedImagePublicRecord
} from "./generatedMediaLibrary.js";
import {
  applyModelMetallicViaRemoteWorker,
  applyModelScaleToHeightViaRemoteWorker,
  generate3dModelViaRemoteWorker,
  generateImageViaRemoteWorker,
  generateLowPolyModelViaRemoteWorker
} from "./remoteGenerationClient.js";

const defaultImagePrompt = "upperbody shot, 1girl,solo,chibi,long hairs, happy, laugh, hugging a teddy bear, looking at viewers, dancing stand, cute, soft color, flowers in background, many flowers, among flowers, best quality, highres, delicate details";
const imageAutoPromptInstruction = [
  "Write exactly one high quality image generation prompt.",
  "The prompt must be safe for work and visually rich.",
  "Return plain prompt text only, no markdown, no explanation."
].join(" ");
const imageAutoFileNameInstruction = [
  "Suggest exactly one descriptive filename stem for a generated image.",
  "Rules: lowercase letters, numbers, and hyphens only.",
  "No file extension. No quotes. No explanation.",
  "Keep it concise and specific."
].join(" ");
const imageAutoDescriptionInstruction = [
  "Write exactly one short caption for a generated image.",
  "Use one sentence.",
  "Return plain text only, no markdown, no quotes, no explanation."
].join(" ");
const imageDescribeInstruction = [
  "Describe the attached image clearly and concretely.",
  "Focus on the subject, setting, composition, lighting, colors, mood, style, and any readable text.",
  "Return plain text only."
].join(" ");
const imagePromptFromBaseImageInstruction = [
  "Write exactly one high quality image generation prompt based on the attached image.",
  "Use the attached image as the visual reference for subject, composition, lighting, colors, and style.",
  "When the user requests a change, the change is mandatory and must override conflicting details from the source image.",
  "Explicitly include every requested visual change in the final prompt.",
  "Return plain prompt text only, no markdown, no explanation."
].join(" ");
const modelAutoPromptInstruction = [
  "Write exactly one short visual style prompt for textured 3D model generation from an image.",
  "Keep it concise, safe for work, and focused on materials, lighting, and style.",
  "Return plain prompt text only."
].join(" ");

async function createAutonomousPrompt(promptInstruction: string, fallbackPrompt: string, llmConnectionSettings?: LlmConnectionSettings): Promise<string> {
  try {
    const raw = await askOllama(promptInstruction, false, llmConnectionSettings);
    const normalized = raw.trim().replace(/^[\"'`]+|[\"'`]+$/g, "");
    if (normalized) return normalized;
  } catch (error) {
    console.warn("Failed to generate autonomous prompt.", error);
  }
  return fallbackPrompt;
}

function sanitizeImageFileStem(input: string): string {
  const raw = input.trim().replace(/^[\"'`]+|[\"'`]+$/g, "");
  const firstLine = raw.split(/\r?\n/)[0] ?? "";
  const withoutExtension = firstLine.replace(/\.[a-z0-9]{2,5}$/i, "");
  const normalized = withoutExtension
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "")
    .slice(0, 80);
  return normalized || "generated-image";
}

function normalizeGeneratedPromptText(input: string): string {
  return input.trim().replace(/^[\"'`]+|[\"'`]+$/g, "");
}

export async function resolveImagePrompt(input: { prompt?: string; autoPrompt?: boolean; llmConnectionSettings?: LlmConnectionSettings; }): Promise<string> {
  const promptText = input.prompt?.trim() ?? "";
  if (!input.autoPrompt && promptText) return promptText;
  if (input.autoPrompt && promptText) {
    const guidedInstruction = [
      imageAutoPromptInstruction,
      "Use the following user direction as the core intent, subject, and style anchor.",
      `User direction: ${promptText}`
    ].join(" ");
    const guided = await createAutonomousPrompt(guidedInstruction, promptText, input.llmConnectionSettings);
    return guided || promptText || defaultImagePrompt;
  }
  const autonomous = await createAutonomousPrompt(imageAutoPromptInstruction, defaultImagePrompt, input.llmConnectionSettings);
  return autonomous || promptText || defaultImagePrompt;
}

export async function describeImageWithVision(input: { imageInput: string; prompt?: string; llmConnectionSettings?: LlmConnectionSettings; }): Promise<string> {
  const imageInput = input.imageInput.trim();
  if (!imageInput) throw new Error("An image input is required.");
  const promptText = input.prompt?.trim() ?? "";
  const instruction = promptText
    ? [imageDescribeInstruction, "Pay extra attention to this request.", `User request: ${promptText}`].join(" ")
    : imageDescribeInstruction;
  const description = normalizeGeneratedPromptText(await askVisionOllama(instruction, [imageInput], input.llmConnectionSettings));
  if (!description) throw new Error("The vision model returned an empty image description.");
  return description;
}

type ImagePromptInterpretDetailMode = "precise" | "normal" | "vague";

function normalizeImagePromptInterpretDetailMode(value: unknown): ImagePromptInterpretDetailMode {
  return value === "precise" || value === "vague" ? value : "normal";
}

function getImagePromptInterpretDetailInstruction(mode: ImagePromptInterpretDetailMode): string {
  if (mode === "precise") {
    return "Describe this image very detailed: include every little detail you see.";
  }
  if (mode === "vague") {
    return "Vaguely describe this image, DO NOT mention every detail.";
  }
  return "Describe this image.";
}

export async function resolveImagePromptFromBaseImage(input: { imageInput: string; prompt?: string; detailMode?: ImagePromptInterpretDetailMode; direction?: string; llmConnectionSettings?: LlmConnectionSettings; }): Promise<string> {
  const imageInput = input.imageInput.trim();
  if (!imageInput) throw new Error("A base image is required.");
  const promptText = input.prompt?.trim() ?? "";
  const directionText = input.direction?.trim() ?? "";
  const detailMode = normalizeImagePromptInterpretDetailMode(input.detailMode);
  const detailInstruction = getImagePromptInterpretDetailInstruction(detailMode);
  const directionInstruction = directionText
    ? [
      "The user supplied direction keywords or phrases. Treat them as visual intent and steer the final prompt toward them without inventing unrelated requirements.",
      `Direction keywords or phrases: ${directionText}`
    ].join(" ")
    : "";
  const instruction = promptText
    ? [
      imagePromptFromBaseImageInstruction,
      detailInstruction,
      directionInstruction,
      "User requested visual changes are mandatory. Do not preserve source-image traits that conflict with them.",
      "Understand the user direction in its original language. Do not translate it through local parsing rules.",
      "The final image prompt must contain the requested change as visual content, not as an instruction to the next system.",
      `User direction: ${promptText}`
    ].filter(Boolean).join(" ")
    : [imagePromptFromBaseImageInstruction, detailInstruction, directionInstruction].filter(Boolean).join(" ");
  const resolvedPrompt = normalizeGeneratedPromptText(await askVisionOllama(instruction, [imageInput], input.llmConnectionSettings));
  if (!resolvedPrompt) throw new Error("The vision model returned an empty image prompt.");
  return resolvedPrompt;
}

export async function suggestImageFileName(input: { prompt: string; llmConnectionSettings?: LlmConnectionSettings; }): Promise<string> {
  const prompt = input.prompt.trim();
  if (!prompt) return "generated-image";
  const instruction = [imageAutoFileNameInstruction, `Prompt: ${prompt}`].join(" ");
  const suggested = await createAutonomousPrompt(instruction, "generated-image", input.llmConnectionSettings);
  return sanitizeImageFileStem(suggested);
}

export async function suggestImageDescription(input: { prompt: string; llmConnectionSettings?: LlmConnectionSettings; }): Promise<string> {
  const prompt = input.prompt.trim();
  if (!prompt) return "";
  const instruction = [imageAutoDescriptionInstruction, `Prompt: ${prompt}`].join(" ");
  return normalizeGeneratedPromptText(await createAutonomousPrompt(instruction, "", input.llmConnectionSettings));
}

export async function resolveModelPrompt(input: { prompt?: string; autoPrompt?: boolean; llmConnectionSettings?: LlmConnectionSettings; }): Promise<string> {
  const promptText = input.prompt?.trim() ?? "";
  if (!input.autoPrompt) return promptText;
  const autonomous = await createAutonomousPrompt(modelAutoPromptInstruction, "", input.llmConnectionSettings);
  return autonomous || promptText;
}

export async function generate3dModelWithExecution(input: GenerateModelInput, executionTarget?: "local" | "remote"): Promise<GeneratedModelRecord> {
  const target = executionTarget ?? appConfig.model3dExecutionMode;
  return target === "remote" ? generate3dModelViaRemoteWorker(input) : generate3dModelFromImageLocal(input);
}

export async function generateLowPolyModelWithExecution(input: GenerateLowPolyModelInput, executionTarget?: "local" | "remote"): Promise<GeneratedModelPublicRecord> {
  const target = executionTarget ?? appConfig.model3dExecutionMode;
  return target === "remote" ? generateLowPolyModelViaRemoteWorker(input) : generateLowPolyModelLocal(input);
}

export async function applyModelMetallicWithExecution(input: { modelId: string; metallicEnabled: boolean; }, executionTarget?: "local" | "remote"): Promise<GeneratedModelPublicRecord> {
  const target = executionTarget ?? appConfig.model3dExecutionMode;
  if (target === "remote") {
    return applyModelMetallicViaRemoteWorker({ modelId: input.modelId, metallicEnabled: input.metallicEnabled === true });
  }
  return applyGeneratedModelMetallicLocal({ modelId: input.modelId, metallicEnabled: input.metallicEnabled === true });
}

export async function applyModelScaleToHeightWithExecution(input: { modelId: string; targetHeightMeters: number; }, executionTarget?: "local" | "remote"): Promise<GeneratedModelPublicRecord> {
  const target = executionTarget ?? appConfig.model3dExecutionMode;
  if (target === "remote") {
    return applyModelScaleToHeightViaRemoteWorker({ modelId: input.modelId, targetHeightMeters: input.targetHeightMeters });
  }
  return applyGeneratedModelScaleToHeightLocal({ modelId: input.modelId, targetHeightMeters: input.targetHeightMeters });
}

export async function generateImageWithExecution(input: GenerateImageInput): Promise<GeneratedImageRecord> {
  return appConfig.imageExecutionMode === "remote" ? generateImageViaRemoteWorker(input) : generateImageFromPromptLocal(input);
}

export async function generateAudioWithExecution(input: GenerateAudioInput): Promise<GeneratedAudioRecord> {
  return generateAudioFromPromptLocal(input);
}

export async function generateMusicWithExecution(input: GenerateMusicInput): Promise<GeneratedAudioRecord> {
  return generateMusicFromPromptLocal(input);
}
