import { MessageFlags, type ButtonInteraction, type ModalSubmitInteraction } from "discord.js";
import type { GeneratedModelPublicRecord } from "@urage/server/services/model3d";
import {
  buildLowPolyAutoModal,
  buildLowPolyComplexityModal,
  buildLowPolyDimensionsModal
} from "./generatedModelInteractionModalHelpers.js";
import {
  sendMultiViewReply,
  sendNormalReply,
  sendUvReply
} from "./generatedModelInteractionReplyHelpers.js";
import type {
  GeneratedModelInteractionService,
  GeneratedModelInteractionServiceDependencies
} from "./generatedModelInteractionTypes.js";

export function createGeneratedModelInteractionService(dependencies: GeneratedModelInteractionServiceDependencies): GeneratedModelInteractionService {
  const orderedPrefixes = [
    dependencies.ids.upvotePrefix,
    dependencies.ids.downvotePrefix,
    dependencies.ids.refreshPrefix,
    dependencies.ids.newPrefix,
    dependencies.ids.settingsPrefix,
    dependencies.ids.lowPolyPrefix,
    dependencies.ids.lowPolySizePrefix,
    dependencies.ids.lowPolyDimensionsPrefix,
    dependencies.ids.lowPolyAutoPrefix,
    dependencies.ids.lowPolyComplexityPrefix,
    dependencies.ids.multiViewPrefix,
    dependencies.ids.uvPrefix,
    dependencies.ids.normalPrefix
  ];

  async function findModel(modelId: string): Promise<GeneratedModelPublicRecord | null> {
    return (await dependencies.listGeneratedModelsPublic()).find(entry => entry.id === modelId) ?? null;
  }

  async function replyMissingModel(interaction: ButtonInteraction | ModalSubmitInteraction): Promise<void> {
    await interaction.reply({ content: "That generated model is no longer available.", flags: MessageFlags.Ephemeral });
  }

  async function handleLowPolyButtonAction(interaction: ButtonInteraction, matchedPrefix: string): Promise<boolean> {
    if (matchedPrefix === dependencies.ids.lowPolySizePrefix) {
      const parsed = dependencies.parseLowPolySizeButtonValue(interaction.customId, dependencies.ids.lowPolySizePrefix);
      if (!parsed) {
        await interaction.reply({ content: "Low Poly size selection is invalid.", flags: MessageFlags.Ephemeral });
        return true;
      }
      const model = await findModel(parsed.modelId);
      if (!model) {
        await replyMissingModel(interaction);
        return true;
      }
      await interaction.deferReply();
      await dependencies.runLowPolyGenerationReply(interaction, {
        model,
        targetFaceCount: dependencies.getLowPolyTargetFaceCountForTier(parsed.tier, dependencies.lowPolySizeChoices, dependencies.defaultLowPolyTargetFaceCount),
        realWorldSizeTier: parsed.tier,
        statusLabel: `size tier: ${parsed.tier}`,
        highPolyMessageId: parsed.sourceMessageId ?? undefined
      });
      return true;
    }
    if (matchedPrefix === dependencies.ids.lowPolyAutoPrefix) {
      const context = dependencies.parseLowPolyInteractionContext(interaction.customId.slice(dependencies.ids.lowPolyAutoPrefix.length));
      if (!context?.modelId) {
        await interaction.reply({ content: "Model reference is missing.", flags: MessageFlags.Ephemeral });
        return true;
      }
      await interaction.showModal(buildLowPolyAutoModal(dependencies.ids, dependencies.buildLowPolyInteractionPayload, context, interaction));
      return true;
    }
    if (matchedPrefix === dependencies.ids.lowPolyComplexityPrefix) {
      const context = dependencies.parseLowPolyInteractionContext(interaction.customId.slice(dependencies.ids.lowPolyComplexityPrefix.length));
      if (!context?.modelId) {
        await interaction.reply({ content: "Model reference is missing.", flags: MessageFlags.Ephemeral });
        return true;
      }
      await interaction.showModal(buildLowPolyComplexityModal(dependencies.ids, dependencies.buildLowPolyInteractionPayload, context, interaction));
      return true;
    }
    if (matchedPrefix === dependencies.ids.lowPolyDimensionsPrefix) {
      const context = dependencies.parseLowPolyInteractionContext(interaction.customId.slice(dependencies.ids.lowPolyDimensionsPrefix.length));
      if (!context?.modelId) {
        await interaction.reply({ content: "Model reference is missing.", flags: MessageFlags.Ephemeral });
        return true;
      }
      await interaction.showModal(buildLowPolyDimensionsModal(dependencies.ids, dependencies.buildLowPolyInteractionPayload, context, interaction));
      return true;
    }
    return false;
  }

  async function handleSimpleFeedbackButton(interaction: ButtonInteraction, matchedPrefix: string): Promise<boolean> {
    if (matchedPrefix === dependencies.ids.upvotePrefix) {
      await interaction.reply({ content: "Thanks for the upvote! 👍", flags: MessageFlags.Ephemeral });
      return true;
    }
    if (matchedPrefix === dependencies.ids.downvotePrefix) {
      await interaction.reply({ content: "Thanks for the feedback. 👎", flags: MessageFlags.Ephemeral });
      return true;
    }
    if (matchedPrefix === dependencies.ids.refreshPrefix) {
      await interaction.reply({ content: "Model controls are active.", flags: MessageFlags.Ephemeral });
      return true;
    }
    if (matchedPrefix === dependencies.ids.newPrefix) {
      await interaction.reply({ content: "Use `/model` with a new image to generate another model.", flags: MessageFlags.Ephemeral });
      return true;
    }
    if (matchedPrefix === dependencies.ids.settingsPrefix) {
      await interaction.reply({ content: "3D workflow settings are available in the dashboard.", flags: MessageFlags.Ephemeral });
      return true;
    }
    return false;
  }

  async function handleModelAssetButton(interaction: ButtonInteraction, matchedPrefix: string, model: GeneratedModelPublicRecord): Promise<boolean> {
    if (matchedPrefix === dependencies.ids.multiViewPrefix) {
      await sendMultiViewReply(interaction, model, dependencies.resolveGeneratedModelFilePath);
      return true;
    }
    if (matchedPrefix === dependencies.ids.uvPrefix) {
      await sendUvReply(interaction, model, dependencies.resolveGeneratedModelFilePath);
      return true;
    }
    if (matchedPrefix === dependencies.ids.normalPrefix) {
      await sendNormalReply(interaction, model, dependencies.resolveGeneratedModelFilePath);
      return true;
    }
    if (matchedPrefix === dependencies.ids.lowPolyPrefix) {
      await interaction.reply({
        content: "Pick a size tier, enter exact dimensions, use AI size, or AI complexity.",
        components: dependencies.buildLowPolySizePickerComponents({
          modelId: model.id,
          sourceMessageId: interaction.message?.id,
          sizeChoices: dependencies.lowPolySizeChoices,
          sizePrefix: dependencies.ids.lowPolySizePrefix,
          dimensionsPrefix: dependencies.ids.lowPolyDimensionsPrefix,
          complexityPrefix: dependencies.ids.lowPolyComplexityPrefix,
          autoPrefix: dependencies.ids.lowPolyAutoPrefix
        }) as never,
        flags: MessageFlags.Ephemeral
      });
      return true;
    }
    return false;
  }

  async function handleGeneratedModelButton(interaction: ButtonInteraction): Promise<void> {
    const matchedPrefix = orderedPrefixes.find(prefix => interaction.customId.startsWith(prefix));
    if (!matchedPrefix) {
      return;
    }
    if (await handleLowPolyButtonAction(interaction, matchedPrefix)) {
      return;
    }
    const modelId = interaction.customId.slice(matchedPrefix.length).trim();
    if (!modelId) {
      await interaction.reply({ content: "Model reference is missing.", flags: MessageFlags.Ephemeral });
      return;
    }
    if (await handleSimpleFeedbackButton(interaction, matchedPrefix)) {
      return;
    }
    const model = await findModel(modelId);
    if (!model) {
      await replyMissingModel(interaction);
      return;
    }
    await handleModelAssetButton(interaction, matchedPrefix, model);
  }

  async function handleGeneratedModelModal(interaction: ModalSubmitInteraction): Promise<boolean> {
    if (interaction.customId.startsWith(dependencies.ids.lowPolyAutoModalPrefix)) {
      const parsed = dependencies.parseLowPolyModalValue(interaction.customId, dependencies.ids.lowPolyAutoModalPrefix);
      if (!parsed) {
        await interaction.reply({ content: "Low Poly AI request is invalid.", flags: MessageFlags.Ephemeral });
        return true;
      }
      const model = await findModel(parsed.modelId);
      if (!model) {
        await replyMissingModel(interaction);
        return true;
      }
      const reference = interaction.fields.getTextInputValue(dependencies.ids.lowPolyAutoModalReferenceInputId)?.trim() ?? "";
      if (!reference) {
        await interaction.reply({ content: "Please provide a real-life object reference.", flags: MessageFlags.Ephemeral });
        return true;
      }
      await interaction.deferReply();
      const tier = await dependencies.classifyRealWorldSizeTier(reference);
      await dependencies.runLowPolyGenerationReply(interaction, {
        model,
        targetFaceCount: dependencies.getLowPolyTargetFaceCountForTier(tier, dependencies.lowPolySizeChoices, dependencies.defaultLowPolyTargetFaceCount),
        realWorldSizeTier: tier,
        realWorldReference: reference,
        statusLabel: `AI size tier: ${tier}`,
        highPolyMessageId: parsed.sourceMessageId ?? undefined
      });
      return true;
    }
    if (interaction.customId.startsWith(dependencies.ids.lowPolyComplexityModalPrefix)) {
      const parsed = dependencies.parseLowPolyModalValue(interaction.customId, dependencies.ids.lowPolyComplexityModalPrefix);
      if (!parsed) {
        await interaction.reply({ content: "Low Poly complexity request is invalid.", flags: MessageFlags.Ephemeral });
        return true;
      }
      const model = await findModel(parsed.modelId);
      if (!model) {
        await replyMissingModel(interaction);
        return true;
      }
      const context = interaction.fields.getTextInputValue(dependencies.ids.lowPolyComplexityModalContextInputId)?.trim() ?? "";
      await interaction.deferReply();
      const decision = await dependencies.decideLowPolyByVisualComplexity({ model, context: context || undefined });
      await dependencies.runLowPolyGenerationReply(interaction, {
        model,
        targetFaceCount: decision.targetFaceCount,
        realWorldSizeTier: decision.sizeTier,
        realWorldReference: context || undefined,
        statusLabel: `${decision.usedVisionModel ? "visual" : "text"} ${decision.complexity}: ${decision.targetFaceCount}`,
        resultNote: decision.reason,
        highPolyMessageId: parsed.sourceMessageId ?? undefined
      });
      return true;
    }
    if (interaction.customId.startsWith(dependencies.ids.lowPolyDimensionsModalPrefix)) {
      const parsed = dependencies.parseLowPolyModalValue(interaction.customId, dependencies.ids.lowPolyDimensionsModalPrefix);
      if (!parsed) {
        await interaction.reply({ content: "Low Poly dimensions request is invalid.", flags: MessageFlags.Ephemeral });
        return true;
      }
      const model = await findModel(parsed.modelId);
      if (!model) {
        await replyMissingModel(interaction);
        return true;
      }
      const dimensionsText = interaction.fields.getTextInputValue(dependencies.ids.lowPolyDimensionsModalInputId)?.trim() ?? "";
      const dimensions = dependencies.parseRealWorldDimensionsText(dimensionsText);
      if (!dimensions) {
        await interaction.reply({
          content: "Please enter dimensions with a unit, for example `30cm x 20cm x 10cm` or `2m x 1.5m x 1m`.",
          flags: MessageFlags.Ephemeral
        });
        return true;
      }
      await interaction.deferReply();
      const tier = dependencies.deriveRealWorldSizeTierFromDimensions(dimensions) ?? "medium";
      await dependencies.runLowPolyGenerationReply(interaction, {
        model,
        realWorldSizeTier: tier,
        realWorldDimensions: dimensions,
        statusLabel: `dimensions: ${dependencies.formatRealWorldDimensions(dimensions)}`,
        highPolyMessageId: parsed.sourceMessageId ?? undefined
      });
      return true;
    }
    return false;
  }

  return {
    handleGeneratedModelButton,
    handleGeneratedModelModal
  };
}
