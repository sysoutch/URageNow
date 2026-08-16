import type { LowPolyComplexityDecision } from "./lowPolyComplexity.js";
import type { GeneratedModelPublicRecord, RealWorldDimensions, RealWorldSizeTier } from "@urage/server/services/model3d";

type LowPolyDecisionServiceDependencies = {
  classifyRealWorldSizeTierLocal: (reference: string, askText: (prompt: string) => Promise<string>) => Promise<RealWorldSizeTier>;
  suggestLowPolyByComplexityLocal: (input: {
    promptContext?: string;
    sourceImageInput?: string;
    extraContext?: string;
    preferVisualModel?: boolean;
  }, dependencies: LowPolyDecisionLocalDeps) => Promise<LowPolyComplexityDecision>;
  suggestLowPolyByComplexityViaRemoteWorker: (input: {
    prompt?: string;
    imageInput?: string;
    context?: string;
    preferVisualModel?: boolean;
  }) => Promise<LowPolyComplexityDecision>;
  decideLowPolyByVisualComplexityLocal: (input: { model: GeneratedModelPublicRecord; context?: string }, dependencies: LowPolyDecisionLocalDeps) => Promise<LowPolyComplexityDecision>;
  lowPolyDecisionLocalDeps: LowPolyDecisionLocalDeps;
};

type LowPolyDecisionLocalDeps = {
  defaultFaceCount: number;
  askText: (prompt: string) => Promise<string>;
  askVision: (...args: any[]) => Promise<string>;
  readGeneratedModelFile: (modelId: string, fileName: string) => Promise<any>;
};

type LowPolyDecisionService = {
  classifyRealWorldSizeTier: (reference: string) => Promise<RealWorldSizeTier>;
  formatRealWorldDimensions: (dimensions: RealWorldDimensions) => string;
  suggestLowPolyByComplexity: (input: {
    promptContext?: string;
    sourceImageInput?: string;
    extraContext?: string;
    preferVisualModel?: boolean;
    executionTarget?: "local" | "remote";
  }) => Promise<LowPolyComplexityDecision>;
  decideLowPolyByVisualComplexity: (input: { model: GeneratedModelPublicRecord; context?: string }) => Promise<LowPolyComplexityDecision>;
};

export function createLowPolyDecisionService(dependencies: LowPolyDecisionServiceDependencies): LowPolyDecisionService {
  async function classifyRealWorldSizeTier(reference: string): Promise<RealWorldSizeTier> {
    return dependencies.classifyRealWorldSizeTierLocal(reference, dependencies.lowPolyDecisionLocalDeps.askText);
  }

  function formatRealWorldDimensions(dimensions: RealWorldDimensions): string {
    return `${dimensions.widthMeters.toFixed(2)}m x ${dimensions.heightMeters.toFixed(2)}m x ${dimensions.depthMeters.toFixed(2)}m`;
  }

  async function suggestLowPolyByComplexityLocal(input: {
    promptContext?: string;
    sourceImageInput?: string;
    extraContext?: string;
    preferVisualModel?: boolean;
  }): Promise<LowPolyComplexityDecision> {
    return dependencies.suggestLowPolyByComplexityLocal(input, dependencies.lowPolyDecisionLocalDeps);
  }

  async function suggestLowPolyByComplexity(input: {
    promptContext?: string;
    sourceImageInput?: string;
    extraContext?: string;
    preferVisualModel?: boolean;
    executionTarget?: "local" | "remote";
  }): Promise<LowPolyComplexityDecision> {
    if (input.executionTarget === "remote") {
      return dependencies.suggestLowPolyByComplexityViaRemoteWorker({
        prompt: input.promptContext,
        imageInput: input.sourceImageInput,
        context: input.extraContext,
        preferVisualModel: input.preferVisualModel === true
      });
    }
    return suggestLowPolyByComplexityLocal({
      promptContext: input.promptContext,
      sourceImageInput: input.sourceImageInput,
      extraContext: input.extraContext,
      preferVisualModel: input.preferVisualModel
    });
  }

  async function decideLowPolyByVisualComplexity(input: { model: GeneratedModelPublicRecord; context?: string }): Promise<LowPolyComplexityDecision> {
    return dependencies.decideLowPolyByVisualComplexityLocal(input, dependencies.lowPolyDecisionLocalDeps);
  }

  return {
    classifyRealWorldSizeTier,
    formatRealWorldDimensions,
    suggestLowPolyByComplexity,
    decideLowPolyByVisualComplexity
  };
}


