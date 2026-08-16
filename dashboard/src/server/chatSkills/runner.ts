import { readFile } from "node:fs/promises";
import path from "node:path";
import { comfyWorkflowPaths } from "../../shared/comfyWorkflowPaths.js";
import type { DashboardDependencies } from "../runtime/botBridge.js";
import {
  buildChatSkillInputsFromArtifacts,
  buildSingleImageBatchPrompt,
  getImageTransformPrompt,
  parseBase64DataUrl,
  resolveStandaloneImagePrompts,
  resolveStandaloneModelSourcePrompts
} from "./executionHelpers.js";
import type { ChatSkillArtifact, ChatSkillModelUpload, ChatSkillPlanEvent } from "./types.js";
import { normalizeChatSkillId } from "./types.js";
import { resolveRemoveBackgroundWorkflowPath } from "../messagingAndModel/helpers.js";
import { loadLocalToolsFromDisk, resolveToolsRootDirectory } from "./catalog.js";

interface ExecuteChatSkillChainInput {
  skillIds: string[];
  prompt: string;
  images: string[];
  imageFileNames: string[];
  models: ChatSkillModelUpload[];
  dependencies: DashboardDependencies;
  imageCountOverride?: number | null;
  onArtifact?: (artifact: ChatSkillArtifact) => void;
  onPlan?: (plan: ChatSkillPlanEvent) => void;
  onProgressMessage?: (message: string) => void;
  onSkillStart?: (skillId: string) => void;
  stripChatSkillCommandPrefix: (prompt: string) => string;
  resolveWorkspaceRelativePath: (relativePath: string) => Promise<string | null>;
}

interface ExecuteBuiltInChatSkillInput {
  skillId: string;
  prompt: string;
  images: string[];
  imageFileNames: string[];
  models: ChatSkillModelUpload[];
  nextSkillIds?: string[];
  dependencies: DashboardDependencies;
  imageCountOverride?: number | null;
  onArtifact?: (artifact: ChatSkillArtifact) => void;
  onPlan?: (plan: ChatSkillPlanEvent) => void;
  onProgressMessage?: (message: string) => void;
  stripChatSkillCommandPrefix: (prompt: string) => string;
  resolveWorkspaceRelativePath: (relativePath: string) => Promise<string | null>;
}

function extractToolChoiceJson(value: string): { toolId: string; } {
  try {
    const raw = String(value || "").trim();
    const source = raw.slice(Math.max(0, raw.indexOf("{")), raw.lastIndexOf("}") + 1);
    const parsed = JSON.parse(source || raw) as Record<string, unknown>;
    return { toolId: String(parsed.toolId || parsed.id || "").trim().toLowerCase() };
  } catch {
    return { toolId: "" };
  }
}

async function readToolReadmeForPrompt(input: ExecuteBuiltInChatSkillInput): Promise<{ toolTitle: string; toolId: string; readme: string; }> {
  const tools = await loadLocalToolsFromDisk();
  const catalog = tools.map(tool => `${tool.id}: ${tool.title} (${tool.categoryLabel}/${tool.toolSlug}) - ${tool.description}`).join("\n");
  const answer = await input.dependencies.askModel([
    "Select the one local URage NOW tool whose README the user wants to read.",
    "Return only compact JSON: {\"toolId\":\"category__tool-slug\"}",
    "Use an empty toolId when no tool matches.",
    "Available tools:",
    catalog || "(none)",
    "User request:",
    input.prompt
  ].join("\n"));
  const choice = extractToolChoiceJson(answer);
  const tool = tools.find(entry => entry.id.toLowerCase() === choice.toolId) || null;
  if (!tool) {
    throw new Error("No matching local tool README was found.");
  }
  const toolsRoot = await resolveToolsRootDirectory();
  if (!toolsRoot) {
    throw new Error("Tools directory was not found.");
  }
  const root = path.resolve(toolsRoot);
  const readmePath = path.resolve(root, tool.category, tool.toolSlug, "README.md");
  const relative = path.relative(root, readmePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Resolved README path is outside the tools directory.");
  }
  const readme = await readFile(readmePath, "utf8");
  return { toolTitle: tool.title, toolId: tool.id, readme };
}

export async function executeChatSkillChain(input: ExecuteChatSkillChainInput): Promise<{ handled: boolean; response: string; artifacts: ChatSkillArtifact[]; executedSkillIds: string[] }> {
  const chain = input.skillIds.map(skillId => normalizeChatSkillId(skillId)).filter(Boolean);
  if (chain.length === 0) {
    return { handled: false, response: "", artifacts: [], executedSkillIds: [] };
  }
  let currentImages = input.images.slice();
  let currentImageFileNames = input.imageFileNames.slice();
  let currentModels = input.models.slice();
  const allArtifacts: ChatSkillArtifact[] = [];
  const responseParts: string[] = [];
  const executedSkillIds: string[] = [];
  for (let index = 0; index < chain.length; index += 1) {
    const skillId = chain[index] || "";
    if (!skillId) {
      continue;
    }
    input.onSkillStart?.(skillId);
    const execution = await executeBuiltInChatSkill({
      skillId,
      prompt: input.prompt,
      images: currentImages,
      imageFileNames: currentImageFileNames,
      models: currentModels,
      nextSkillIds: chain.slice(index + 1),
      dependencies: input.dependencies,
      imageCountOverride: index === 0 ? input.imageCountOverride : null,
      onArtifact: input.onArtifact,
      onPlan: input.onPlan,
      onProgressMessage: input.onProgressMessage,
      stripChatSkillCommandPrefix: input.stripChatSkillCommandPrefix,
      resolveWorkspaceRelativePath: input.resolveWorkspaceRelativePath
    });
    if (!execution.handled) {
      return { handled: false, response: "", artifacts: allArtifacts, executedSkillIds };
    }
    executedSkillIds.push(skillId);
    allArtifacts.push(...execution.artifacts);
    responseParts.push(execution.response);
    if (index >= chain.length - 1) {
      continue;
    }
    const nextInputs = await buildChatSkillInputsFromArtifacts(execution.artifacts, input.dependencies);
    currentImages = nextInputs.images;
    currentImageFileNames = nextInputs.imageFileNames;
    currentModels = nextInputs.models;
  }
  return {
    handled: true,
    response: responseParts.join("\n\n"),
    artifacts: allArtifacts,
    executedSkillIds
  };
}

export async function executeBuiltInChatSkill(input: ExecuteBuiltInChatSkillInput): Promise<{ handled: boolean; response: string; artifacts: ChatSkillArtifact[] }> {
  const normalizedSkillId = normalizeChatSkillId(input.skillId);
  const cleanedPrompt = input.stripChatSkillCommandPrefix(input.prompt);
  if (normalizedSkillId === "read-tool-readme") {
    const result = await readToolReadmeForPrompt(input);
    return {
      handled: true,
      response: `README for **${result.toolTitle}** (\`${result.toolId}\`):\n\n${result.readme}`,
      artifacts: []
    };
  }
  if (normalizedSkillId === "create-pixel-art") {
    if (!input.images[0]) {
      throw new Error("create-pixel-art skill needs an uploaded image.");
    }
    return {
      handled: true,
      response: "Starting local pixel art conversion with skill **create-pixel-art**...",
      artifacts: []
    };
  }
  if (normalizedSkillId === "generate-image") {
    const primaryImage = input.images[0] || "";
    const primaryImageName = input.imageFileNames[0] || "";
    const count = Math.max(1, Math.min(8, input.imageCountOverride || 1));
    const sourcePrompt = cleanedPrompt;
    const generatedImages = [];
    const artifacts: Array<Extract<ChatSkillArtifact, { kind: "image" }>> = [];
    const sourcePromptPlan = !primaryImage && input.nextSkillIds?.includes("generate-model") && sourcePrompt
      ? await resolveStandaloneModelSourcePrompts({
        prompt: sourcePrompt,
        count,
        askModel: input.dependencies.askModel
      })
      : null;
    const standaloneImagePrompts = sourcePromptPlan || (sourcePrompt
      ? await resolveStandaloneImagePrompts({
        prompt: sourcePrompt,
        count,
        askModel: input.dependencies.askModel
      })
      : []);
    if (standaloneImagePrompts.length > 0) {
      standaloneImagePrompts.forEach((prompt, index) => {
        input.onPlan?.({
          kind: "image-prompt",
          skillId: normalizedSkillId,
          title: sourcePromptPlan ? "Source image prompt ready" : "Image prompt ready",
          prompt,
          index: index + 1,
          total: standaloneImagePrompts.length
        });
      });
      input.onProgressMessage?.("Starting image generation...");
    }
    for (let index = 0; index < count; index += 1) {
      const singleImagePrompt = sourcePromptPlan?.[index]
        || standaloneImagePrompts[index]
        || (sourcePrompt ? buildSingleImageBatchPrompt(sourcePrompt, index, count) : undefined);
      input.onProgressMessage?.(`Generating image ${index + 1} of ${count}...`);
      const generated = await input.dependencies.generateImageFromPrompt({
        prompt: singleImagePrompt,
        autoPrompt: !singleImagePrompt,
        imageInput: primaryImage || undefined,
        imageFileNameHint: primaryImageName || undefined,
        requestedBy: "dashboard-chat-skill"
      });
      generatedImages.push(generated);
      const artifact: Extract<ChatSkillArtifact, { kind: "image" }> = {
        kind: "image",
        imageId: generated.id,
        fileName: generated.imageFileName,
        url: `/api/generated-image-file?imageId=${encodeURIComponent(generated.id)}&file=${encodeURIComponent(generated.imageFileName)}`,
        prompt: generated.prompt || singleImagePrompt || sourcePrompt || ""
      };
      artifacts.push(artifact);
      input.onArtifact?.(artifact);
    }
    return {
      handled: true,
      response:
        `${generatedImages.length} image${generatedImages.length === 1 ? "" : "s"} generated with skill **generate-image**.\n\n`
        + artifacts.map((artifact, index) =>
          `${index + 1}. File: \`${artifact.fileName}\`\n`
          + `   Prompt: ${artifact.prompt || "(auto prompt)"}\n`
          + `   URL: ${artifact.url}`
        ).join("\n"),
      artifacts
    };
  }
  if (normalizedSkillId === "generate-model") {
    let sourceImages = input.images;
    let sourceImageFileNames = input.imageFileNames;
    const generatedSourceArtifacts: ChatSkillArtifact[] = [];
    const sourcePrompts: string[] = [];
    if (sourceImages.length === 0) {
      if (!cleanedPrompt) {
        throw new Error("generate-model skill needs an uploaded image or a prompt to create a source image first.");
      }
      const requestedCount = Math.max(1, Math.min(8, input.imageCountOverride || 1));
      const standaloneSourcePrompts = await resolveStandaloneModelSourcePrompts({
        prompt: cleanedPrompt,
        count: requestedCount,
        askModel: input.dependencies.askModel
      });
      standaloneSourcePrompts.forEach((prompt, index) => {
        input.onPlan?.({
          kind: "image-prompt",
          skillId: normalizedSkillId,
          title: "3D source image prompt ready",
          prompt,
          index: index + 1,
          total: standaloneSourcePrompts.length
        });
      });
      sourceImages = [];
      sourceImageFileNames = [];
      for (const sourcePrompt of standaloneSourcePrompts) {
        const sourceImage = await input.dependencies.generateImageFromPrompt({
          prompt: sourcePrompt,
          autoPrompt: false,
          requestedBy: "dashboard-chat-skill-model-source"
        });
        const sourceImageUrl = `/api/generated-image-file?imageId=${encodeURIComponent(sourceImage.id)}&file=${encodeURIComponent(sourceImage.imageFileName)}`;
        const sourceImageFile = await input.dependencies.readGeneratedImageFile(sourceImage.id, sourceImage.imageFileName);
        const sourceImageMimeType = String(sourceImageFile.contentType || "image/png").trim() || "image/png";
        const sourceImageDataUrl = `data:${sourceImageMimeType};base64,${sourceImageFile.data.toString("base64")}`;
        sourceImages.push(sourceImageDataUrl);
        sourceImageFileNames.push(sourceImage.imageFileName);
        sourcePrompts.push(sourcePrompt);
        const sourceArtifact: ChatSkillArtifact = {
          kind: "image",
          imageId: sourceImage.id,
          fileName: sourceImage.imageFileName,
          url: sourceImageUrl,
          prompt: sourceImage.prompt || sourcePrompt || cleanedPrompt
        };
        generatedSourceArtifacts.push(sourceArtifact);
        input.onArtifact?.(sourceArtifact);
      }
    } else {
      sourcePrompts.push(...sourceImages.map(() => cleanedPrompt || ""));
    }
    const generatedModels = [];
    const modelArtifacts: Array<Extract<ChatSkillArtifact, { kind: "model" }>> = [];
    for (let index = 0; index < sourceImages.length; index += 1) {
      const imageInput = sourceImages[index] || "";
      const imageFileName = sourceImageFileNames[index] || "";
      const modelPrompt = sourcePrompts[index] || cleanedPrompt || undefined;
      if (modelPrompt) {
        input.onPlan?.({
          kind: "model-prompt",
          skillId: normalizedSkillId,
          title: "3D model prompt ready",
          prompt: modelPrompt,
          index: index + 1,
          total: sourceImages.length
        });
      }
      input.onProgressMessage?.(`Generating 3D model ${index + 1} of ${sourceImages.length}...`);
      const generated = await input.dependencies.generate3dModelFromImage({
        imageInput,
        imageFileNameHint: imageFileName || undefined,
        prompt: modelPrompt,
        autoPrompt: !modelPrompt,
        useLlmMetadata: true,
        useLlmModelFileName: true,
        useLlmModelDescription: true,
        metadataTiming: "after",
        requestedBy: "dashboard-chat-skill"
      });
      generatedModels.push(generated);
      const modelArtifact: Extract<ChatSkillArtifact, { kind: "model" }> = {
        kind: "model",
        modelId: generated.id,
        fileName: generated.modelFileName,
        url: `/api/model3d-file?modelId=${encodeURIComponent(generated.id)}&file=${encodeURIComponent(generated.modelFileName)}`,
        prompt: generated.prompt || modelPrompt || "",
        lowPoly: false,
        previewUrl: generated.previewGifUrl ?? generated.previewImageUrl ?? "",
        targetFaceCount: generated.lowPolyTargetFaceCount ?? generated.targetFaceCount ?? null
      };
      modelArtifacts.push(modelArtifact);
      input.onArtifact?.(modelArtifact);
    }
    const artifacts = generatedSourceArtifacts.concat(modelArtifacts);
    return {
      handled: true,
      response:
        `${generatedSourceArtifacts.length > 0 ? "Generated a source image first, then created " : ""}${generatedModels.length} 3D model${generatedModels.length === 1 ? "" : "s"} with skill **generate-model**.\n\n`
        + modelArtifacts.map((artifact, index) =>
          `${index + 1}. Model file: \`${artifact.fileName}\`\n`
          + `   Prompt: ${artifact.prompt || "(none)"}\n`
          + `   Model ID: \`${artifact.modelId}\``
        ).join("\n"),
      artifacts
    };
  }
  if (normalizedSkillId === "generate-autorig") {
    if (input.models.length === 0) {
      throw new Error("generate-autorig skill needs a generated 3D model first.");
    }
    const autorigArtifacts: Array<Extract<ChatSkillArtifact, { kind: "model" }>> = [];
    const responseLines: string[] = [];
    for (const [index, model] of input.models.entries()) {
      const modelId = String(model.modelId || "").trim();
      if (!modelId) {
        throw new Error(`AutoRig needs a generated model id for ${model.fileName || `item ${index + 1}`}. Use generate-model first or select a generated model from history.`);
      }
      input.onProgressMessage?.(`Generating Rigify AutoRig ${index + 1} of ${input.models.length}...`);
      const generated = await input.dependencies.applyAutoRigToModel({
        modelId,
        rigProfile: "auto",
        useVision: true,
        landmarks: null
      });
      const artifact: Extract<ChatSkillArtifact, { kind: "model" }> = {
        kind: "model",
        modelId: generated.id,
        fileName: generated.modelFileName,
        url: `/api/model3d-file?modelId=${encodeURIComponent(generated.id)}&file=${encodeURIComponent(generated.modelFileName)}`,
        prompt: cleanedPrompt || "",
        lowPoly: false,
        previewUrl: generated.previewGifUrl ?? generated.previewImageUrl ?? "",
        targetFaceCount: generated.lowPolyTargetFaceCount ?? generated.targetFaceCount ?? null
      };
      autorigArtifacts.push(artifact);
      input.onArtifact?.(artifact);
      responseLines.push(
        `${index + 1}. Source: \`${model.fileName || modelId}\`\n`
        + `   Rigged model file: \`${artifact.fileName}\`\n`
        + `   Model ID: \`${artifact.modelId}\``
      );
    }
    return {
      handled: true,
      response:
        `AutoRig model${autorigArtifacts.length === 1 ? "" : "s"} generated with skill **generate-autorig**.\n\n`
        + responseLines.join("\n"),
      artifacts: autorigArtifacts
    };
  }
  if (normalizedSkillId === "generate-lowpoly") {
    if (input.models.length === 0) {
      throw new Error("generate-lowpoly skill needs an uploaded 3D model first.");
    }
    const lowPolyArtifacts: Array<Extract<ChatSkillArtifact, { kind: "model" }>> = [];
    const responseLines: string[] = [];
    for (const [index, uploadedModel] of input.models.entries()) {
      const parsedUpload = parseBase64DataUrl(uploadedModel.dataUrl);
      if (!parsedUpload) {
        throw new Error(`Uploaded model payload is invalid for ${uploadedModel.fileName || `item ${index + 1}`}.`);
      }
      const fileData = Buffer.from(parsedUpload.base64Data, "base64");
      if (!fileData.length) {
        throw new Error(`Uploaded model payload is empty for ${uploadedModel.fileName || `item ${index + 1}`}.`);
      }
      const generated = await input.dependencies.generateLowPolyFromUploadedModel({
        fileName: uploadedModel.fileName || "uploaded-model.glb",
        fileData,
        contentType: parsedUpload.mimeType,
        useLlmTargetFaces: true,
        prompt: cleanedPrompt || undefined,
        context: uploadedModel.fileName || undefined
      });
      const lowPolyFileName = generated.generated.lowPolyModelFileName || generated.generated.modelFileName;
      const lowPolyArtifact: Extract<ChatSkillArtifact, { kind: "model" }> = {
        kind: "model",
        modelId: generated.generated.id,
        fileName: lowPolyFileName,
        url: `/api/model3d-file?modelId=${encodeURIComponent(generated.generated.id)}&file=${encodeURIComponent(lowPolyFileName)}`,
        prompt: cleanedPrompt || "",
        lowPoly: true,
        previewUrl: generated.generated.lowPolyPreviewGifUrl ?? generated.generated.lowPolyPreviewImageUrl ?? generated.generated.previewGifUrl ?? generated.generated.previewImageUrl ?? "",
        targetFaceCount: generated.targetFaceCount
      };
      lowPolyArtifacts.push(lowPolyArtifact);
      input.onArtifact?.(lowPolyArtifact);
      responseLines.push(
        `${index + 1}. Source: \`${uploadedModel.fileName || "uploaded-model.glb"}\`\n`
        + `   Model file: \`${lowPolyFileName}\`\n`
        + `   Target faces: ${generated.targetFaceCount}\n`
        + `   Model ID: \`${generated.generated.id}\``
      );
    }
    return {
      handled: true,
      response:
        `Low poly model${lowPolyArtifacts.length === 1 ? "" : "s"} generated with skill **generate-lowpoly**.\n\n`
        + responseLines.join("\n"),
      artifacts: lowPolyArtifacts
    };
  }
  if (normalizedSkillId === "remove-background" || normalizedSkillId === "delight-image" || normalizedSkillId === "create-normal-map") {
    const sourceImage = input.images[0] || "";
    const sourceImageName = input.imageFileNames[0] || "";
    if (!sourceImage) {
      throw new Error(`${normalizedSkillId} skill needs an uploaded image.`);
    }
    const removeBackgroundWorkflow = normalizedSkillId === "remove-background"
      ? await resolveRemoveBackgroundWorkflowPath(resolveRemoveBackgroundWorkflowMode())
      : null;
    const delightWorkflowPath = normalizedSkillId === "delight-image"
      ? await input.resolveWorkspaceRelativePath(comfyWorkflowPaths.image.delight)
      : null;
    if (normalizedSkillId === "delight-image" && !delightWorkflowPath) {
      throw new Error(`Delight workflow is missing at ${comfyWorkflowPaths.image.delight}.`);
    }
    const generated = await input.dependencies.generateImageFromPrompt({
      prompt: getImageTransformPrompt(
        normalizedSkillId as "remove-background" | "delight-image" | "create-normal-map",
        cleanedPrompt
      ),
      autoPrompt: false,
      autoFileName: false,
      imageInput: sourceImage,
      imageFileNameHint: sourceImageName || undefined,
      workflowPathOverride: delightWorkflowPath || removeBackgroundWorkflow?.workflowPath || undefined,
      skipPromptResolution: normalizedSkillId === "delight-image",
      requestedBy: "dashboard-chat-skill"
    });
    const artifact: ChatSkillArtifact = {
      kind: "image",
      imageId: generated.id,
      fileName: generated.imageFileName,
      url: `/api/generated-image-file?imageId=${encodeURIComponent(generated.id)}&file=${encodeURIComponent(generated.imageFileName)}`,
      prompt: generated.prompt || cleanedPrompt || ""
    };
    input.onArtifact?.(artifact);
    return {
      handled: true,
      response:
        `Image transform completed with skill **${normalizedSkillId}**.\n\n`
        + `File: \`${artifact.fileName}\`\n`
        + `Image ID: \`${artifact.imageId}\``,
      artifacts: [artifact]
    };
  }
  if (normalizedSkillId === "generate-video") {
    if (!cleanedPrompt) {
      throw new Error("generate-video skill needs a prompt.");
    }
    const generated = await input.dependencies.generateVideoFromPrompt({
      prompt: cleanedPrompt,
      seconds: 6,
      requestedBy: "dashboard-chat-skill"
    });
    const artifact: ChatSkillArtifact = {
      kind: "video",
      videoId: generated.id,
      fileName: generated.videoFileName,
      url: `/api/generated-video-file?videoId=${encodeURIComponent(generated.id)}&file=${encodeURIComponent(generated.videoFileName)}`,
      prompt: generated.prompt || cleanedPrompt
    };
    input.onArtifact?.(artifact);
    return {
      handled: true,
      response:
        `Video generated with skill **generate-video**.\n\n`
        + `File: \`${artifact.fileName}\`\n`
        + `Video ID: \`${artifact.videoId}\``,
      artifacts: [artifact]
    };
  }
  if (normalizedSkillId === "generate-audio") {
    if (!cleanedPrompt) {
      throw new Error("generate-audio skill needs a prompt.");
    }
    const generated = await input.dependencies.generateAudioFromPrompt({
      prompt: cleanedPrompt,
      seconds: 15,
      requestedBy: "dashboard-chat-skill"
    });
    const artifact: ChatSkillArtifact = {
      kind: "audio",
      audioId: generated.id,
      fileName: generated.audioFileName,
      url: `/api/generated-audio-file?audioId=${encodeURIComponent(generated.id)}&file=${encodeURIComponent(generated.audioFileName)}`,
      prompt: generated.prompt || cleanedPrompt,
      isMusic: false
    };
    input.onArtifact?.(artifact);
    return {
      handled: true,
      response:
        `Audio generated with skill **generate-audio**.\n\n`
        + `File: \`${artifact.fileName}\`\n`
        + `Audio ID: \`${artifact.audioId}\``,
      artifacts: [artifact]
    };
  }
  if (normalizedSkillId === "generate-music") {
    const generated = await input.dependencies.generateMusicFromPrompt({
      seconds: 30,
      lyrics: cleanedPrompt || undefined,
      requestedBy: "dashboard-chat-skill"
    });
    const artifact: ChatSkillArtifact = {
      kind: "audio",
      audioId: generated.id,
      fileName: generated.audioFileName,
      url: `/api/generated-audio-file?audioId=${encodeURIComponent(generated.id)}&file=${encodeURIComponent(generated.audioFileName)}`,
      prompt: cleanedPrompt,
      isMusic: true
    };
    input.onArtifact?.(artifact);
    return {
      handled: true,
      response:
        `Music generated with skill **generate-music**.\n\n`
        + `File: \`${artifact.fileName}\`\n`
        + `Audio ID: \`${artifact.audioId}\``,
      artifacts: [artifact]
    };
  }
  if (normalizedSkillId === "regenerate-image-filename") {
    const generatedImages = await input.dependencies.listGeneratedImages();
    const imageRecord = generatedImages[0] || null;
    if (!imageRecord) {
      throw new Error("No generated image found to rename.");
    }
    const renamed = await input.dependencies.regenerateGeneratedImageFileName({
      imageId: imageRecord.id,
      prompt: cleanedPrompt || undefined
    });
    const artifact: ChatSkillArtifact = {
      kind: "image",
      imageId: renamed.id,
      fileName: renamed.imageFileName,
      url: `/api/generated-image-file?imageId=${encodeURIComponent(renamed.id)}&file=${encodeURIComponent(renamed.imageFileName)}`,
      prompt: renamed.prompt || cleanedPrompt || ""
    };
    input.onArtifact?.(artifact);
    return {
      handled: true,
      response:
        `Image filename regenerated with skill **regenerate-image-filename**.\n\n`
        + `File: \`${artifact.fileName}\`\n`
        + `Image ID: \`${artifact.imageId}\``,
      artifacts: [artifact]
    };
  }
  if (normalizedSkillId === "regenerate-model-filename") {
    const generatedModels = await input.dependencies.listGeneratedModels();
    const modelRecord = generatedModels[0] || null;
    if (!modelRecord) {
      throw new Error("No generated model found to rename.");
    }
    const renamed = await input.dependencies.regenerateGeneratedModelFileName({
      modelId: modelRecord.id,
      prompt: cleanedPrompt || undefined
    });
    const modelArtifact: ChatSkillArtifact = {
      kind: "model",
      modelId: renamed.id,
      fileName: renamed.modelFileName,
      url: `/api/model3d-file?modelId=${encodeURIComponent(renamed.id)}&file=${encodeURIComponent(renamed.modelFileName)}`,
      prompt: renamed.prompt || cleanedPrompt || "",
      lowPoly: false,
      previewUrl: renamed.previewGifUrl ?? renamed.previewImageUrl ?? "",
      targetFaceCount: renamed.lowPolyTargetFaceCount ?? renamed.targetFaceCount ?? null
    };
    input.onArtifact?.(modelArtifact);
    return {
      handled: true,
      response:
        `Model filename regenerated with skill **regenerate-model-filename**.\n\n`
        + `Model file: \`${modelArtifact.fileName}\`\n`
        + `Model ID: \`${modelArtifact.modelId}\``,
      artifacts: [modelArtifact]
    };
  }
  if (normalizedSkillId === "suggest-model-metadata") {
    const sourceImage = input.images[0] || "";
    const suggestion = await input.dependencies.suggestModelMetadata({
      prompt: cleanedPrompt || undefined,
      imageInput: sourceImage || undefined,
      preferVisualModel: Boolean(sourceImage),
      executionTarget: "local"
    });
    return {
      handled: true,
      response:
        `Model metadata suggestion with skill **suggest-model-metadata**.\n\n`
        + `Suggested file name: ${suggestion.fileName || "(none)"}\n`
        + `Suggested description: ${suggestion.description || "(none)"}`,
      artifacts: []
    };
  }
  if (normalizedSkillId === "suggest-lowpoly-target") {
    const sourceImage = input.images[0] || "";
    const suggestion = await input.dependencies.suggestLowPolyTargetFaceCount({
      prompt: cleanedPrompt || undefined,
      imageInput: sourceImage || undefined,
      context: cleanedPrompt || undefined,
      preferVisualModel: Boolean(sourceImage),
      executionTarget: "local"
    });
    return {
      handled: true,
      response:
        `Low poly target suggestion with skill **suggest-lowpoly-target**.\n\n`
        + `Target faces: ${suggestion.targetFaceCount}\n`
        + `Size tier: ${suggestion.sizeTier}\n`
        + `Complexity: ${suggestion.complexity}\n`
        + `Reason: ${suggestion.reason}`,
      artifacts: []
    };
  }
  if (normalizedSkillId === "comfy-free-memory") {
    const unloadModels = true;
    const freeMemory = true;
    await input.dependencies.freeComfyUiMemory({ unloadModels, freeMemory });
    return {
      handled: true,
      response:
        `ComfyUI cleanup completed with skill **comfy-free-memory**.\n\n`
        + `Unload models: ${unloadModels ? "yes" : "no"}\n`
        + `Free memory: ${freeMemory ? "yes" : "no"}`,
      artifacts: []
    };
  }
  return { handled: false, response: "", artifacts: [] };
}

function resolveRemoveBackgroundWorkflowMode(): "source" | "lora" | "lora-crop" {
  return "source";
}
