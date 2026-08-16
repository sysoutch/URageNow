import { createLowPolyDecisionService } from "../services/lowPoly/decision/lowPolyDecisionService.js";
import type { RealWorldSizeTier } from "@urage/server/services/model3d";

export const LOW_POLY_SIZE_CHOICES: Array<{ tier: RealWorldSizeTier; label: string; faceCount: number; }> = [
  { tier: "tiny", label: "Tiny (500)", faceCount: 500 },
  { tier: "small", label: "Small (1000)", faceCount: 1000 },
  { tier: "medium", label: "Medium (1500)", faceCount: 1500 },
  { tier: "large", label: "Large (3000)", faceCount: 3000 },
  { tier: "huge", label: "Huge (5000)", faceCount: 5000 }
];

type LowPolyDecisionRuntimeInput = {
  defaultFaceCount: number;
  askText: (prompt: string) => Promise<string>;
  askVision: (...args: any[]) => any;
  readGeneratedModelFile: (...args: any[]) => Promise<any>;
  classifyRealWorldSizeTierLocal: (...args: any[]) => any;
  suggestLowPolyByComplexityLocal: (...args: any[]) => any;
  suggestLowPolyByComplexityViaRemoteWorker: (...args: any[]) => any;
  decideLowPolyByVisualComplexityLocal: (...args: any[]) => any;
};

export function createLowPolyRuntime(input: LowPolyDecisionRuntimeInput) {
  const lowPolyDecisionLocalDeps = {
    defaultFaceCount: input.defaultFaceCount,
    askText: input.askText,
    askVision: input.askVision,
    readGeneratedModelFile: input.readGeneratedModelFile
  };
  const lowPolyDecisionService = createLowPolyDecisionService({
    classifyRealWorldSizeTierLocal: input.classifyRealWorldSizeTierLocal,
    suggestLowPolyByComplexityLocal: input.suggestLowPolyByComplexityLocal,
    suggestLowPolyByComplexityViaRemoteWorker: input.suggestLowPolyByComplexityViaRemoteWorker,
    decideLowPolyByVisualComplexityLocal: input.decideLowPolyByVisualComplexityLocal,
    lowPolyDecisionLocalDeps
  });
  return {
    lowPolySizeChoices: LOW_POLY_SIZE_CHOICES,
    classifyRealWorldSizeTier: lowPolyDecisionService.classifyRealWorldSizeTier,
    formatRealWorldDimensions: lowPolyDecisionService.formatRealWorldDimensions,
    suggestLowPolyByComplexity: lowPolyDecisionService.suggestLowPolyByComplexity,
    decideLowPolyByVisualComplexity: lowPolyDecisionService.decideLowPolyByVisualComplexity
  };
}
