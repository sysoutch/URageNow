import { Colors, EmbedBuilder } from "discord.js";
import path from "node:path";
import { appConfig } from "@urage/server/config/appConfig";
import type { GeneratedModelPublicRecord } from "@urage/server/services/model3d";
import type { LowPolyEmbedLinks, ModelTextureMessageLinks } from "./modelPostTypes.js";

type ModelPostEmbedHelpersDependencies = {
  formatTargetFaceCount: (value: number | null) => string;
  formatRealWorldDimensionsMeters: (record: GeneratedModelPublicRecord) => string;
  formatLowPolyReference: (record: GeneratedModelPublicRecord) => string;
  formatToggleState: (value: boolean) => string;
  normalizeDiscordAttachmentUrl: (value: string) => string;
  normalizeDiscordMessageUrl: (value: string) => string;
};

type ModelPostEmbedHelpers = {
  buildGeneratedModelEmbed: (record: GeneratedModelPublicRecord, textureLinks?: ModelTextureMessageLinks) => EmbedBuilder;
  buildLowPolyModelEmbed: (record: GeneratedModelPublicRecord, links?: LowPolyEmbedLinks) => EmbedBuilder;
};

export function createModelPostEmbedHelpers(dependencies: ModelPostEmbedHelpersDependencies): ModelPostEmbedHelpers {
  function buildGeneratedModelEmbed(record: GeneratedModelPublicRecord, textureLinks?: ModelTextureMessageLinks): EmbedBuilder {
    const multiViewValue = textureLinks?.multiViewUrl
      ? `[Open Multi View textures](${textureLinks.multiViewUrl})`
      : (record.multiViewFileNames.length > 0 ? `\`[${record.multiViewFileNames.join(", ")}]\`` : "`[]`");
    const uvValue = textureLinks?.uvMapUrl
      ? `[Open UV textures](${textureLinks.uvMapUrl})`
      : (record.uvMapFileName ? `\`${record.uvMapFileName}\`` : "`none`");
    const normalValue = textureLinks?.normalMapUrl
      ? `[Open Normal texture](${textureLinks.normalMapUrl})`
      : (record.normalMapFileName ? `\`${record.normalMapFileName}\`` : "`none`");
    return new EmbedBuilder()
      .setColor(Colors.Gold)
      .setTitle("🖼️ Generated 3D Model")
      .addFields(
        { name: "🗂️ Filename", value: `\`${record.sourceImageFileName}\``, inline: false },
        { name: "🧱 Low Poly", value: record.lowPolyModelFileName ? `\`${record.lowPolyModelFileName}\`` : "`none`", inline: false },
        { name: "🪟 Multi View", value: multiViewValue, inline: false },
        { name: "🌐 UV Map", value: uvValue, inline: false },
        { name: "🧩 UV Map (In-Painted)", value: record.uvMapInpaintFileName ? `\`${record.uvMapInpaintFileName}\`` : "`none`", inline: false },
        { name: "🗺️ Normal Map", value: normalValue, inline: false },
        { name: "🧱 Low Poly Faces", value: dependencies.formatTargetFaceCount(record.lowPolyTargetFaceCount), inline: true },
        { name: "📏 Size Tier", value: record.lowPolyRealWorldSizeTier ? `\`${record.lowPolyRealWorldSizeTier}\`` : "`n/a`", inline: true },
        { name: "📐 Dimensions", value: dependencies.formatRealWorldDimensionsMeters(record), inline: true },
        { name: "🔺 Target Faces", value: dependencies.formatTargetFaceCount(record.targetFaceCount), inline: true },
        { name: "🧠 Model", value: "Hunyuan", inline: true }
      );
  }

  function buildLowPolyModelEmbed(record: GeneratedModelPublicRecord, links?: LowPolyEmbedLinks): EmbedBuilder {
    const highPolyModelValue = links?.highPolyModelUrl
      ? `[Open high poly model](${dependencies.normalizeDiscordAttachmentUrl(links.highPolyModelUrl)})`
      : `\`${record.modelFileName}\``;
    const highPolyPostValue = links?.highPolyMessageUrl
      ? `[Open high poly post](${dependencies.normalizeDiscordMessageUrl(links.highPolyMessageUrl)})`
      : "`n/a`";
    return new EmbedBuilder()
      .setColor(Colors.Blurple)
      .setTitle("🧱 Low Poly Conversion")
      .addFields(
        { name: "🧱 Low Poly File", value: record.lowPolyModelFileName ? `\`${record.lowPolyModelFileName}\`` : "`none`", inline: false },
        { name: "📦 High Poly Model", value: highPolyModelValue, inline: false },
        { name: "🔗 High Poly Post", value: highPolyPostValue, inline: false },
        { name: "🐍 Python Script", value: `\`${path.basename(appConfig.blenderLowPolyScriptPath)}\``, inline: true },
        { name: "🧰 Blender", value: `\`${path.basename(appConfig.blenderExecutablePath)}\``, inline: true },
        { name: "🧩 Merge Vertices", value: dependencies.formatToggleState(appConfig.blenderLowPolyMergeVertices), inline: true },
        { name: "✂️ Decimate", value: dependencies.formatToggleState(appConfig.blenderLowPolyShouldDecimate), inline: true },
        { name: "🎨 Max Colors", value: `\`${appConfig.blenderLowPolyMaxColors}\``, inline: true },
        { name: "🧱 Block Size", value: `\`${appConfig.blenderLowPolyBlockSize}\``, inline: true },
        { name: "🧱 Low Poly Faces", value: dependencies.formatTargetFaceCount(record.lowPolyTargetFaceCount), inline: true },
        { name: "📏 Size Tier", value: record.lowPolyRealWorldSizeTier ? `\`${record.lowPolyRealWorldSizeTier}\`` : "`n/a`", inline: true },
        { name: "📐 Dimensions", value: dependencies.formatRealWorldDimensionsMeters(record), inline: true },
        { name: "📝 Reference", value: dependencies.formatLowPolyReference(record), inline: false }
      );
  }

  return {
    buildGeneratedModelEmbed,
    buildLowPolyModelEmbed
  };
}
