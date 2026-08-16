import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction
} from "discord.js";
import type { GeneratedModelInteractionIds, LowPolyInteractionContext } from "./generatedModelInteractionTypes.js";

export function buildLowPolyAutoModal(ids: GeneratedModelInteractionIds, buildPayload: (modelId: string, sourceMessageId?: string) => string, context: LowPolyInteractionContext, interaction: ButtonInteraction): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId(`${ids.lowPolyAutoModalPrefix}${buildPayload(context.modelId, context.sourceMessageId ?? interaction.message?.id)}`)
    .setTitle("Low Poly Size (AI)");
  const referenceInput = new TextInputBuilder()
    .setCustomId(ids.lowPolyAutoModalReferenceInputId)
    .setLabel("Real-life object (for example: house)")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(80);
  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(referenceInput));
  return modal;
}

export function buildLowPolyComplexityModal(ids: GeneratedModelInteractionIds, buildPayload: (modelId: string, sourceMessageId?: string) => string, context: LowPolyInteractionContext, interaction: ButtonInteraction): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId(`${ids.lowPolyComplexityModalPrefix}${buildPayload(context.modelId, context.sourceMessageId ?? interaction.message?.id)}`)
    .setTitle("Low Poly Face Count (AI Complexity)");
  const contextInput = new TextInputBuilder()
    .setCustomId(ids.lowPolyComplexityModalContextInputId)
    .setLabel("Optional context (e.g. interior details)")
    .setPlaceholder("Optional: game style / quality target")
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(120);
  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(contextInput));
  return modal;
}

export function buildLowPolyDimensionsModal(ids: GeneratedModelInteractionIds, buildPayload: (modelId: string, sourceMessageId?: string) => string, context: LowPolyInteractionContext, interaction: ButtonInteraction): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId(`${ids.lowPolyDimensionsModalPrefix}${buildPayload(context.modelId, context.sourceMessageId ?? interaction.message?.id)}`)
    .setTitle("Low Poly Size (Dimensions)");
  const dimensionsInput = new TextInputBuilder()
    .setCustomId(ids.lowPolyDimensionsModalInputId)
    .setLabel("Real-life dimensions (W x H x D)")
    .setPlaceholder("Example: 30cm x 20cm x 10cm")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(100);
  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(dimensionsInput));
  return modal;
}
