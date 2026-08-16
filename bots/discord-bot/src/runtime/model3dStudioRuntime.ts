import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Buffer } from "node:buffer";
import type { GeneratedModelPublicRecord } from "@urage/server/services/model3d";
import type { ModelRealWorldHeightDecision } from "@urage/server/services/model3d/modelRealWorldHeightDecision";

type Model3dStudioRuntimeInput = {
  getGlobalSettings: () => {
    model3dGenerationTarget: "local" | "remote";
    model3dMetadataTarget: "local" | "remote";
    ollamaTextModelIsVisual?: boolean;
  };
  remoteWorkerBaseUrl: string;
  resolveGeneratedModelFilePath: (modelId: string, fileName: string) => Promise<string>;
  runModelPreviewRender: (input: { sourceModelPath: string; outputImagePath: string; }) => Promise<any>;
  setGeneratedModelPreviewImage: (modelId: string, previewBytes: Buffer, previewFileName: string) => Promise<{ id: string; previewImageFileName?: string | null; }>;
  buildImageDataUrl: (input: { bytes: Buffer; contentType: string; }) => string;
  contentTypeFromImageFileExtension: (fileName: string) => string;
  importUploadedSourceModel: (input: {
    fileName: string;
    fileData: Buffer;
    contentType?: string;
    prompt?: string;
  }) => Promise<{ id: string; modelFileName: string; }>;
  generateLowPolyFromUploadedModelViaRemoteWorker: (input: {
    fileName: string;
    fileData: Buffer;
    contentType?: string;
    useLlmTargetFaces?: boolean;
    targetFaceCount?: number;
    prompt?: string;
    context?: string;
    renameLowPolyModelWithLlm?: boolean;
  }) => Promise<{
    generated: GeneratedModelPublicRecord;
    targetFaceCount: number;
    suggestionReason: string | null;
    usedLlmTargetFaces: boolean;
    decisionPreviewModelId: string | null;
    decisionPreviewImageFileName: string | null;
    renamedLowPolyFileName: string | null;
  }>;
  suggestModelFileNameAndDescription: (input: {
    prompt: string;
    sourceImageInput?: string;
    preferVisualModel?: boolean;
    llmConnectionSettings: any;
  }) => Promise<{ fileName?: string | null; }>;
  normalizeModelNameCandidate: (value: string | null | undefined) => string | null;
  renameGeneratedLowPolyModelFileName: (modelId: string, suggestedName: string) => Promise<GeneratedModelPublicRecord>;
  listGeneratedModelsPublic: () => Promise<GeneratedModelPublicRecord[]>;
  ensureVisualInterpretationForImage: (input: {
    imageInput: string;
    promptContext: string;
    extraContext: string;
    llmConnectionSettings: any;
  }) => Promise<any>;
  getCachedVisualInterpretationPromptHint: (imageInput: string) => Promise<string>;
  mergeContentBlocks: (parts: Array<string | null | undefined>) => string | undefined;
  suggestLowPolyByComplexity: (input: {
    promptContext: string;
    sourceImageInput?: string;
    extraContext?: string;
    preferVisualModel?: boolean;
    executionTarget?: "local" | "remote";
  }) => Promise<{ targetFaceCount: number; reason?: string | null; }>;
  generateLowPolyModelWithExecution: (input: {
    modelId: string;
    targetFaceCount: number;
    shouldDecimate: boolean;
  }, executionTarget: "local" | "remote") => Promise<GeneratedModelPublicRecord>;
  suggestModelRealWorldHeightViaRemoteWorker: (input: {
    prompt: string;
    imageInput: string;
    context: string;
    preferVisualModel?: boolean;
  }) => Promise<ModelRealWorldHeightDecision>;
  suggestModelRealWorldHeight: (input: {
    promptContext: string;
    sourceImageInput: string;
    extraContext: string;
    preferVisualModel?: boolean;
    llmConnectionSettings: any;
  }) => Promise<ModelRealWorldHeightDecision>;
  resolveModel3dLlmConnectionSettingsFromState: () => any;
  getGeneratedModelPublicById: (modelId: string) => Promise<GeneratedModelPublicRecord | null>;
  applyModelScaleToHeightWithExecution: (input: {
    modelId: string;
    targetHeightMeters: number;
  }, executionTarget?: "local" | "remote") => Promise<GeneratedModelPublicRecord>;
  applyGeneratedModelMaterialFinish: (input: {
    modelId: string;
    metallicEnabled: boolean | null;
    roughnessValue: number | null;
  }) => Promise<GeneratedModelPublicRecord>;
  applyGeneratedModelAutoRig: (input: any) => Promise<GeneratedModelPublicRecord>;
  previewGeneratedModelAutoRig: (input: any) => Promise<any>;
  defaultLowPolyTargetFaceCount: number;
};

export function createModel3dStudioRuntime(input: Model3dStudioRuntimeInput) {
  async function renderUploadedModelPreviewForLowPolyDecision(modelId: string, modelFileName: string): Promise<{
    sourceImageInput: string;
    previewModelId: string;
    previewImageFileName: string;
  }> {
    const sourceModelPath = await input.resolveGeneratedModelFilePath(modelId, modelFileName);
    const modelDirectory = path.dirname(sourceModelPath);
    const sourceStem = path.basename(modelFileName, path.extname(modelFileName)) || "model";
    const previewFileName = `${sourceStem}_llm_preview.png`;
    const previewPath = path.join(modelDirectory, previewFileName);
    await input.runModelPreviewRender({
      sourceModelPath,
      outputImagePath: previewPath
    });
    const previewBytes = await readFile(previewPath);
    const updated = await input.setGeneratedModelPreviewImage(modelId, previewBytes, previewFileName);
    const resolvedPreviewName = updated.previewImageFileName ?? previewFileName;
    return {
      sourceImageInput: input.buildImageDataUrl({
        bytes: previewBytes,
        contentType: input.contentTypeFromImageFileExtension(resolvedPreviewName)
      }),
      previewModelId: updated.id,
      previewImageFileName: resolvedPreviewName
    };
  }

  async function generateLowPolyForModel(inputArgs: {
    modelId: string;
    useLlmTargetFaces?: boolean;
    targetFaceCount?: number;
    llmMinTargetFaceCount?: number;
    llmMaxTargetFaceCount?: number;
    executionTarget?: "local" | "remote";
    llmDecisionSource?: "input-image" | "model-render";
    prompt?: string;
    context?: string;
  }): Promise<{
    generated: GeneratedModelPublicRecord;
    targetFaceCount: number;
    suggestionReason: string | null;
    usedLlmTargetFaces: boolean;
  }> {
    const modelId = inputArgs.modelId.trim();
    if (!modelId) {
      throw new Error("Model id is required.");
    }
    const generatedModels = await input.listGeneratedModelsPublic();
    const record = generatedModels.find(entry => entry.id === modelId) ?? null;
    if (!record) {
      throw new Error("Generated model was not found.");
    }
    const globalSettings = input.getGlobalSettings();
    const executionTarget = inputArgs.executionTarget ?? globalSettings.model3dGenerationTarget;
    const requestedTargetFaces = typeof inputArgs.targetFaceCount === "number" && Number.isFinite(inputArgs.targetFaceCount)
      ? Math.max(1, Math.round(inputArgs.targetFaceCount))
      : input.defaultLowPolyTargetFaceCount;
    const llmMinTargetFaceCount = typeof inputArgs.llmMinTargetFaceCount === "number" && Number.isFinite(inputArgs.llmMinTargetFaceCount)
      ? Math.max(1, Math.round(inputArgs.llmMinTargetFaceCount))
      : 1;
    const llmMaxTargetFaceCount = typeof inputArgs.llmMaxTargetFaceCount === "number" && Number.isFinite(inputArgs.llmMaxTargetFaceCount)
      ? Math.max(llmMinTargetFaceCount, Math.round(inputArgs.llmMaxTargetFaceCount))
      : Number.MAX_SAFE_INTEGER;
    let targetFaceCount = requestedTargetFaces;
    let suggestionReason: string | null = null;
    if (inputArgs.useLlmTargetFaces === true) {
      let sourceImageInput = "";
      let sourceImageForContext = "";
      const useModelRenderForDecision = inputArgs.llmDecisionSource === "model-render";
      const preferredDecisionImageFileName = useModelRenderForDecision
        ? (record.previewImageFileName || record.sourceImageFileName)
        : record.sourceImageFileName;
      try {
        sourceImageInput = await input.resolveGeneratedModelFilePath(record.id, preferredDecisionImageFileName);
      } catch (error) {
        if (useModelRenderForDecision && record.sourceImageFileName && record.sourceImageFileName !== preferredDecisionImageFileName) {
          try {
            sourceImageInput = await input.resolveGeneratedModelFilePath(record.id, record.sourceImageFileName);
          } catch {
            console.warn("Failed to resolve model render/source image path for studio low poly complexity decision. Falling back to text-only decision.", error);
          }
        } else {
          console.warn("Failed to resolve source image path for studio low poly complexity decision. Falling back to text-only decision.", error);
        }
      }
      if (record.sourceImageFileName) {
        try {
          sourceImageForContext = await input.resolveGeneratedModelFilePath(record.id, record.sourceImageFileName);
        } catch {}
      }
      let decisionContext = inputArgs.context?.trim() || record.modelFileName;
      if (useModelRenderForDecision && sourceImageForContext) {
        await input.ensureVisualInterpretationForImage({
          imageInput: sourceImageForContext,
          promptContext: inputArgs.prompt?.trim() || record.prompt || record.modelFileName,
          extraContext: decisionContext,
          llmConnectionSettings: input.resolveModel3dLlmConnectionSettingsFromState()
        });
        const sourceVisualHint = await input.getCachedVisualInterpretationPromptHint(sourceImageForContext);
        if (sourceVisualHint) {
          decisionContext = input.mergeContentBlocks([
            decisionContext,
            `Cached source-image interpretation: ${sourceVisualHint}`
          ]) || decisionContext;
        }
      }
      try {
        const suggestion = await input.suggestLowPolyByComplexity({
          promptContext: inputArgs.prompt?.trim() || record.prompt || `Generate low poly from model ${record.modelFileName}`,
          sourceImageInput: sourceImageInput || undefined,
          extraContext: decisionContext,
          preferVisualModel: true,
          executionTarget: globalSettings.model3dMetadataTarget
        });
        targetFaceCount = Math.min(llmMaxTargetFaceCount, Math.max(llmMinTargetFaceCount, suggestion.targetFaceCount));
        suggestionReason = suggestion.reason || null;
        if (targetFaceCount !== suggestion.targetFaceCount) {
          suggestionReason = `${suggestionReason ? `${suggestionReason} ` : ""}Constrained to ${llmMinTargetFaceCount}-${llmMaxTargetFaceCount} faces.`;
        }
      } catch (error) {
        console.warn("Failed to suggest low poly target faces in studio flow. Falling back to configured/manual target face count.", error);
      }
    }
    let generated: GeneratedModelPublicRecord;
    try {
      generated = await input.generateLowPolyModelWithExecution({
        modelId: record.id,
        targetFaceCount,
        shouldDecimate: true
      }, executionTarget);
    } catch (error) {
      if (executionTarget !== "remote") {
        throw error;
      }
      console.warn("Remote low poly generation failed for existing model. Falling back to local execution.", error);
      generated = await input.generateLowPolyModelWithExecution({
        modelId: record.id,
        targetFaceCount,
        shouldDecimate: true
      }, "local");
    }
    return {
      generated,
      targetFaceCount,
      suggestionReason,
      usedLlmTargetFaces: inputArgs.useLlmTargetFaces === true
    };
  }

  async function generateLowPolyFromUploadedModel(inputArgs: {
    fileName: string;
    fileData: Buffer;
    contentType?: string;
    useLlmTargetFaces?: boolean;
    targetFaceCount?: number;
    prompt?: string;
    context?: string;
    renameLowPolyModelWithLlm?: boolean;
  }): Promise<{
    generated: GeneratedModelPublicRecord;
    targetFaceCount: number;
    suggestionReason: string | null;
    usedLlmTargetFaces: boolean;
    decisionPreviewModelId: string | null;
    decisionPreviewImageFileName: string | null;
    renamedLowPolyFileName: string | null;
  }> {
    const globalSettings = input.getGlobalSettings();
    const preferredExecutionTarget = globalSettings.model3dGenerationTarget;
    const canUseRemoteWorker = input.remoteWorkerBaseUrl.trim().length > 0;
    const runLocal = async () => {
      const uploadedModel = await input.importUploadedSourceModel({
        fileName: inputArgs.fileName,
        fileData: inputArgs.fileData,
        contentType: inputArgs.contentType,
        prompt: inputArgs.prompt
      });
      let llmTargetFacesEnabled = inputArgs.useLlmTargetFaces === true;
      let decisionPreviewModelId: string | null = null;
      let decisionPreviewImageFileName: string | null = null;
      if (llmTargetFacesEnabled) {
        try {
          const preview = await renderUploadedModelPreviewForLowPolyDecision(uploadedModel.id, uploadedModel.modelFileName);
          decisionPreviewModelId = preview.previewModelId;
          decisionPreviewImageFileName = preview.previewImageFileName;
        } catch (error) {
          llmTargetFacesEnabled = false;
          console.warn("Failed to generate uploaded-model preview for low poly LLM target faces. Falling back to manual/default target faces.", error);
        }
      }
      const lowPoly = await generateLowPolyForModel({
        modelId: uploadedModel.id,
        useLlmTargetFaces: llmTargetFacesEnabled,
        targetFaceCount: inputArgs.targetFaceCount,
        executionTarget: "local",
        llmDecisionSource: "model-render",
        prompt: inputArgs.prompt,
        context: inputArgs.context || inputArgs.fileName
      });
      let generated = lowPoly.generated;
      let renamedLowPolyFileName: string | null = null;
      if (inputArgs.renameLowPolyModelWithLlm === true && generated.lowPolyModelFileName) {
        try {
          const namingPrompt = [
            inputArgs.prompt?.trim(),
            `Suggest a concise low poly model filename for this uploaded file: ${inputArgs.fileName.trim() || "uploaded-model"}`,
            inputArgs.context?.trim()
          ].filter((value): value is string => Boolean(value && value.length > 0)).join("\n");
          const decisionPreviewPath = decisionPreviewModelId && decisionPreviewImageFileName
            ? await input.resolveGeneratedModelFilePath(decisionPreviewModelId, decisionPreviewImageFileName).catch(() => "")
            : "";
          const suggestion = await input.suggestModelFileNameAndDescription({
            prompt: namingPrompt || `Suggest a concise low poly model filename for ${inputArgs.fileName.trim() || "uploaded-model"}.`,
            sourceImageInput: decisionPreviewPath || undefined,
            preferVisualModel: globalSettings.ollamaTextModelIsVisual,
            llmConnectionSettings: input.resolveModel3dLlmConnectionSettingsFromState()
          });
          const suggestedName = input.normalizeModelNameCandidate(suggestion.fileName);
          if (suggestedName) {
            generated = await input.renameGeneratedLowPolyModelFileName(generated.id, suggestedName);
            renamedLowPolyFileName = generated.lowPolyModelFileName;
          }
        } catch (error) {
          console.warn("Failed to rename uploaded low poly model with LLM. Keeping generated filename.", error);
        }
      }
      return {
        ...lowPoly,
        generated,
        usedLlmTargetFaces: llmTargetFacesEnabled && lowPoly.usedLlmTargetFaces === true,
        decisionPreviewModelId,
        decisionPreviewImageFileName,
        renamedLowPolyFileName
      };
    };
    if (preferredExecutionTarget === "remote" && canUseRemoteWorker) {
      try {
        return await input.generateLowPolyFromUploadedModelViaRemoteWorker({
          fileName: inputArgs.fileName,
          fileData: inputArgs.fileData,
          contentType: inputArgs.contentType,
          useLlmTargetFaces: inputArgs.useLlmTargetFaces,
          targetFaceCount: inputArgs.targetFaceCount,
          prompt: inputArgs.prompt,
          context: inputArgs.context,
          renameLowPolyModelWithLlm: inputArgs.renameLowPolyModelWithLlm
        });
      } catch (error) {
        console.warn("Remote uploaded low poly generation failed. Falling back to local generation.", error);
      }
    } else if (preferredExecutionTarget === "remote" && !canUseRemoteWorker) {
      console.warn("Remote low poly execution is enabled, but REMOTE_WORKER_BASE_URL is not configured. Falling back to local generation.");
    }
    return runLocal();
  }

  async function suggestStudioModelRealWorldHeight(inputArgs: {
    modelId: string;
    modelFileName: string;
    prompt?: string;
    context?: string;
    executionTarget?: "local" | "remote";
  }): Promise<ModelRealWorldHeightDecision> {
    const globalSettings = input.getGlobalSettings();
    const preview = await renderUploadedModelPreviewForLowPolyDecision(inputArgs.modelId, inputArgs.modelFileName);
    const promptContext = inputArgs.prompt?.trim() || `Estimate realistic height for ${inputArgs.modelFileName}`;
    const extraContext = inputArgs.context?.trim() || inputArgs.modelFileName;
    if ((inputArgs.executionTarget ?? globalSettings.model3dMetadataTarget) === "remote") {
      return input.suggestModelRealWorldHeightViaRemoteWorker({
        prompt: promptContext,
        imageInput: preview.sourceImageInput,
        context: extraContext,
        preferVisualModel: true
      });
    }
    return input.suggestModelRealWorldHeight({
      promptContext,
      sourceImageInput: preview.sourceImageInput,
      extraContext,
      preferVisualModel: true,
      llmConnectionSettings: input.resolveModel3dLlmConnectionSettingsFromState()
    });
  }

  async function applyStudioModelEdits(inputArgs: {
    modelId: string;
    executionTarget?: "local" | "remote";
    targetHeightMeters?: number;
    metallicEnabled?: boolean | null;
    roughnessValue?: number | null;
  }): Promise<GeneratedModelPublicRecord> {
    let generated = await input.getGeneratedModelPublicById(inputArgs.modelId);
    if (!generated) {
      throw new Error("Generated model was not found.");
    }
    if (typeof inputArgs.targetHeightMeters === "number" && Number.isFinite(inputArgs.targetHeightMeters) && inputArgs.targetHeightMeters > 0) {
      generated = await input.applyModelScaleToHeightWithExecution({
        modelId: inputArgs.modelId,
        targetHeightMeters: inputArgs.targetHeightMeters
      }, inputArgs.executionTarget);
    }
    if (typeof inputArgs.metallicEnabled === "boolean" || (typeof inputArgs.roughnessValue === "number" && Number.isFinite(inputArgs.roughnessValue))) {
      generated = await input.applyGeneratedModelMaterialFinish({
        modelId: inputArgs.modelId,
        metallicEnabled: typeof inputArgs.metallicEnabled === "boolean" ? inputArgs.metallicEnabled : null,
        roughnessValue: typeof inputArgs.roughnessValue === "number" && Number.isFinite(inputArgs.roughnessValue) ? inputArgs.roughnessValue : null
      });
    }
    return generated;
  }

  async function applyAutoRigToGeneratedModel(inputArgs: {
    modelId: string;
    rigProfile?: string;
    useVision?: boolean;
    landmarks?: Record<string, [number, number, number]> | null;
  }): Promise<GeneratedModelPublicRecord> {
    const settings = input.resolveModel3dLlmConnectionSettingsFromState();
    const provider = inputArgs.useVision === false ? "none" : (settings.llmProvider === "ollama" ? "ollama" : "lmstudio");
    const model = settings.visionModel || settings.textModel;
    if (provider !== "none" && !model) {
      throw new Error("No 3D vision LLM model is configured for AutoRig.");
    }
    return input.applyGeneratedModelAutoRig({
      modelId: inputArgs.modelId,
      llmProvider: provider,
      llmModel: model || "none",
      ollamaUrl: settings.ollamaUrl,
      lmStudioBaseUrl: settings.lmStudioBaseUrl,
      lmStudioApiKey: settings.lmStudioApiKey,
      rigProfile: inputArgs.rigProfile || "auto",
      useVision: inputArgs.useVision !== false,
      landmarks: inputArgs.landmarks ?? null
    });
  }

  async function previewAutoRigForGeneratedModel(inputArgs: {
    modelId: string;
    rigProfile?: string;
    useVision?: boolean;
    landmarks?: Record<string, [number, number, number]> | null;
  }) {
    const settings = input.resolveModel3dLlmConnectionSettingsFromState();
    const provider = inputArgs.useVision === false ? "none" : (settings.llmProvider === "ollama" ? "ollama" : "lmstudio");
    const model = settings.visionModel || settings.textModel;
    if (provider !== "none" && !model) {
      throw new Error("No 3D vision LLM model is configured for AutoRig.");
    }
    return input.previewGeneratedModelAutoRig({
      modelId: inputArgs.modelId,
      llmProvider: provider,
      llmModel: model || "none",
      ollamaUrl: settings.ollamaUrl,
      lmStudioBaseUrl: settings.lmStudioBaseUrl,
      lmStudioApiKey: settings.lmStudioApiKey,
      rigProfile: inputArgs.rigProfile || "auto",
      useVision: inputArgs.useVision !== false,
      landmarks: inputArgs.landmarks ?? null
    });
  }

  async function editUploadedModel(inputArgs: {
    fileName: string;
    fileData: Buffer;
    contentType?: string;
    prompt?: string;
    context?: string;
    useLlmHeight?: boolean;
    targetHeightMeters?: number;
    executionTarget?: "local" | "remote";
    metallicEnabled?: boolean | null;
    roughnessValue?: number | null;
  }): Promise<{
    generated: GeneratedModelPublicRecord;
    realWorldHeightDecision?: (ModelRealWorldHeightDecision & { action: "scaled" | "skipped" }) | null;
  }> {
    const uploadedModel = await input.importUploadedSourceModel({
      fileName: inputArgs.fileName,
      fileData: inputArgs.fileData,
      contentType: inputArgs.contentType,
      prompt: inputArgs.prompt
    });
    let realWorldHeightDecision: (ModelRealWorldHeightDecision & { action: "scaled" | "skipped" }) | null = null;
    let targetHeightMeters = typeof inputArgs.targetHeightMeters === "number" && Number.isFinite(inputArgs.targetHeightMeters)
      ? Math.max(0.03, Math.min(4000, inputArgs.targetHeightMeters))
      : null;
    if (inputArgs.useLlmHeight === true) {
      const decision = await suggestStudioModelRealWorldHeight({
        modelId: uploadedModel.id,
        modelFileName: uploadedModel.modelFileName,
        prompt: inputArgs.prompt,
        context: inputArgs.context,
        executionTarget: inputArgs.executionTarget
      });
      targetHeightMeters = decision.heightMeters;
      realWorldHeightDecision = { ...decision, action: "scaled" };
    }
    const generated = await applyStudioModelEdits({
      modelId: uploadedModel.id,
      executionTarget: inputArgs.executionTarget,
      targetHeightMeters: targetHeightMeters ?? undefined,
      metallicEnabled: inputArgs.metallicEnabled,
      roughnessValue: inputArgs.roughnessValue
    });
    return {
      generated,
      realWorldHeightDecision
    };
  }

  async function editGeneratedModel(inputArgs: {
    modelId: string;
    prompt?: string;
    context?: string;
    useLlmHeight?: boolean;
    targetHeightMeters?: number;
    executionTarget?: "local" | "remote";
    metallicEnabled?: boolean | null;
    roughnessValue?: number | null;
  }): Promise<{
    generated: GeneratedModelPublicRecord;
    realWorldHeightDecision?: (ModelRealWorldHeightDecision & { action: "scaled" | "skipped" }) | null;
  }> {
    const record = await input.getGeneratedModelPublicById(inputArgs.modelId);
    if (!record) {
      throw new Error("Generated model was not found.");
    }
    let realWorldHeightDecision: (ModelRealWorldHeightDecision & { action: "scaled" | "skipped" }) | null = null;
    let targetHeightMeters = typeof inputArgs.targetHeightMeters === "number" && Number.isFinite(inputArgs.targetHeightMeters)
      ? Math.max(0.03, Math.min(4000, inputArgs.targetHeightMeters))
      : null;
    if (inputArgs.useLlmHeight === true) {
      const decision = await suggestStudioModelRealWorldHeight({
        modelId: record.id,
        modelFileName: record.modelFileName,
        prompt: inputArgs.prompt,
        context: inputArgs.context,
        executionTarget: inputArgs.executionTarget
      });
      targetHeightMeters = decision.heightMeters;
      realWorldHeightDecision = { ...decision, action: "scaled" };
    }
    const generated = await applyStudioModelEdits({
      modelId: record.id,
      executionTarget: inputArgs.executionTarget,
      targetHeightMeters: targetHeightMeters ?? undefined,
      metallicEnabled: inputArgs.metallicEnabled,
      roughnessValue: inputArgs.roughnessValue
    });
    return {
      generated,
      realWorldHeightDecision
    };
  }

  return {
    renderUploadedModelPreviewForLowPolyDecision,
    generateLowPolyFromUploadedModel,
    generateLowPolyForModel,
    suggestStudioModelRealWorldHeight,
    applyStudioModelEdits,
    applyAutoRigToGeneratedModel,
    previewAutoRigForGeneratedModel,
    editUploadedModel,
    editGeneratedModel
  };
}
