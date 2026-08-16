import { askOllama, askVisionOllama, type LlmConnectionSettings } from "../llm/ollama.js";
import {
  extractJsonObjectText,
  getCachedVisualInterpretationPromptHint,
  normalizeImageInputForVisionModel,
  normalizeVisualSubjectKind,
  normalizeVisualSubjectPose,
  upsertCachedVisualInterpretation,
  type VisualInterpretationPose,
  type VisualInterpretationSubjectKind
} from "../modelMetadataHelpers.js";

export interface ModelRealWorldHeightDecision {
  objectLabel: string;
  subjectKind?: VisualInterpretationSubjectKind;
  pose?: VisualInterpretationPose;
  heightMeters: number;
  reason: string;
  usedVisionModel: boolean;
}

function normalizeObjectLabel(value: unknown): string {
  if (typeof value !== "string") {
    return "object";
  }
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized ? normalized.slice(0, 60) : "object";
}

function buildDecisionVisualSummary(input: {
  objectLabel: string;
  subjectKind: VisualInterpretationSubjectKind;
  pose: VisualInterpretationPose;
  heightMeters: number;
  reason: string;
}): string {
  return `Main subject: ${input.objectLabel}. Kind: ${input.subjectKind}. Pose: ${input.pose}. Pose-aware height estimate: ${input.heightMeters.toFixed(2)}m. ${input.reason}`;
}

function clampHeightMeters(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0.03, Math.min(4000, value));
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseFloat(value.trim().replace(",", "."));
    if (Number.isFinite(parsed)) {
      return Math.max(0.03, Math.min(4000, parsed));
    }
  }
  return null;
}

function normalizeReason(value: unknown): string {
  if (typeof value !== "string") {
    return "No reason provided.";
  }
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized ? normalized.slice(0, 260) : "No reason provided.";
}

function fallbackDecision(): ModelRealWorldHeightDecision {
  return {
    objectLabel: "object",
    heightMeters: 1.8,
    reason: "Fallback estimate.",
    usedVisionModel: false
  };
}

function parseDecision(raw: string, usedVisionModel: boolean): ModelRealWorldHeightDecision | null {
  const parsed = JSON.parse(extractJsonObjectText(raw)) as Record<string, unknown>;
  const heightMeters = clampHeightMeters(parsed.heightMeters);
  if (heightMeters === null) {
    return null;
  }
  return {
    objectLabel: normalizeObjectLabel(parsed.objectLabel),
    subjectKind: normalizeVisualSubjectKind(parsed.subjectKind),
    pose: normalizeVisualSubjectPose(parsed.pose),
    heightMeters,
    reason: normalizeReason(parsed.reason),
    usedVisionModel
  };
}

function buildPrompt(input: {
  promptContext?: string;
  extraContext?: string;
  cachedVisualHint?: string;
}): string {
  return [
    "Estimate the usual real-world height of the main object in the provided image/context.",
    "Return JSON only with schema:",
    "{\"objectLabel\":\"short label\",\"subjectKind\":\"character|animal|creature|object|vehicle|structure|scene|unknown\",\"pose\":\"standing|sitting|lying|floating|unknown\",\"heightMeters\":number,\"reason\":\"short reason\"}",
    "Rules:",
    "- heightMeters must be a realistic positive number in meters",
    "- Use typical/common real-world size, not miniature or stylized render scale",
    "- For character/animal/creature subjects, detect pose (standing/sitting/lying/floating)",
    "- For creatures, heightMeters must match CURRENT pose vertical extent (not full body length when lying)",
    "- Use sitting height around 50-75% of standing; lying around 12-35% of standing when plausible",
    "- For non-creatures, set pose=unknown",
    "- If uncertain, choose the most likely everyday size",
    "- reason max 20 words",
    "",
    `Prompt context: ${input.promptContext?.trim() || "none"}`,
    `Extra context: ${input.extraContext?.trim() || "none"}`,
    `Cached visual interpretation: ${input.cachedVisualHint?.trim() || "none"}`
  ].join("\n");
}

export async function suggestModelRealWorldHeight(input: {
  promptContext?: string;
  sourceImageInput?: string;
  extraContext?: string;
  preferVisualModel?: boolean;
  llmConnectionSettings?: LlmConnectionSettings;
}): Promise<ModelRealWorldHeightDecision> {
  const sourceImageInput = await normalizeImageInputForVisionModel(input.sourceImageInput);
  const cachedVisualHint = await getCachedVisualInterpretationPromptHint(sourceImageInput || input.sourceImageInput);
  const prompt = buildPrompt({
    promptContext: input.promptContext,
    extraContext: input.extraContext,
    cachedVisualHint
  });
  const canUseVision = input.preferVisualModel === true && sourceImageInput.length > 0;
  if (canUseVision) {
    try {
      const raw = await askVisionOllama(prompt, [sourceImageInput], input.llmConnectionSettings);
      const parsed = parseDecision(raw, true);
      if (parsed) {
        await upsertCachedVisualInterpretation({
          imageInput: sourceImageInput,
          objectLabel: parsed.objectLabel,
          subjectKind: parsed.subjectKind,
          pose: parsed.pose,
          summary: buildDecisionVisualSummary({
            objectLabel: parsed.objectLabel,
            subjectKind: parsed.subjectKind || "unknown",
            pose: parsed.pose || "unknown",
            heightMeters: parsed.heightMeters,
            reason: parsed.reason
          })
        });
        return parsed;
      }
    } catch (error) {
      console.warn("Visual real-world height decision failed. Falling back to text decision.", error);
    }
  }
  try {
    const raw = await askOllama(prompt, false, input.llmConnectionSettings);
    const parsed = parseDecision(raw, false);
    if (parsed) {
      return parsed;
    }
  } catch (error) {
    console.warn("Text real-world height decision failed.", error);
  }
  return fallbackDecision();
}
