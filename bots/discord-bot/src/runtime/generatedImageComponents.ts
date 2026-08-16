import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import type { GeneratedImagePublicRecord } from "@urage/server/services/imageGeneration";

export function buildGeneratedImageComponents(input: {
  record: GeneratedImagePublicRecord;
  requestedByUserId: string;
  imageGenerate3dPrefix: string;
  imageNewPrefix: string;
  imageNewPromptPrefix: string;
  imageAddToPoolPrefix: string;
}): Array<ActionRowBuilder<ButtonBuilder>> {
  const payload = `${input.record.id}|${input.requestedByUserId}`;
  const modelAlreadyGenerated = Boolean(input.record.modelGeneratedModelId);
  const primaryActionsRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${input.imageGenerate3dPrefix}${payload}`)
      .setLabel(modelAlreadyGenerated ? "3D Model Ready" : "Create 3D Model")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(modelAlreadyGenerated),
    new ButtonBuilder()
      .setCustomId(`${input.imageNewPrefix}${payload}`)
      .setLabel("New Variant")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`${input.imageNewPromptPrefix}${payload}`)
      .setLabel("New Prompt")
      .setStyle(ButtonStyle.Secondary)
  );
  const utilityActionsRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${input.imageAddToPoolPrefix}${payload}`)
      .setLabel("Add To Pool")
      .setStyle(ButtonStyle.Success)
  );
  return [primaryActionsRow, utilityActionsRow];
}
