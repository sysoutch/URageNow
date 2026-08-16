import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from "discord.js";
import {
  model3dDetailedReadyLine,
  model3dPublicDailyReadyHeading,
  model3dPublicReadyHeading
} from "@urage/shared/model3d.postText";
import type { GeneratedModelPublicRecord } from "@urage/server/services/model3d";
import {
  DEFAULT_LOW_POLY_TARGET_FACE_COUNT,
  normalizePositiveInteger
} from "./modelPostHelpers.js";
import type {
  ModelPostButtonPrefixes,
  ModelPostMessageMode,
  ModelPostOptions,
  ModelTextureMessageLinks
} from "./modelPostTypes.js";

type ModelPostUiHelpers = {
  buildGeneratedModelComponents: (
    record: GeneratedModelPublicRecord,
    mode?: ModelPostMessageMode,
    options?: Required<ModelPostOptions>,
    textureLinks?: ModelTextureMessageLinks,
    includePublicTextureButtons?: boolean
  ) => Array<ActionRowBuilder<ButtonBuilder>>;
  buildLowPolyModelComponents: (record: GeneratedModelPublicRecord, includeButtons?: boolean) => Array<ActionRowBuilder<ButtonBuilder>>;
  buildModelReadyContent: (mode?: ModelPostMessageMode, includePublicTextureButtons?: boolean) => string;
  normalizeModelPostOptions: (options: ModelPostOptions | undefined) => Required<ModelPostOptions>;
};

export function createModelPostUiHelpers(buttonPrefixes: ModelPostButtonPrefixes): ModelPostUiHelpers {
  function buildPublicTextureButton(config: { label: string; customId: string; linkUrl: string | undefined; disabled: boolean; }): ButtonBuilder {
    if (config.linkUrl) {
      return new ButtonBuilder().setLabel(config.label).setStyle(ButtonStyle.Link).setURL(config.linkUrl);
    }
    return new ButtonBuilder().setCustomId(config.customId).setLabel(config.label).setStyle(ButtonStyle.Primary).setDisabled(config.disabled);
  }

  function buildGeneratedModelComponents(
    record: GeneratedModelPublicRecord,
    mode: ModelPostMessageMode = "detailed",
    options?: Required<ModelPostOptions>,
    textureLinks?: ModelTextureMessageLinks,
    includePublicTextureButtons = true
  ): Array<ActionRowBuilder<ButtonBuilder>> {
    if (options && !options.includeButtons) {
      return [];
    }
    const rows: Array<ActionRowBuilder<ButtonBuilder>> = [];
    const firstRowButtons = [
      new ButtonBuilder().setCustomId(`${buttonPrefixes.upvote}${record.id}`).setLabel("Upvote").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`${buttonPrefixes.downvote}${record.id}`).setLabel("Downvote").setStyle(ButtonStyle.Danger)
    ];
    if (mode === "detailed") {
      firstRowButtons.push(
        new ButtonBuilder().setCustomId(`${buttonPrefixes.refresh}${record.id}`).setLabel("Refresh").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`${buttonPrefixes.newModel}${record.id}`).setLabel("New Model").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`${buttonPrefixes.settings}${record.id}`).setLabel("Settings").setStyle(ButtonStyle.Secondary)
      );
    } else if (includePublicTextureButtons) {
      firstRowButtons.push(
        buildPublicTextureButton({
          label: "Multi View",
          customId: `${buttonPrefixes.multiView}${record.id}`,
          linkUrl: textureLinks?.multiViewUrl,
          disabled: record.multiViewFileNames.length === 0
        }),
        buildPublicTextureButton({
          label: "UV Map",
          customId: `${buttonPrefixes.uvMap}${record.id}`,
          linkUrl: textureLinks?.uvMapUrl,
          disabled: !record.uvMapFileName && !record.uvMapInpaintFileName
        }),
        buildPublicTextureButton({
          label: "Normal Map",
          customId: `${buttonPrefixes.normalMap}${record.id}`,
          linkUrl: textureLinks?.normalMapUrl,
          disabled: !record.normalMapFileName
        })
      );
    }
    rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(...firstRowButtons));
    if (mode === "detailed") {
      rows.push(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`${buttonPrefixes.lowPoly}${record.id}`)
            .setLabel("Low Poly")
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`${buttonPrefixes.multiView}${record.id}`)
            .setLabel("Multi View")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(record.multiViewFileNames.length === 0),
          new ButtonBuilder()
            .setCustomId(`${buttonPrefixes.uvMap}${record.id}`)
            .setLabel("UV Map")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(!record.uvMapFileName && !record.uvMapInpaintFileName),
          new ButtonBuilder()
            .setCustomId(`${buttonPrefixes.normalMap}${record.id}`)
            .setLabel("Normal Map")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(!record.normalMapFileName)
        )
      );
    }
    return rows;
  }

  function buildLowPolyModelComponents(record: GeneratedModelPublicRecord, includeButtons = true): Array<ActionRowBuilder<ButtonBuilder>> {
    if (!includeButtons) {
      return [];
    }
    return [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`${buttonPrefixes.upvote}${record.id}`).setLabel("Upvote").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`${buttonPrefixes.downvote}${record.id}`).setLabel("Downvote").setStyle(ButtonStyle.Danger)
      )
    ];
  }

  function buildModelReadyContent(mode: ModelPostMessageMode = "detailed", includePublicTextureButtons = true): string {
    if (mode === "public") {
      if (!includePublicTextureButtons) {
        return model3dPublicReadyHeading;
      }
      return [
        model3dPublicDailyReadyHeading,
        "",
        "If you need multi-view, click button below and I will upload them here.",
        "If you need UV textures, click button below and I will upload them here.",
        "If you need normal maps, click button below and I will upload them here."
      ].join("\n");
    }
    return [
      model3dDetailedReadyLine,
      "",
      "Merge Vertices (IMPORTANT):",
      "1. Download the model below",
      "2. Open it in [Blender](<https://www.blender.org/download/>)",
      "3. Switch to Edit Mode (`TAB`)",
      "4. Select all faces (`A`)",
      "5. Press `Alt + J` to convert triangles to quads",
      "6. Press `M` and select By Distance to merge vertices",
      "7. Exit Edit Mode (`TAB`)",
      "8. Right-click -> Shade Auto Smooth",
      "",
      "Have fun!"
    ].join("\n");
  }

  function normalizeModelPostOptions(options: ModelPostOptions | undefined): Required<ModelPostOptions> {
    const targetMode = options?.targetMode === "thread" || options?.targetMode === "forum-post" || options?.targetMode === "forum-create-and-post" ? options.targetMode : "channel";
    const threadNameMode = options?.threadNameMode === "increment" || options?.threadNameMode === "model-name" ? options.threadNameMode : "fixed";
    const textureUploadTarget = options?.textureUploadTarget === "selected" ? "selected" : "target";
    const modelUploadTarget = options?.modelUploadTarget === "target" ? "target" : "selected";
    const modelNameSource = options?.modelNameSource === "filename" ? "filename" : "llm";
    const lowPolyTargetFaceCount = normalizePositiveInteger(options?.lowPolyTargetFaceCount, DEFAULT_LOW_POLY_TARGET_FACE_COUNT);
    return {
      targetMode,
      threadNameMode,
      threadName: options?.threadName?.trim() ?? "",
      threadNameBase: options?.threadNameBase?.trim() ?? "",
      modelNameSource,
      forumChannelId: options?.forumChannelId?.trim() ?? "",
      forumChannelName: options?.forumChannelName?.trim() ?? "",
      lowPolyForumChannelId: options?.lowPolyForumChannelId?.trim() ?? "",
      lowPolyForumChannelName: options?.lowPolyForumChannelName?.trim() ?? "",
      sendInitialToSelectedChannel: options?.sendInitialToSelectedChannel === true,
      initialExtraText: options?.initialExtraText?.trim() ?? "",
      destinationExtraText: options?.destinationExtraText?.trim() ?? "",
      modelUploadTarget,
      includeModelFile: options?.includeModelFile !== false,
      includePreviewMedia: options?.includePreviewMedia !== false,
      includeSourceImage: options?.includeSourceImage !== false,
      includeEmbed: options?.includeEmbed !== false,
      includeEmbedInInitial: options?.includeEmbedInInitial !== false,
      includeButtons: options?.includeButtons !== false,
      uploadTextureMessages: options?.uploadTextureMessages === true,
      uploadMultiViewTextures: options?.uploadMultiViewTextures !== false,
      uploadUvMapTextures: options?.uploadUvMapTextures !== false,
      uploadNormalMapTextures: options?.uploadNormalMapTextures !== false,
      textureUploadTarget,
      generateLowPolyVersion: options?.generateLowPolyVersion === true,
      lowPolyExecutionTarget: options?.lowPolyExecutionTarget === "remote" ? "remote" : "local",
      lowPolyUseLlmTargetFaces: options?.lowPolyUseLlmTargetFaces === true,
      lowPolyLlmDecisionSource: options?.lowPolyLlmDecisionSource === "model-render" ? "model-render" : "input-image",
      lowPolyTargetFaceCount
    };
  }

  return {
    buildGeneratedModelComponents,
    buildLowPolyModelComponents,
    buildModelReadyContent,
    normalizeModelPostOptions
  };
}
