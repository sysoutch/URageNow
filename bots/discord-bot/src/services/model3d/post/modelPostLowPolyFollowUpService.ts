import { resolveOptionalGeneratedModelFilePath } from "./modelPostHelpers.js";
import type { GeneratedModelPublicRecord } from "@urage/server/services/model3d";
import {
  ensureVisualInterpretationForImage,
  getCachedVisualInterpretationPromptHint
} from "@urage/server/services/modelMetadataHelpers";
import type {
  EditableModelMessage,
  ModelPostOptions,
  SendableGuildChannel
} from "./modelPostTypes.js";

type ModelPostLowPolyFollowUpServiceDependencies = {
  generateLowPolyModel: (input: { modelId: string; targetFaceCount?: number; executionTarget?: "local" | "remote"; }) => Promise<GeneratedModelPublicRecord>;
  suggestLowPolyByComplexity: (input: {
    promptContext?: string;
    sourceImageInput?: string;
    extraContext?: string;
    preferVisualModel?: boolean;
    executionTarget?: "local" | "remote";
  }) => Promise<{ targetFaceCount: number }>;
  resolveGeneratedModelFilePath: (modelId: string, fileName: string) => Promise<string>;
  normalizeModelPostOptions: (options: ModelPostOptions | undefined) => Required<ModelPostOptions>;
  buildGeneratedModelAttachments: (
    record: GeneratedModelPublicRecord,
    mode: "detailed" | "public",
    options: Required<ModelPostOptions>
  ) => Promise<Array<{ attachment: string; name: string }>>;
  buildLowPolyModelEmbed: (record: GeneratedModelPublicRecord, links?: { highPolyModelUrl?: string; highPolyMessageUrl?: string; }) => unknown;
  buildLowPolyModelComponents: (record: GeneratedModelPublicRecord, includeButtons?: boolean) => unknown;
  asEditableModelMessage: (value: unknown) => EditableModelMessage | null;
  resolveLowPolyFollowUpTarget: (input: {
    generated: GeneratedModelPublicRecord;
    options: Required<ModelPostOptions>;
    postedChannel: SendableGuildChannel;
  }) => Promise<{ progressMessage: EditableModelMessage | null; postChannel: SendableGuildChannel | null }>;
  sleep: (milliseconds: number) => Promise<void>;
  followUpDelayMs: number;
  formatTargetFaceCount: (value: number | null) => string;
};

type ModelPostLowPolyFollowUpService = {
  maybePostLowPolyFollowUp: (input: {
    generated: GeneratedModelPublicRecord;
    options: Required<ModelPostOptions>;
    postedChannel: SendableGuildChannel | null;
    highPolyModelUrl?: string;
    highPolyMessageUrl?: string;
  }) => Promise<GeneratedModelPublicRecord>;
};

export function createModelPostLowPolyFollowUpService(dependencies: ModelPostLowPolyFollowUpServiceDependencies): ModelPostLowPolyFollowUpService {
  async function maybePostLowPolyFollowUp(input: {
    generated: GeneratedModelPublicRecord;
    options: Required<ModelPostOptions>;
    postedChannel: SendableGuildChannel | null;
    highPolyModelUrl?: string;
    highPolyMessageUrl?: string;
  }): Promise<GeneratedModelPublicRecord> {
    if (!input.options.generateLowPolyVersion || !input.postedChannel) {
      return input.generated;
    }
    await dependencies.sleep(dependencies.followUpDelayMs);
    let progressMessage: EditableModelMessage | null = null;
    let followUpChannel: SendableGuildChannel | null = input.postedChannel;
    try {
      const resolved = await dependencies.resolveLowPolyFollowUpTarget({
        generated: input.generated,
        options: input.options,
        postedChannel: input.postedChannel
      });
      progressMessage = resolved.progressMessage;
      followUpChannel = resolved.postChannel;
    } catch (error) {
      console.warn("Failed to route Low Poly follow-up to configured forum channel. Falling back to posted channel.", error);
      const fallbackProgressRaw = await input.postedChannel.send("🧩 I also create a Low Poly version of this model now...");
      progressMessage = dependencies.asEditableModelMessage(fallbackProgressRaw);
      followUpChannel = input.postedChannel;
    }
    try {
      let targetFaceCount = input.options.lowPolyTargetFaceCount;
      if (input.options.lowPolyUseLlmTargetFaces) {
        let sourceImageInput = "";
        let sourceImageForContext = "";
        const useModelRenderForDecision = input.options.lowPolyLlmDecisionSource === "model-render";
        const preferredDecisionImageFileName = useModelRenderForDecision
          ? (input.generated.previewImageFileName || input.generated.sourceImageFileName)
          : input.generated.sourceImageFileName;
        try {
          sourceImageInput = await dependencies.resolveGeneratedModelFilePath(input.generated.id, preferredDecisionImageFileName);
        } catch (error) {
          if (useModelRenderForDecision && input.generated.sourceImageFileName && input.generated.sourceImageFileName !== preferredDecisionImageFileName) {
            try {
              sourceImageInput = await dependencies.resolveGeneratedModelFilePath(input.generated.id, input.generated.sourceImageFileName);
            } catch {
              console.warn("Failed to resolve model render/source image path for low poly complexity decision. Falling back to text-only decision.", error);
            }
          } else {
            console.warn("Failed to resolve source image path for low poly complexity decision. Falling back to text-only decision.", error);
          }
        }
        if (input.generated.sourceImageFileName) {
          try {
            sourceImageForContext = await dependencies.resolveGeneratedModelFilePath(input.generated.id, input.generated.sourceImageFileName);
          } catch {}
        }
        let decisionContext = input.options.destinationExtraText;
        if (useModelRenderForDecision && sourceImageForContext) {
          await ensureVisualInterpretationForImage({
            imageInput: sourceImageForContext,
            promptContext: input.generated.prompt,
            extraContext: decisionContext
          });
          const sourceVisualHint = await getCachedVisualInterpretationPromptHint(sourceImageForContext);
          if (sourceVisualHint) {
            decisionContext = [decisionContext?.trim() || "", `Cached source-image interpretation: ${sourceVisualHint}`]
              .filter(value => value.length > 0)
              .join("\n");
          }
        }
        try {
          const complexityDecision = await dependencies.suggestLowPolyByComplexity({
            promptContext: input.generated.prompt,
            sourceImageInput: sourceImageInput || undefined,
            extraContext: decisionContext || undefined,
            preferVisualModel: true
          });
          if (complexityDecision && typeof complexityDecision.targetFaceCount === "number" && Number.isFinite(complexityDecision.targetFaceCount)) {
            targetFaceCount = Math.max(1, Math.round(complexityDecision.targetFaceCount));
          }
        } catch (error) {
          console.warn("Failed to decide low poly target faces via LLM complexity. Falling back to configured target faces.", error);
        }
      }
      const lowPolyGenerated = await dependencies.generateLowPolyModel({
        modelId: input.generated.id,
        targetFaceCount,
        executionTarget: input.options.lowPolyExecutionTarget
      });
      const lowPolyFileName = lowPolyGenerated.lowPolyModelFileName;
      if (!lowPolyFileName) {
        throw new Error("Low Poly generation did not produce an output file.");
      }
      const lowPolyPath = await dependencies.resolveGeneratedModelFilePath(lowPolyGenerated.id, lowPolyFileName);
      const lowPolyOptions = dependencies.normalizeModelPostOptions({
        includeEmbed: true,
        includeButtons: input.options.includeButtons,
        includeModelFile: false,
        includePreviewMedia: false,
        includeSourceImage: false,
        uploadTextureMessages: false
      });
      const lowPolyFollowUpFiles = await dependencies.buildGeneratedModelAttachments(lowPolyGenerated, "public", lowPolyOptions);
      if (lowPolyGenerated.lowPolyPreviewGifFileName) {
        const lowPolyPreviewGifPath = await resolveOptionalGeneratedModelFilePath(
          dependencies.resolveGeneratedModelFilePath,
          lowPolyGenerated.id,
          lowPolyGenerated.lowPolyPreviewGifFileName,
          "low poly preview GIF"
        );
        if (lowPolyPreviewGifPath) {
          lowPolyFollowUpFiles.unshift({
            attachment: lowPolyPreviewGifPath,
            name: lowPolyGenerated.lowPolyPreviewGifFileName
          });
        }
      } else if (lowPolyGenerated.lowPolyPreviewImageFileName) {
        const lowPolyPreviewPath = await resolveOptionalGeneratedModelFilePath(
          dependencies.resolveGeneratedModelFilePath,
          lowPolyGenerated.id,
          lowPolyGenerated.lowPolyPreviewImageFileName,
          "low poly preview"
        );
        if (lowPolyPreviewPath) {
          lowPolyFollowUpFiles.unshift({
            attachment: lowPolyPreviewPath,
            name: lowPolyGenerated.lowPolyPreviewImageFileName
          });
        }
      }
      lowPolyFollowUpFiles.push({
        attachment: lowPolyPath,
        name: lowPolyFileName
      });
      const lowPolyFollowUpPayload = {
        content: `✅ Low Poly version is ready. Target faces: ${dependencies.formatTargetFaceCount(lowPolyGenerated.lowPolyTargetFaceCount)}`,
        embeds: [dependencies.buildLowPolyModelEmbed(lowPolyGenerated, {
          highPolyModelUrl: input.highPolyModelUrl,
          highPolyMessageUrl: input.highPolyMessageUrl
        }) as never],
        files: lowPolyFollowUpFiles,
        components: dependencies.buildLowPolyModelComponents(lowPolyGenerated, lowPolyOptions.includeButtons) as never
      };
      await dependencies.sleep(dependencies.followUpDelayMs);
      if (progressMessage) {
        await progressMessage.edit(lowPolyFollowUpPayload);
      } else if (followUpChannel) {
        await followUpChannel.send(lowPolyFollowUpPayload);
      }
      return lowPolyGenerated;
    } catch (error) {
      console.warn("Failed to generate low poly model follow-up.", error);
      await dependencies.sleep(dependencies.followUpDelayMs);
      if (progressMessage) {
        await progressMessage.edit({
          content: "⚠️ Low Poly generation failed for this model.",
          embeds: [],
          components: [],
          files: []
        });
      } else if (followUpChannel) {
        await followUpChannel.send("⚠️ Low Poly generation failed for this model.");
      }
      return input.generated;
    }
  }

  return {
    maybePostLowPolyFollowUp
  };
}
