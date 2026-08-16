import type { RealWorldSizeTier } from "@urage/server/services/model3d";
import { parseRealWorldSizeTier } from "../interaction/lowPolyInteraction.js";
import {
  normalizeVisualObjectLabel,
  normalizeVisualSubjectKind,
  normalizeVisualSubjectPose,
  type VisualInterpretationPose,
  type VisualInterpretationSubjectKind
} from "@urage/server/services/modelMetadataHelpers";

export type LowPolyComplexityLevel = "simple" | "moderate" | "detailed";

export interface LowPolyComplexityDecision {
  targetFaceCount: number;
  sizeTier: RealWorldSizeTier;
  complexity: LowPolyComplexityLevel;
  reason: string;
  usedVisionModel: boolean;
  objectLabel?: string;
  subjectKind?: VisualInterpretationSubjectKind;
  pose?: VisualInterpretationPose;
}

export function clampLowPolyFaceCount(value: unknown, defaultFaceCount: number): number {
  let parsed: number | null = null;
  if (typeof value === "number" && Number.isFinite(value)) {
    parsed = Math.round(value);
  } else if (typeof value === "string" && value.trim().length > 0) {
    const asInt = Number.parseInt(value.trim(), 10);
    parsed = Number.isFinite(asInt) ? asInt : null;
  }
  if (parsed === null) {
    return defaultFaceCount;
  }
  return Math.max(500, Math.min(5000, parsed));
}

export function parseLowPolyComplexityLevel(value: unknown): LowPolyComplexityLevel | null {
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

export function defaultComplexityDecision(defaultFaceCount: number): LowPolyComplexityDecision {
  return {
    targetFaceCount: defaultFaceCount,
    sizeTier: "medium",
    complexity: "moderate",
    reason: "Fallback decision.",
    usedVisionModel: false
  };
}

export function parseLowPolyComplexityDecision(raw: string, usedVisionModel: boolean, defaultFaceCount: number, extractJsonObjectText: (raw: string) => string): LowPolyComplexityDecision | null {
  const parsed = JSON.parse(extractJsonObjectText(raw)) as Record<string, unknown>;
  const targetFaceCount = clampLowPolyFaceCount(parsed.targetFaceCount, defaultFaceCount);
  const sizeTier = parseRealWorldSizeTier(typeof parsed.sizeTier === "string" ? parsed.sizeTier : "") ?? "medium";
  const complexity = parseLowPolyComplexityLevel(parsed.complexity) ?? "moderate";
  const objectLabel = typeof parsed.objectLabel === "string"
    ? normalizeVisualObjectLabel(parsed.objectLabel)
    : undefined;
  const subjectKind = parsed.subjectKind === undefined
    ? undefined
    : normalizeVisualSubjectKind(parsed.subjectKind);
  const pose = parsed.pose === undefined
    ? undefined
    : normalizeVisualSubjectPose(parsed.pose);
  const reason = typeof parsed.reason === "string" && parsed.reason.trim().length > 0
    ? parsed.reason.trim().slice(0, 220)
    : "No reason provided.";
  return {
    targetFaceCount,
    sizeTier,
    complexity,
    reason,
    usedVisionModel,
    objectLabel,
    subjectKind,
    pose
  };
}

export function buildLowPolyComplexityDecisionPrompt(input: {
  promptContext?: string;
  extraContext?: string;
  visualInterpretationHint?: string;
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
    `Model prompt context: ${input.promptContext?.trim() || "none"}`,
    `Optional user context: ${input.extraContext?.trim() || "none"}`,
    `Cached visual interpretation: ${input.visualInterpretationHint?.trim() || "none"}`
  ].join("\n");
}
