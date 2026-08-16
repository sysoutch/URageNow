import type {
  GeneratedModelPublicRecord,
  RealWorldSizeTier
} from "@urage/server/services/model3d";
import { parseRealWorldSizeTier } from "../interaction/lowPolyInteraction.js";
import {
  buildLowPolyComplexityDecisionPrompt,
  defaultComplexityDecision,
  parseLowPolyComplexityDecision,
  type LowPolyComplexityDecision
} from "./lowPolyComplexity.js";
import {
  buildImageDataUrl,
  extractJsonObjectText,
  getCachedVisualInterpretationPromptHint,
  normalizeImageInputForVisionModel,
  upsertCachedVisualInterpretation
} from "@urage/server/services/modelMetadataHelpers";

export interface LowPolyDecisionLocalDeps {
  defaultFaceCount: number;
  askText: (prompt: string) => Promise<string>;
  askVision: (prompt: string, images: string[]) => Promise<string>;
  readGeneratedModelFile: (modelId: string, fileName: string) => Promise<{ contentType: string; data: Buffer; }>;
}

function buildLowPolyVisualSummary(decision: LowPolyComplexityDecision): string {
  const objectLabel = decision.objectLabel || "object";
  const subjectKind = decision.subjectKind || "unknown";
  const pose = decision.pose || "unknown";
  return `Main subject: ${objectLabel}. Kind: ${subjectKind}. Pose: ${pose}. Complexity: ${decision.complexity}. Suggested target faces: ${decision.targetFaceCount}. ${decision.reason}`;
}

export async function classifyRealWorldSizeTierLocal(reference: string, askText: (prompt: string) => Promise<string>): Promise<RealWorldSizeTier> {
  const normalizedReference = reference.trim().toLowerCase();
  if (/molecule|grain|dust|coin|ring|earring|minature|miniature|toy/.test(normalizedReference)) {
    return "tiny";
  }
  if (/book|cat|dog|laptop|monitor|chair|backpack/.test(normalizedReference)) {
    return "small";
  }
  if (/person|human|bike|motorcycle|sofa|couch/.test(normalizedReference)) {
    return "medium";
  }
  if (/car|van|truck|tree|statue/.test(normalizedReference)) {
    return "large";
  }
  if (/house|building|ship|plane|airplane|tower|castle/.test(normalizedReference)) {
    return "huge";
  }
  const prompt = [
    "Classify the real-life size of this object into exactly one token:",
    "tiny, small, medium, large, or huge.",
    "Return one word only.",
    `Object: ${reference}`
  ].join("\n");
  try {
    const raw = (await askText(prompt)).trim().toLowerCase();
    const matched = raw.match(/\b(tiny|small|medium|large|huge)\b/);
    const tier = parseRealWorldSizeTier(matched?.[1] ?? raw);
    if (tier) {
      return tier;
    }
  } catch (error) {
    console.warn("Failed to classify low poly real-world size tier via LLM.", error);
  }
  return "medium";
}

export async function suggestLowPolyByComplexityLocal(input: {
  promptContext?: string;
  sourceImageInput?: string;
  extraContext?: string;
  preferVisualModel?: boolean;
}, deps: LowPolyDecisionLocalDeps): Promise<LowPolyComplexityDecision> {
  const sourceImageInput = await normalizeImageInputForVisionModel(input.sourceImageInput);
  const cachedVisualInterpretationHint = await getCachedVisualInterpretationPromptHint(sourceImageInput || input.sourceImageInput);
  const decisionPrompt = buildLowPolyComplexityDecisionPrompt({
    promptContext: input.promptContext,
    extraContext: input.extraContext,
    visualInterpretationHint: cachedVisualInterpretationHint || undefined
  });
  const canUseVisionModel = input.preferVisualModel === true && sourceImageInput.length > 0;
  if (canUseVisionModel) {
    try {
      const visualRaw = await deps.askVision(decisionPrompt, [sourceImageInput]);
      const visualDecision = parseLowPolyComplexityDecision(visualRaw, true, deps.defaultFaceCount, extractJsonObjectText);
      if (visualDecision) {
        await upsertCachedVisualInterpretation({
          imageInput: sourceImageInput,
          objectLabel: visualDecision.objectLabel,
          subjectKind: visualDecision.subjectKind,
          pose: visualDecision.pose,
          summary: buildLowPolyVisualSummary(visualDecision)
        });
        return visualDecision;
      }
    } catch (error) {
      console.warn("Visual low poly complexity decision failed. Falling back to text-only.", error);
    }
  }
  try {
    const textRaw = await deps.askText(decisionPrompt);
    const textDecision = parseLowPolyComplexityDecision(textRaw, false, deps.defaultFaceCount, extractJsonObjectText);
    if (textDecision) {
      return textDecision;
    }
  } catch (error) {
    console.warn("Text low poly complexity decision failed.", error);
  }
  return defaultComplexityDecision(deps.defaultFaceCount);
}

export async function decideLowPolyByVisualComplexityLocal(input: {
  model: GeneratedModelPublicRecord;
  context?: string;
}, deps: LowPolyDecisionLocalDeps): Promise<LowPolyComplexityDecision> {
  let sourceImageInput = "";
  try {
    const sourceImage = await deps.readGeneratedModelFile(input.model.id, input.model.sourceImageFileName);
    if (sourceImage.contentType.startsWith("image/")) {
      sourceImageInput = buildImageDataUrl({
        bytes: sourceImage.data,
        contentType: sourceImage.contentType
      });
    }
  } catch (error) {
    console.warn("Failed to load source image for low poly AI complexity decision.", error);
  }
  return suggestLowPolyByComplexityLocal({
    promptContext: input.model.prompt,
    sourceImageInput,
    extraContext: input.context,
    preferVisualModel: true
  }, deps);
}
