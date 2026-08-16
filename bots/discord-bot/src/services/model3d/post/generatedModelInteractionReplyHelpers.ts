import { MessageFlags, type ButtonInteraction } from "discord.js";
import type { GeneratedModelPublicRecord } from "@urage/server/services/model3d";

export async function sendMultiViewReply(interaction: ButtonInteraction, model: GeneratedModelPublicRecord, resolvePath: (modelId: string, fileName: string) => Promise<string>): Promise<void> {
  if (model.multiViewFileNames.length === 0) {
    await interaction.reply({ content: "No multi-view images were generated for this model.", flags: MessageFlags.Ephemeral });
    return;
  }
  const files = await Promise.all(model.multiViewFileNames.map(async fileName => ({
    attachment: await resolvePath(model.id, fileName),
    name: fileName
  })));
  await interaction.reply({ content: `Multi-view images for \`${model.modelFileName}\``, files });
}

export async function sendUvReply(interaction: ButtonInteraction, model: GeneratedModelPublicRecord, resolvePath: (modelId: string, fileName: string) => Promise<string>): Promise<void> {
  if (!model.uvMapFileName && !model.uvMapInpaintFileName) {
    await interaction.reply({ content: "No UV map was generated for this model.", flags: MessageFlags.Ephemeral });
    return;
  }
  const files: Array<{ attachment: string; name: string }> = [];
  if (model.uvMapFileName) {
    files.push({
      attachment: await resolvePath(model.id, model.uvMapFileName),
      name: model.uvMapFileName
    });
  }
  if (model.uvMapInpaintFileName) {
    files.push({
      attachment: await resolvePath(model.id, model.uvMapInpaintFileName),
      name: model.uvMapInpaintFileName
    });
  }
  await interaction.reply({
    content: model.uvMapInpaintFileName ? `UV maps for \`${model.modelFileName}\` (standard + in-painted)` : `UV map for \`${model.modelFileName}\``,
    files
  });
}

export async function sendNormalReply(interaction: ButtonInteraction, model: GeneratedModelPublicRecord, resolvePath: (modelId: string, fileName: string) => Promise<string>): Promise<void> {
  if (!model.normalMapFileName) {
    await interaction.reply({ content: "No normal map was generated for this model.", flags: MessageFlags.Ephemeral });
    return;
  }
  await interaction.reply({
    content: `Normal map for \`${model.modelFileName}\``,
    files: [{
      attachment: await resolvePath(model.id, model.normalMapFileName),
      name: model.normalMapFileName
    }]
  });
}
