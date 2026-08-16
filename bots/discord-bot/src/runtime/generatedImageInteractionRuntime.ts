import {
  ActionRowBuilder,
  GuildMember,
  MessageFlags,
  StringSelectMenuBuilder,
  type ButtonInteraction,
  type StringSelectMenuInteraction
} from "discord.js";
import type { PendingImagePoolSelection } from "./imagePoolRuntimeHelpers.js";

type GeneratedImageInteractionRuntimeInput = {
  imageGenerate3dPrefix: string;
  imageNewPrefix: string;
  imageNewPromptPrefix: string;
  imageAddToPoolButtonPrefix: string;
  imageAddToPoolSelectPrefix: string;
  pendingImageModelGenerations: Set<string>;
  pendingImagePoolSelections: Map<string, PendingImagePoolSelection>;
  isProtectedGuildMember: (member: GuildMember | null | undefined) => boolean;
  canUseVerifiedImagePools: (member: GuildMember | null | undefined) => Promise<boolean>;
  parseImageActionPayload: (value: string) => { imageId: string; requesterId: string; } | null;
  parseImageAddToPoolButtonCustomId: (value: string) => { imageId: string; requesterId?: string; } | null;
  getGeneratedImagePublicById: (imageId: string) => Promise<any>;
  readGeneratedImageFile: (imageId: string, fileName: string) => Promise<{ data: Buffer; contentType: string; }>;
  buildImageDataUrl: (input: { bytes: Buffer; contentType: string; }) => string;
  resolveModelPrompt: (input: any) => Promise<string>;
  resolveModel3dLlmConnectionSettingsFromState: () => any;
  generate3dModelWithExecution: (input: any, executionTarget: "local" | "remote") => Promise<any>;
  toGeneratedModelPublicRecord: (record: any) => any;
  getGlobalSettings: () => {
    model3dGenerationTarget: "local" | "remote";
    model3dMetadataTarget: "local" | "remote";
    ollamaTextModelIsVisual?: boolean;
  };
  suggestModelMetadataViaRemoteWorker: (input: any) => Promise<{ fileName?: string | null; }>;
  suggestModelFileNameAndDescription: (input: any) => Promise<{ fileName?: string | null; }>;
  renameGeneratedModelFileName: (modelId: string, fileName: string) => Promise<any>;
  markGeneratedImageModelResult: (imageId: string, modelId: string) => Promise<any>;
  toGeneratedImagePublicRecord: (record: any) => any;
  buildGeneratedImageComponents: (record: any, requesterId: string) => any;
  normalizeModelPostOptions: (input: any) => any;
  buildModelReadyContent: () => string;
  buildGeneratedModelEmbed: (record: any) => any;
  buildGeneratedModelAttachments: (...args: any[]) => Promise<any>;
  buildGeneratedModelComponents: (...args: any[]) => any;
  resolveImagePrompt: (input: any) => Promise<string>;
  resolveImageLlmConnectionSettingsFromState: () => any;
  generateImageWithExecution: (input: any) => Promise<any>;
  buildGeneratedImageEmbed: (record: any) => any;
  buildGeneratedImageAttachment: (record: any) => Promise<any>;
  summarizeText: (value: string) => string;
  resolveGeneratedImageApiSourceToFilePath: (value: string) => Promise<string | null>;
  addImageSourceToUserUnverifiedPool: (input: {
    userId: string;
    username: string;
    displayName?: string;
    imageSource: string;
  }) => Promise<{ added: boolean; created?: boolean; pool: { name: string; images: string[]; }; }>;
  listImagePools: () => Promise<Array<{ id: string; name: string; images: string[]; }>>;
  rememberPendingImagePoolSelection: (input: PendingImagePoolSelection) => string;
  trimSelectLabel: (value: string, fallback: string) => string;
  addImageSourceToPool: (input: { poolId: string; imageSource: string; }) => Promise<{ added: boolean; pool: { name: string; images: string[]; }; }>;
  recordAction: (type: string, summary: string) => void;
};

export function createGeneratedImageInteractionRuntime(input: GeneratedImageInteractionRuntimeInput) {
  async function handleImageActionButton(interaction: ButtonInteraction): Promise<void> {
    const matchedPrefix = [
      input.imageGenerate3dPrefix,
      input.imageNewPrefix,
      input.imageNewPromptPrefix
    ].find(prefix => interaction.customId.startsWith(prefix)) ?? "";
    const parsed = input.parseImageActionPayload(interaction.customId.slice(matchedPrefix.length).trim());
    if (!parsed) {
      await interaction.reply({
        content: "This image action payload is invalid.",
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    const actingMember = interaction.member instanceof GuildMember ? interaction.member : null;
    if (interaction.user.id !== parsed.requesterId && !input.isProtectedGuildMember(actingMember)) {
      await interaction.reply({
        content: "Only the requester or a protected member can run this image action.",
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    const generatedImage = await input.getGeneratedImagePublicById(parsed.imageId);
    if (!generatedImage) {
      await interaction.reply({
        content: "Generated image entry was not found.",
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    await interaction.deferReply();
    try {
      if (matchedPrefix === input.imageGenerate3dPrefix) {
        if (generatedImage.modelGeneratedModelId) {
          await interaction.editReply({
            content: `A 3D model was already generated from this image: \`${generatedImage.modelGeneratedModelId}\``
          });
          return;
        }
        if (input.pendingImageModelGenerations.has(generatedImage.id)) {
          await interaction.editReply({
            content: "A 3D model is already being generated from this image."
          });
          return;
        }
        input.pendingImageModelGenerations.add(generatedImage.id);
        await interaction.editReply({
          content: `I generate a 3D model now from image: \`${generatedImage.imageFileName}\``
        });
        const imageFile = await input.readGeneratedImageFile(generatedImage.id, generatedImage.imageFileName);
        const imageInput = input.buildImageDataUrl({
          bytes: imageFile.data,
          contentType: imageFile.contentType
        });
        const prompt = await input.resolveModelPrompt({
          prompt: generatedImage.prompt?.trim() || "",
          autoPrompt: false,
          llmConnectionSettings: input.resolveModel3dLlmConnectionSettingsFromState()
        });
        const generatedModel = input.toGeneratedModelPublicRecord(await input.generate3dModelWithExecution({
          imageInput,
          imageFileNameHint: generatedImage.imageFileName,
          prompt,
          stripMetadata: false
        }, input.getGlobalSettings().model3dGenerationTarget));
        const metadataExecutionTarget = input.getGlobalSettings().model3dMetadataTarget;
        let finalGeneratedModel = generatedModel;
        try {
          const metadataPrompt = prompt.trim() || "Generate a concise file name and one short Discord description for this source image.";
          const suggestion = metadataExecutionTarget === "remote"
            ? await input.suggestModelMetadataViaRemoteWorker({
              prompt: metadataPrompt,
              imageInput,
              preferVisualModel: input.getGlobalSettings().ollamaTextModelIsVisual
            })
            : await input.suggestModelFileNameAndDescription({
              prompt: metadataPrompt,
              sourceImageInput: imageInput,
              preferVisualModel: input.getGlobalSettings().ollamaTextModelIsVisual,
              llmConnectionSettings: input.resolveModel3dLlmConnectionSettingsFromState()
            });
          if (suggestion.fileName) {
            finalGeneratedModel = await input.renameGeneratedModelFileName(generatedModel.id, suggestion.fileName);
          }
        } catch (error) {
          console.warn("Failed to rename 3D model generated from image action. Continuing with original file name.", error);
        }
        const updatedImage = input.toGeneratedImagePublicRecord(await input.markGeneratedImageModelResult(generatedImage.id, finalGeneratedModel.id));
        try {
          await interaction.message.edit({
            components: input.buildGeneratedImageComponents(updatedImage, parsed.requesterId)
          });
        } catch (error) {
          console.warn("Failed to disable image action button after 3D generation.", error);
        }
        const modelOptions = input.normalizeModelPostOptions(undefined);
        input.recordAction("image-action:generate-3d", `${interaction.user.tag} generated 3D model ${finalGeneratedModel.id} from image ${generatedImage.id}.`);
        await interaction.editReply({
          content: input.buildModelReadyContent(),
          embeds: [input.buildGeneratedModelEmbed(finalGeneratedModel)],
          files: await input.buildGeneratedModelAttachments(finalGeneratedModel, "detailed", modelOptions),
          components: input.buildGeneratedModelComponents(finalGeneratedModel, "detailed", modelOptions)
        });
        input.pendingImageModelGenerations.delete(generatedImage.id);
        return;
      }
      const basePrompt = generatedImage.prompt?.trim() || "";
      const generatedPrompt = matchedPrefix === input.imageNewPromptPrefix
        ? await input.resolveImagePrompt({
          prompt: basePrompt,
          autoPrompt: true,
          llmConnectionSettings: input.resolveImageLlmConnectionSettingsFromState()
        })
        : (basePrompt || await input.resolveImagePrompt({
          prompt: "",
          autoPrompt: true,
          llmConnectionSettings: input.resolveImageLlmConnectionSettingsFromState()
        }));
      await interaction.editReply({
        content: matchedPrefix === input.imageNewPromptPrefix
          ? `I generate a new image now with an LLM-created prompt: \`${generatedPrompt}\``
          : `I generate a new image now with this prompt: \`${generatedPrompt}\``
      });
      const generated = input.toGeneratedImagePublicRecord(await input.generateImageWithExecution({
        prompt: generatedPrompt
      }));
      input.recordAction(
        matchedPrefix === input.imageNewPromptPrefix ? "image-action:new-prompt" : "image-action:new",
        `${interaction.user.tag} generated image ${generated.id} from ${matchedPrefix === input.imageNewPromptPrefix ? "LLM prompt" : "same prompt"}: ${input.summarizeText(generatedPrompt)}`
      );
      await interaction.editReply({
        content: "Your image is ready!",
        embeds: [input.buildGeneratedImageEmbed(generated)],
        files: [await input.buildGeneratedImageAttachment(generated)],
        components: input.buildGeneratedImageComponents(generated, interaction.user.id)
      });
    } catch (error) {
      input.pendingImageModelGenerations.delete(generatedImage.id);
      const errorDetail = error instanceof Error ? error.message : String(error);
      input.recordAction("image-action:error", `${interaction.user.tag} failed image action on ${generatedImage.id}: ${errorDetail || "unknown error"}`);
      await interaction.editReply({
        content: [
          "Something went wrong while handling that image action.",
          errorDetail ? `\nError detail:\n\`\`\`\n${errorDetail.slice(0, 1500)}\n\`\`\`` : ""
        ].join("")
      });
    }
  }

  async function handleAddToPoolButton(interaction: ButtonInteraction): Promise<void> {
    const parsed = input.parseImageAddToPoolButtonCustomId(interaction.customId);
    if (!parsed) {
      await interaction.reply({
        content: "This image action payload is invalid.",
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    const generated = await input.getGeneratedImagePublicById(parsed.imageId);
    if (!generated) {
      await interaction.reply({
        content: "Generated image entry was not found.",
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    const imageSource = await (async () => {
      const resolvedGeneratedPath = await input.resolveGeneratedImageApiSourceToFilePath(generated.imageUrl).catch(() => null);
      if (resolvedGeneratedPath) {
        return resolvedGeneratedPath;
      }
      return interaction.message.attachments.first()?.url?.trim() || generated.imageUrl;
    })();
    if (!imageSource) {
      await interaction.reply({
        content: "Could not resolve an image source for this message.",
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    const actingMember = interaction.member instanceof GuildMember ? interaction.member : null;
    if (!(await input.canUseVerifiedImagePools(actingMember))) {
      try {
        const result = await input.addImageSourceToUserUnverifiedPool({
          userId: interaction.user.id,
          username: interaction.user.username,
          displayName: actingMember?.displayName,
          imageSource
        });
        input.recordAction("slash:/image-add-to-unverified-pool", `${interaction.user.tag} -> ${result.pool.name} (${result.added ? "added" : "already present"})`);
        await interaction.reply({
          content: result.added
            ? `Added image to your temp pool **${result.pool.name}**. Total images: **${result.pool.images.length}**.${result.created ? " Created a new temp pool for you." : ""}`
            : `Image was already in your temp pool **${result.pool.name}**. Total images: **${result.pool.images.length}**.`,
          flags: MessageFlags.Ephemeral
        });
      } catch (error) {
        await interaction.reply({
          content: error instanceof Error ? error.message : "Failed to add image to your temp pool.",
          flags: MessageFlags.Ephemeral
        });
      }
      return;
    }
    const pools = await input.listImagePools();
    if (pools.length === 0) {
      await interaction.reply({
        content: "No image pools exist yet. Create one in Image Studio first.",
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    const selectionId = input.rememberPendingImagePoolSelection({
      createdAt: new Date().toISOString(),
      requesterId: interaction.user.id,
      imageId: parsed.imageId,
      imageSource
    });
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`${input.imageAddToPoolSelectPrefix}${selectionId}`)
      .setPlaceholder("Choose image pool")
      .addOptions(pools.slice(0, 25).map(pool => ({
        label: input.trimSelectLabel(pool.name, `Pool ${pool.id.slice(0, 6)}`),
        description: input.trimSelectLabel(`${pool.images.length} image${pool.images.length === 1 ? "" : "s"}`, "Image pool"),
        value: pool.id
      })));
    await interaction.reply({
      content: "Pick the pool for this generated image:",
      components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu)],
      flags: MessageFlags.Ephemeral
    });
  }

  async function handleAddToPoolSelect(interaction: StringSelectMenuInteraction): Promise<void> {
    const selectionId = interaction.customId.slice(input.imageAddToPoolSelectPrefix.length).trim();
    const pendingSelection = input.pendingImagePoolSelections.get(selectionId) ?? null;
    if (!pendingSelection) {
      await interaction.update({
        content: "This image pool picker expired. Click `Add To Pool` again on the image message.",
        components: []
      });
      return;
    }
    const actingMember = interaction.member instanceof GuildMember ? interaction.member : null;
    if (!(await input.canUseVerifiedImagePools(actingMember))) {
      await interaction.reply({
        content: "Only protected members can add generated images to shared pools.",
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    if (interaction.user.id !== pendingSelection.requesterId && !input.isProtectedGuildMember(actingMember)) {
      await interaction.reply({
        content: "Only the person who opened this pool picker or a protected member can finish this pool action.",
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    const selectedPoolId = interaction.values[0]?.trim() ?? "";
    if (!selectedPoolId) {
      await interaction.update({
        content: "No image pool was selected.",
        components: []
      });
      return;
    }
    try {
      const result = await input.addImageSourceToPool({
        poolId: selectedPoolId,
        imageSource: pendingSelection.imageSource
      });
      input.pendingImagePoolSelections.delete(selectionId);
      input.recordAction("slash:/image-add-to-pool", `${interaction.user.tag} -> ${result.pool.name} (${result.added ? "added" : "already present"})`);
      await interaction.update({
        content: result.added
          ? `Added image to pool **${result.pool.name}**. Total images: **${result.pool.images.length}**.`
          : `Image was already in pool **${result.pool.name}**. Total images: **${result.pool.images.length}**.`,
        components: []
      });
    } catch (error) {
      await interaction.update({
        content: error instanceof Error ? error.message : "Failed to add image to pool.",
        components: []
      });
    }
  }

  return {
    handleImageActionButton,
    handleAddToPoolButton,
    handleAddToPoolSelect
  };
}
