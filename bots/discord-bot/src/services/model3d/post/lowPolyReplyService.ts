import type { ButtonInteraction, ModalSubmitInteraction } from "discord.js";
import type { GeneratedModelPublicRecord, RealWorldDimensions, RealWorldSizeTier } from "@urage/server/services/model3d";

type LowPolyReplyServiceDependencies = {
  generateLowPolyModel: (input: {
    modelId: string;
    targetFaceCount?: number;
    realWorldSizeTier?: RealWorldSizeTier;
    realWorldReference?: string;
    realWorldDimensions?: RealWorldDimensions;
  }) => Promise<GeneratedModelPublicRecord>;
  resolveGeneratedModelFilePath: (modelId: string, fileName: string) => Promise<string>;
  normalizeModelPostOptions: (input?: Partial<{
    includeEmbed: boolean;
    includeButtons: boolean;
    includeModelFile: boolean;
    includePreviewMedia: boolean;
    includeSourceImage: boolean;
    uploadTextureMessages: boolean;
  }>) => {
    includeEmbed: boolean;
    includeButtons: boolean;
    includeModelFile: boolean;
    includePreviewMedia: boolean;
    includeSourceImage: boolean;
    uploadTextureMessages: boolean;
  };
  buildLowPolyModelEmbed: (model: GeneratedModelPublicRecord, options: {
    highPolyModelUrl?: string;
    highPolyMessageUrl?: string;
  }) => unknown;
  buildLowPolyModelComponents: (model: GeneratedModelPublicRecord, includeButtons: boolean) => unknown;
  buildDiscordMessageUrl: (guildId: string, channelId: string, messageId: string) => string;
  defaultTargetFaceCount: number;
};

type LowPolyReplyService = {
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
};

export function createLowPolyReplyService(dependencies: LowPolyReplyServiceDependencies): LowPolyReplyService {
  async function runLowPolyGenerationReply(
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
  ): Promise<void> {
    const generationLabel = input.statusLabel?.trim() ? ` (${input.statusLabel.trim()})` : "";
    await interaction.editReply(`\u{1F9E9} I also create a Low Poly version of this model now${generationLabel}...`);
    const lowPolyRecord = await dependencies.generateLowPolyModel({
      modelId: input.model.id,
      targetFaceCount: input.targetFaceCount,
      realWorldSizeTier: input.realWorldSizeTier,
      realWorldReference: input.realWorldReference,
      realWorldDimensions: input.realWorldDimensions
    });
    if (!lowPolyRecord.lowPolyModelFileName) {
      throw new Error("Low Poly generation finished without output file.");
    }
    const previewFiles: Array<{ attachment: string; name: string }> = [];
    if (lowPolyRecord.lowPolyPreviewGifFileName) {
      previewFiles.push({
        attachment: await dependencies.resolveGeneratedModelFilePath(lowPolyRecord.id, lowPolyRecord.lowPolyPreviewGifFileName),
        name: lowPolyRecord.lowPolyPreviewGifFileName
      });
    } else if (lowPolyRecord.lowPolyPreviewImageFileName) {
      previewFiles.push({
        attachment: await dependencies.resolveGeneratedModelFilePath(lowPolyRecord.id, lowPolyRecord.lowPolyPreviewImageFileName),
        name: lowPolyRecord.lowPolyPreviewImageFileName
      });
    }
    const modelOptions = dependencies.normalizeModelPostOptions({
      includeEmbed: true,
      includeButtons: true,
      includeModelFile: false,
      includePreviewMedia: false,
      includeSourceImage: false,
      uploadTextureMessages: false
    });
    const tierLabel = lowPolyRecord.lowPolyRealWorldSizeTier ?? input.realWorldSizeTier ?? "n/a";
    const faceCountLabel = lowPolyRecord.lowPolyTargetFaceCount ?? input.targetFaceCount ?? dependencies.defaultTargetFaceCount;
    const resultNote = input.resultNote?.trim() ? ` | ${input.resultNote.trim().slice(0, 180)}` : "";
    const highPolyMessageUrl = input.highPolyMessageId && interaction.guildId && interaction.channelId
      ? dependencies.buildDiscordMessageUrl(interaction.guildId, interaction.channelId, input.highPolyMessageId)
      : ("message" in interaction && interaction.message?.url ? interaction.message.url : undefined);
    await interaction.editReply({
      content: `\u2705 Low Poly version is ready. Target faces: ${faceCountLabel} | Size tier: ${tierLabel}${resultNote}`,
      embeds: [dependencies.buildLowPolyModelEmbed(lowPolyRecord, {
        highPolyModelUrl: input.model.modelUrl,
        highPolyMessageUrl
      }) as never],
      files: [
        ...previewFiles,
        {
          attachment: await dependencies.resolveGeneratedModelFilePath(lowPolyRecord.id, lowPolyRecord.lowPolyModelFileName),
          name: lowPolyRecord.lowPolyModelFileName
        }
      ],
      components: dependencies.buildLowPolyModelComponents(lowPolyRecord, modelOptions.includeButtons) as never
    });
  }

  return {
    runLowPolyGenerationReply
  };
}

