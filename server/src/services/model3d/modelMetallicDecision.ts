import { askOllama, askVisionOllama, type LlmConnectionSettings } from "../llm/ollama.js";
import { extractJsonObjectText, normalizeImageInputForVisionModel } from "../modelMetadataHelpers.js";

export type ModelMetallicClassification = "metallic" | "non-metallic" | "mixed";

export interface ModelMetallicDecision {
  classification: ModelMetallicClassification;
  reason: string;
  usedVisionModel: boolean;
}

function normalizeClassification(value: unknown): ModelMetallicClassification | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "metallic" || normalized === "full-metallic" || normalized === "fully-metallic" || normalized === "all-metal") {
    return "metallic";
  }
  if (normalized === "non-metallic" || normalized === "nonmetallic" || normalized === "organic" || normalized === "not-metal") {
    return "non-metallic";
  }
  if (normalized === "mixed" || normalized === "both" || normalized === "partial-metallic" || normalized === "hybrid") {
    return "mixed";
  }
  return null;
}

function clampReason(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return fallback;
  }
  return normalized.slice(0, 240);
}

function fallbackDecision(reason = "Fallback decision: mixed material composition."): ModelMetallicDecision {
  return {
    classification: "mixed",
    reason,
    usedVisionModel: false
  };
}

function parseDecision(raw: string, usedVisionModel: boolean): ModelMetallicDecision | null {
  const parsed = JSON.parse(extractJsonObjectText(raw)) as Record<string, unknown>;
  const classification = normalizeClassification(parsed.classification);
  if (!classification) {
    return null;
  }
  return {
    classification,
    reason: clampReason(parsed.reason, "No reason provided."),
    usedVisionModel
  };
}

function buildMetallicDecisionPrompt(input: {
  promptContext?: string;
  extraContext?: string;
}): string {
  return [
    "You decide if a generated 3D model should have metallic material enabled globally.",
    "Return JSON only with schema:",
    "{\"classification\":\"metallic|non-metallic|mixed\",\"reason\":\"short reason\"}",
    "Rules:",
    "- classification=metallic only if the object is mostly/all metal",
    "- classification=non-metallic only if the object is mostly non-metal and has no notable metal parts",
    "- classification=mixed if both non-metal and visible metal parts exist (for example character with metal armor)",
    "- if uncertain, choose mixed",
    "- reason max 20 words",
    "",
    `Model prompt context: ${input.promptContext?.trim() || "none"}`,
    `Optional user context: ${input.extraContext?.trim() || "none"}`
  ].join("\n");
}

export async function suggestModelMetallicDecision(input: {
  promptContext?: string;
  sourceImageInput?: string;
  extraContext?: string;
  preferVisualModel?: boolean;
  llmConnectionSettings?: LlmConnectionSettings;
}): Promise<ModelMetallicDecision> {
  const decisionPrompt = buildMetallicDecisionPrompt({
    promptContext: input.promptContext,
    extraContext: input.extraContext
  });
  const sourceImageInput = await normalizeImageInputForVisionModel(input.sourceImageInput);
  const canUseVision = input.preferVisualModel === true && sourceImageInput.length > 0;
  if (canUseVision) {
    try {
      const raw = await askVisionOllama(decisionPrompt, [sourceImageInput], input.llmConnectionSettings);
      const parsed = parseDecision(raw, true);
      if (parsed) {
        return parsed;
      }
    } catch (error) {
      console.warn("Visual metallic decision failed. Falling back to text-only decision.", error);
    }
  }
  try {
    const raw = await askOllama(decisionPrompt, false, input.llmConnectionSettings);
    const parsed = parseDecision(raw, false);
    if (parsed) {
      return parsed;
    }
  } catch (error) {
    console.warn("Text metallic decision failed.", error);
  }
  return fallbackDecision();
}

