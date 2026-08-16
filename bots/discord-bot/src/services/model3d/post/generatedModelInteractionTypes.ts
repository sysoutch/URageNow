import type { ButtonInteraction, ModalSubmitInteraction } from "discord.js";
import type { LowPolyComplexityDecision } from "../../lowPoly/decision/lowPolyComplexity.js";
import type { GeneratedModelPublicRecord, RealWorldDimensions, RealWorldSizeTier } from "@urage/server/services/model3d";

export type LowPolySizeChoice = { tier: RealWorldSizeTier; label: string; faceCount: number };
export type LowPolyInteractionContext = { modelId: string; sourceMessageId?: string | null };
export type LowPolySizeSelection = { modelId: string; tier: RealWorldSizeTier; sourceMessageId?: string | null };
export type LowPolyModalSelection = { modelId: string; sourceMessageId?: string | null };

export type GeneratedModelInteractionIds = {
  upvotePrefix: string;
  downvotePrefix: string;
  refreshPrefix: string;
  newPrefix: string;
  settingsPrefix: string;
  lowPolyPrefix: string;
  lowPolySizePrefix: string;
  lowPolyDimensionsPrefix: string;
  lowPolyAutoPrefix: string;
  lowPolyComplexityPrefix: string;
  lowPolyAutoModalPrefix: string;
  lowPolyDimensionsModalPrefix: string;
  lowPolyComplexityModalPrefix: string;
  lowPolyDimensionsModalInputId: string;
  lowPolyAutoModalReferenceInputId: string;
  lowPolyComplexityModalContextInputId: string;
  multiViewPrefix: string;
  uvPrefix: string;
  normalPrefix: string;
};

export type GeneratedModelInteractionServiceDependencies = {
  ids: GeneratedModelInteractionIds;
  lowPolySizeChoices: LowPolySizeChoice[];
  defaultLowPolyTargetFaceCount: number;
  listGeneratedModelsPublic: () => Promise<GeneratedModelPublicRecord[]>;
  resolveGeneratedModelFilePath: (modelId: string, fileName: string) => Promise<string>;
  parseLowPolySizeButtonValue: (customId: string, prefix: string) => LowPolySizeSelection | null;
  parseLowPolyInteractionContext: (value: string) => LowPolyInteractionContext | null;
  buildLowPolyInteractionPayload: (modelId: string, sourceMessageId?: string) => string;
  parseLowPolyModalValue: (customId: string, prefix: string) => LowPolyModalSelection | null;
  parseRealWorldDimensionsText: (value: string) => RealWorldDimensions | null;
  deriveRealWorldSizeTierFromDimensions: (dimensions: RealWorldDimensions) => RealWorldSizeTier | null;
  getLowPolyTargetFaceCountForTier: (
    tier: RealWorldSizeTier,
    choices: Array<{ tier: RealWorldSizeTier; label: string; faceCount: number }>,
    fallbackFaceCount: number
  ) => number;
  buildLowPolySizePickerComponents: (input: {
    modelId: string;
    sourceMessageId?: string;
    sizeChoices: Array<{ tier: RealWorldSizeTier; label: string; faceCount: number }>;
    sizePrefix: string;
    dimensionsPrefix: string;
    complexityPrefix: string;
    autoPrefix: string;
  }) => unknown;
  runLowPolyGenerationReply: (
    interaction: ButtonInteraction | ModalSubmitInteraction,
    input: {
      model: GeneratedModelPublicRecord;
      targetFaceCount?: number;
      realWorldSizeTier?: RealWorldSizeTier;
      realWorldReference?: string;
      realWorldDimensions?: RealWorldDimensions;
      statusLabel?: string;
      resultNote?: string;
      highPolyMessageId?: string;
    }
  ) => Promise<void>;
  classifyRealWorldSizeTier: (reference: string) => Promise<RealWorldSizeTier>;
  decideLowPolyByVisualComplexity: (input: { model: GeneratedModelPublicRecord; context?: string }) => Promise<LowPolyComplexityDecision>;
  formatRealWorldDimensions: (dimensions: RealWorldDimensions) => string;
};

export type GeneratedModelInteractionService = {
  handleGeneratedModelButton: (interaction: ButtonInteraction) => Promise<void>;
  handleGeneratedModelModal: (interaction: ModalSubmitInteraction) => Promise<boolean>;
};
