function createDashboardThreeDStudioActionHelpers(input) {
  const state = input && input.state ? input.state : {};
  const request = input && typeof input.request === "function" ? input.request : async function requestFallback() {
    throw new Error("Dashboard request helper is not available.");
  };
  const setOutput = input && typeof input.setOutput === "function" ? input.setOutput : function setOutputFallback() {};
  const setModel3dStatus = input && typeof input.setModel3dStatus === "function" ? input.setModel3dStatus : function setModel3dStatusFallback() {};
  const setModel3dThreeStatus = input && typeof input.setModel3dThreeStatus === "function" ? input.setModel3dThreeStatus : function setModel3dThreeStatusFallback() {};
  const describeClientError = input && typeof input.describeClientError === "function" ? input.describeClientError : function describeClientErrorFallback(error, fallback) {
    return error instanceof Error ? error.message : (fallback || "Unknown error.");
  };
  const describeModel3dScaleDecision = input && typeof input.describeModel3dScaleDecision === "function"
    ? input.describeModel3dScaleDecision
    : function describeModel3dScaleDecisionFallback() {
      return "";
    };
  const loadModel3dHistory = input && typeof input.loadModel3dHistory === "function" ? input.loadModel3dHistory : async function loadModel3dHistoryFallback() {};
  const scheduleModel3dHistoryRefresh = input && typeof input.scheduleModel3dHistoryRefresh === "function" ? input.scheduleModel3dHistoryRefresh : function scheduleModel3dHistoryRefreshFallback() {};
  const renderModel3dViewer = input && typeof input.renderModel3dViewer === "function" ? input.renderModel3dViewer : async function renderModel3dViewerFallback() {};
  const refreshState = input && typeof input.refreshState === "function" ? input.refreshState : async function refreshStateFallback() {};
  const loadBotMessages = input && typeof input.loadBotMessages === "function" ? input.loadBotMessages : async function loadBotMessagesFallback() {};
  const getSelectedGeneratedModel = input && typeof input.getSelectedGeneratedModel === "function" ? input.getSelectedGeneratedModel : function getSelectedGeneratedModelFallback() {
    return null;
  };
  const collectModel3dSourceCandidates = input && typeof input.collectModel3dSourceCandidates === "function"
    ? input.collectModel3dSourceCandidates
    : function collectModel3dSourceCandidatesFallback() {
      return [];
    };
  const readModel3dPostOptions = input && typeof input.readModel3dPostOptions === "function" ? input.readModel3dPostOptions : function readModel3dPostOptionsFallback() {
    return {};
  };
  const validateModel3dPostOptions = input && typeof input.validateModel3dPostOptions === "function" ? input.validateModel3dPostOptions : function validateModel3dPostOptionsFallback() {
    return "";
  };
  const readModel3dLowPolyOptionsFromUi = input && typeof input.readModel3dLowPolyOptionsFromUi === "function"
    ? input.readModel3dLowPolyOptionsFromUi
    : function readModel3dLowPolyOptionsFromUiFallback() {
      return {
        lowPolyUseLlmTargetFaces: false,
        lowPolyLlmDecisionSource: "input-image",
        lowPolyTargetFaceCount: 1500
      };
    };
  const inferModelImageFileNameHint = input && typeof input.inferModelImageFileNameHint === "function"
    ? input.inferModelImageFileNameHint
    : function inferModelImageFileNameHintFallback() {
      return "";
    };
  const summarizeMetallicDecision = input && typeof input.summarizeMetallicDecision === "function"
    ? input.summarizeMetallicDecision
    : function summarizeMetallicDecisionFallback() {
      return "";
    };
  const summarizeRealWorldHeightDecision = input && typeof input.summarizeRealWorldHeightDecision === "function"
    ? input.summarizeRealWorldHeightDecision
    : function summarizeRealWorldHeightDecisionFallback() {
      return "";
    };
  const postGeneratedModelToExternalMessengerFromStudio = input && typeof input.postGeneratedModelToExternalMessengerFromStudio === "function"
    ? input.postGeneratedModelToExternalMessengerFromStudio
    : async function postGeneratedModelToExternalMessengerFromStudioFallback() {};
  const escapeHtml = input && typeof input.escapeHtml === "function" ? input.escapeHtml : value => String(value || "");
  const buildAbsoluteDashboardUrl = input && typeof input.buildAbsoluteDashboardUrl === "function"
    ? input.buildAbsoluteDashboardUrl
    : value => String(value || "").trim();
  const getModel3dFileUrl = input && typeof input.getModel3dFileUrl === "function"
    ? input.getModel3dFileUrl
    : () => "";
  const switchModel3dStudioTab = input && typeof input.switchModel3dStudioTab === "function" ? input.switchModel3dStudioTab : function switchModel3dStudioTabFallback() {};
  const setWorkflowRightSidebarCollapsed = input && typeof input.setWorkflowRightSidebarCollapsed === "function" ? input.setWorkflowRightSidebarCollapsed : function setWorkflowRightSidebarCollapsedFallback() {};
  const setModel3dGenerationBusy = input && typeof input.setModel3dGenerationBusy === "function" ? input.setModel3dGenerationBusy : function setModel3dGenerationBusyFallback() {};
  const model3dRequestController = createDashboardSingleRequestController({
    prefix: "model3d",
    toggleBusy(visible) {
      setModel3dGenerationBusy(visible === true);
    }
  });
  const comfyWorkflowSeedMax = 0xffffffffffff;
  function createRandomWorkflowSeed() {
    if (globalThis.crypto && typeof globalThis.crypto.getRandomValues === "function") {
      const values = new Uint8Array(6);
      globalThis.crypto.getRandomValues(values);
      return values.reduce((seed, value) => (seed * 256) + value, 0);
    }
    return Math.floor(Math.random() * comfyWorkflowSeedMax);
  }
  function normalizeWorkflowSeed(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return null;
    }
    return Math.max(0, Math.min(comfyWorkflowSeedMax, Math.round(numeric)));
  }
  function setWorkflowSeedInput(id, seed) {
    const normalized = normalizeWorkflowSeed(seed);
    const node = document.getElementById(id);
    if (normalized === null || !node || typeof node.value !== "string") {
      return;
    }
    node.value = String(normalized);
    node.dispatchEvent(new Event("input", { bubbles: true }));
    node.dispatchEvent(new Event("change", { bubbles: true }));
  }
  function readWorkflowSeed(id) {
    const node = document.getElementById(id);
    const seed = normalizeWorkflowSeed(node && typeof node.value === "string" && node.value.trim() ? node.value : NaN) ?? createRandomWorkflowSeed();
    setWorkflowSeedInput(id, seed);
    return seed;
  }
  function readGenerateCount(id) {
    const node = document.getElementById(id);
    const raw = node && typeof node.value === "string" ? node.value.trim() : "";
    const parsed = raw ? Number.parseInt(raw, 10) : 1;
    return Number.isFinite(parsed) ? Math.max(1, Math.min(8, parsed)) : 1;
  }
  function readModel3dGenerateWorkflow() {
    const selected = String(document.getElementById("model3d-generate-workflow-select")?.value || state.model3dGenerateWorkflow || "single-image").trim();
    return selected === "multiview" ? "multiview" : "single-image";
  }
  function buildModel3dMultiViewInputs(sources) {
    const viewNames = ["front", "back", "left", "right"];
    const entries = {};
    const assignments = state.model3dMultiViewAssignments && typeof state.model3dMultiViewAssignments === "object"
      ? state.model3dMultiViewAssignments
      : {};
    const assignedSources = new Set();
    const excludedSources = new Set();
    sources.forEach(source => {
      const normalizedSource = String(source || "").trim();
      const viewName = String(assignments[normalizedSource] || "").trim().toLowerCase();
      if (normalizedSource && viewNames.includes(viewName) && !entries[viewName]) {
        entries[viewName] = normalizedSource;
        assignedSources.add(normalizedSource);
      } else if (normalizedSource && Object.prototype.hasOwnProperty.call(assignments, normalizedSource) && !viewName) {
        excludedSources.add(normalizedSource);
      }
    });
    viewNames.forEach((viewName, index) => {
      if (entries[viewName]) {
        return;
      }
      const fallback = sources.find((source, sourceIndex) => !assignedSources.has(String(source || "").trim()) && !excludedSources.has(String(source || "").trim()) && sourceIndex >= index)
        || sources.find(source => !assignedSources.has(String(source || "").trim()) && !excludedSources.has(String(source || "").trim()));
      const normalizedFallback = String(fallback || "").trim();
      if (normalizedFallback) {
        entries[viewName] = normalizedFallback;
        assignedSources.add(normalizedFallback);
      }
    });
    return entries;
  }
  function applySeedControlAfterGenerate(id, controlId, usedSeed) {
    const seed = normalizeWorkflowSeed(usedSeed);
    if (seed === null) {
      return;
    }
    const mode = String(document.getElementById(controlId)?.value || "randomize").trim();
    const nextSeed = mode === "increase"
      ? Math.min(comfyWorkflowSeedMax, seed + 1)
      : mode === "decrease"
        ? Math.max(0, seed - 1)
        : mode === "fixed"
          ? seed
          : createRandomWorkflowSeed();
    setWorkflowSeedInput(id, nextSeed);
  }
  function startModel3dGenerationRequest() {
    return model3dRequestController.start();
  }
  function finishModel3dGenerationRequest(requestId) {
    model3dRequestController.finish(requestId);
  }
  async function stopModel3dGeneration() {
    if (!model3dRequestController.get()) {
      return;
    }
    setModel3dStatus("Stopping 3D model generation...");
    await model3dRequestController.stop();
  }

  async function requestModel3dGenerationWithPreviewStream(payload) {
    const response = await fetch("/api/model3d-generate", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        ...payload,
        streamEvents: true
      })
    });
    if (!response.ok || !response.body) {
      return request("/api/model3d-generate", payload);
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let finalModel = null;
    const dispatchEventLine = async line => {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) {
        return;
      }
      let eventPayload = null;
      try {
        eventPayload = JSON.parse(trimmed.slice(5).trim());
      } catch {
        return;
      }
      if (!eventPayload || typeof eventPayload !== "object") {
        return;
      }
      if (eventPayload.type === "model-ready" && eventPayload.model) {
        const model = eventPayload.model;
        state.selectedGeneratedModelId = model.id || state.selectedGeneratedModelId;
        state.model3dThreeVariant = model.originalModelFileName ? "original" : "current";
        setModel3dStatus("Untextured 3D mesh ready. Loading Three.js preview...");
        await loadModel3dHistory(model.id);
        await renderModel3dViewer();
        return;
      }
      if (eventPayload.type === "done" && eventPayload.model) {
        finalModel = eventPayload.model;
        return;
      }
      if (eventPayload.type === "error") {
        throw new Error(eventPayload.message || "3D model generation failed.");
      }
    };
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) {
        break;
      }
      buffer += decoder.decode(chunk.value, { stream: true });
      let eventBreakIndex = buffer.indexOf("\n\n");
      while (eventBreakIndex !== -1) {
        const eventBlock = buffer.slice(0, eventBreakIndex);
        buffer = buffer.slice(eventBreakIndex + 2);
        const dataLine = eventBlock.split(/\r?\n/).find(item => item.trim().startsWith("data:"));
        if (dataLine) {
          await dispatchEventLine(dataLine);
        }
        eventBreakIndex = buffer.indexOf("\n\n");
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) {
      const dataLine = buffer.split(/\r?\n/).find(item => item.trim().startsWith("data:"));
      if (dataLine) {
        await dispatchEventLine(dataLine);
      }
    }
    if (!finalModel) {
      throw new Error("3D model stream finished without a final model.");
    }
    return finalModel;
  }

  async function runModel3dGenerationFromStudio() {
    const sources = collectModel3dSourceCandidates();
    if (sources.length === 0) {
      return void setOutput("Provide at least one model source image or select an image pool.");
    }
    const postOptions = readModel3dPostOptions();
    const validationError = validateModel3dPostOptions(postOptions, state.selectedChannelId);
    if (validationError) {
      return void setOutput(validationError);
    }
    const postDestinationId = String(postOptions.postDestinationId || "").trim();
    const discordPostChannelId = postOptions.postMessenger === "discord"
      ? (postDestinationId || String(state.selectedChannelId || "").trim())
      : "";
    const postToDiscord = Boolean(discordPostChannelId);
    const postToTelegram = postOptions.postMessenger === "telegram";
    const postToWhatsApp = postOptions.postMessenger === "whatsapp";
    const workflowMode = readModel3dGenerateWorkflow();
    state.model3dGenerateWorkflow = workflowMode;
    const multiViewImageInputs = workflowMode === "multiview" ? buildModel3dMultiViewInputs(sources) : null;
    if (workflowMode === "multiview" && (!multiViewImageInputs?.front || !multiViewImageInputs?.back)) {
      return void setOutput("MultiView needs assigned Front and Back images. Left and Right are optional.");
    }
    const useRandomSource = workflowMode !== "multiview" && document.getElementById("model3d-random-source")?.checked !== false;
    const source = useRandomSource ? sources[Math.floor(Math.random() * sources.length)] : sources[0];
    const askLlmIfModelShouldBeMetallic = document.getElementById("model3d-ask-llm-metallic")?.checked === true;
    const askLlmForRealWorldHeightAndScale = document.getElementById("model3d-auto-scale-real-height")?.checked === true;
    const useLlmModelFileName = document.getElementById("model3d-llm-filename")?.checked === true;
    const useLlmModelDescription = document.getElementById("model3d-llm-description")?.checked === true;
    const useLlmMetadata = useLlmModelFileName || useLlmModelDescription;
    const createLowPolyAfterGeneration = document.getElementById("model3d-create-lowpoly-after-generation")?.checked === true;
    const lowPolyOptions = readModel3dLowPolyOptionsFromUi();
    const executionTarget = document.getElementById("model3d-generation-target")?.value === "remote" ? "remote" : "local";
    const metadataTarget = document.getElementById("model3d-metadata-target")?.value === "remote" ? "remote" : "local";
    const metadataTiming = document.getElementById("model3d-llm-metadata-timing")?.value === "before"
      ? "before"
      : (document.getElementById("model3d-llm-metadata-timing")?.value === "parallel" ? "parallel" : "after");
    const unloadLlmBeforeGenerate = document.getElementById("model3d-unload-llm-before-generate")?.checked !== false;
    const batchSources = workflowMode !== "multiview" && document.getElementById("model3d-batch-sources")?.checked === true && sources.length > 1;
    const generationSources = batchSources ? sources : [source];
    const modelCount = readGenerateCount("model3d-generate-count");
    const totalModelRuns = generationSources.length * modelCount;
    const model3dWorkflowPaths = globalThis.dashboardComfyWorkflowPaths?.model3d || {};
    const workflowPathOverride = workflowMode === "multiview"
      ? String(model3dWorkflowPaths.multiview || "comfyui-workflows/3d/3dmodel_multiview.json").trim()
      : "";
    const dashboardRequestId = startModel3dGenerationRequest();
    setModel3dStatus(totalModelRuns > 1 ? "Generating 3D model 1 of " + totalModelRuns + "..." : "Generating 3D model...");
    try {
      const generatedModels = [];
      const lowPolyErrors = [];
      const decisionLines = [];
      for (let sourceIndex = 0; sourceIndex < generationSources.length; sourceIndex += 1) {
        const currentSource = generationSources[sourceIndex];
        const imageFileNameHint = inferModelImageFileNameHint(currentSource);
        for (let modelIndex = 0; modelIndex < modelCount; modelIndex += 1) {
          const runIndex = (sourceIndex * modelCount) + modelIndex + 1;
          const seed = readWorkflowSeed("model3d-seed");
          if (totalModelRuns > 1) {
            setModel3dStatus("Generating 3D model " + runIndex + " of " + totalModelRuns + "...");
          }
          const generated = await requestModel3dGenerationWithPreviewStream({
            imageInput: currentSource,
            imageFileNameHint: imageFileNameHint || undefined,
            workflowPathOverride: workflowPathOverride || undefined,
            multiViewImageInputs: multiViewImageInputs || undefined,
            seed,
            autoPrompt: false,
            askLlmIfModelShouldBeMetallic,
            askLlmForRealWorldHeightAndScale,
            useLlmMetadata,
            useLlmModelFileName,
            useLlmModelDescription,
            metadataTiming,
            metadataExecutionTarget: metadataTarget,
            unloadLlmBeforeGenerate,
            executionTarget,
            postToChannel: postToDiscord,
            channelId: postToDiscord ? discordPostChannelId : undefined,
            postTargetMode: postOptions.postTargetMode,
            threadNameMode: postOptions.threadNameMode,
            threadName: postOptions.threadName || undefined,
            threadNameBase: postOptions.threadNameBase || undefined,
            modelNameSource: postOptions.modelNameSource,
            forumChannelId: postOptions.forumChannelId || undefined,
            forumChannelName: postOptions.forumChannelName || undefined,
            lowPolyForumChannelId: postOptions.lowPolyForumChannelId || undefined,
            lowPolyForumChannelName: "",
            extraContent: postOptions.destinationExtraText || undefined,
            initialExtraContent: postOptions.initialExtraText || undefined,
            sendInitialToSelectedChannel: postOptions.sendInitialToSelectedChannel,
            modelUploadTarget: postOptions.modelUploadTarget,
            includeModelFile: postOptions.includeModelFile,
            includePreviewMedia: postOptions.includePreviewMedia,
            includeEmbed: postOptions.includeEmbed,
            includeEmbedInInitial: postOptions.includeEmbedInInitial,
            includeButtons: postOptions.includeButtons,
            uploadTextureMessages: postOptions.uploadTextureMessages,
            uploadMultiViewTextures: postOptions.uploadMultiViewTextures,
            uploadUvMapTextures: postOptions.uploadUvMapTextures,
            uploadNormalMapTextures: postOptions.uploadNormalMapTextures,
            textureUploadTarget: postOptions.textureUploadTarget,
            generateLowPolyVersion: postOptions.generateLowPolyVersion,
            lowPolyExecutionTarget: executionTarget,
            lowPolyUseLlmTargetFaces: postOptions.lowPolyUseLlmTargetFaces,
            lowPolyLlmDecisionSource: postOptions.lowPolyLlmDecisionSource,
            lowPolyTargetFaceCount: postOptions.lowPolyTargetFaceCount,
            dashboardRequestId
          });
          generatedModels.push(generated);
          applySeedControlAfterGenerate("model3d-seed", "model3d-seed-control", seed);
          if (postToTelegram || postToWhatsApp) {
            await postGeneratedModelToExternalMessengerFromStudio(postOptions.postMessenger, generated, postDestinationId);
          }
          const metallicDecisionSummary = summarizeMetallicDecision(generated.metallicDecision);
          const realWorldHeightSummary = summarizeRealWorldHeightDecision(generated.realWorldHeightDecision);
          if (metallicDecisionSummary) {
            decisionLines.push(generated.modelFileName + ": " + metallicDecisionSummary);
          }
          if (realWorldHeightSummary) {
            decisionLines.push(generated.modelFileName + ": " + realWorldHeightSummary);
          }
          await loadModel3dHistory(generated.id);
          if (createLowPolyAfterGeneration) {
            setModel3dStatus("Generated " + generated.modelFileName + ". Generating low poly follow-up...");
            try {
              await request("/api/model3d-lowpoly-generate", {
                modelId: generated.id,
                executionTarget,
                llmTargetFaces: lowPolyOptions.lowPolyUseLlmTargetFaces,
                targetFaces: lowPolyOptions.lowPolyUseLlmTargetFaces ? undefined : lowPolyOptions.lowPolyTargetFaceCount,
                llmDecisionSource: lowPolyOptions.lowPolyLlmDecisionSource,
                prompt: "Create a low poly version of this generated model: " + generated.modelFileName,
                context: generated.modelFileName
              });
              await loadModel3dHistory(generated.id);
            } catch (lowPolyError) {
              lowPolyErrors.push(generated.modelFileName + ": " + describeClientError(lowPolyError, "Low poly follow-up failed without an error detail."));
            }
          }
          if ((useLlmModelFileName || useLlmModelDescription) && metadataTiming !== "before") {
            scheduleModel3dHistoryRefresh(generated.id, generated.modelFileName);
          }
        }
      }
      const generated = generatedModels[generatedModels.length - 1];
      const lowPolyGenerationError = lowPolyErrors.join("\n");
      if (useLlmModelFileName && metadataTiming !== "before") {
        setModel3dStatus((batchSources ? "Generated " + generatedModels.length + " models" : "Generated " + generated.modelFileName) + ". Waiting for LLM metadata...");
      } else if (useLlmModelDescription && metadataTiming !== "before") {
        setModel3dStatus((batchSources ? "Generated " + generatedModels.length + " models" : "Generated " + generated.modelFileName) + ". LLM description is queued.");
      } else if (createLowPolyAfterGeneration && lowPolyGenerationError) {
        const shortDetail = lowPolyGenerationError.length > 220 ? lowPolyGenerationError.slice(0, 220) + "..." : lowPolyGenerationError;
        setModel3dStatus("Generated " + generatedModels.length + " model" + (generatedModels.length === 1 ? "" : "s") + ", but low poly follow-up failed: " + shortDetail);
      } else if (createLowPolyAfterGeneration) {
        setModel3dStatus("Generated " + generatedModels.length + " model" + (generatedModels.length === 1 ? "" : "s") + " and low poly follow-up successfully.");
      } else {
        setModel3dStatus("Generated " + generatedModels.length + " model" + (generatedModels.length === 1 ? "" : "s") + " successfully.");
      }
      const extraDecisionLines = decisionLines.join("\n");
      if (lowPolyGenerationError) {
        setOutput("Generated 3D model, but low poly follow-up failed: " + lowPolyGenerationError + (extraDecisionLines ? "\n" + extraDecisionLines : ""));
      } else if (createLowPolyAfterGeneration && postToDiscord) {
        setOutput("Generated 3D model, posted it to Discord, and created a low poly follow-up." + (extraDecisionLines ? "\n" + extraDecisionLines : ""));
      } else if (createLowPolyAfterGeneration && postToTelegram) {
        setOutput("Generated 3D model, posted it to Telegram, and created a low poly follow-up." + (extraDecisionLines ? "\n" + extraDecisionLines : ""));
      } else if (createLowPolyAfterGeneration && postToWhatsApp) {
        setOutput("Generated 3D model, posted it to WhatsApp, and created a low poly follow-up." + (extraDecisionLines ? "\n" + extraDecisionLines : ""));
      } else if (createLowPolyAfterGeneration) {
        setOutput("Generated 3D model and created a low poly follow-up in 3D Model Studio." + (extraDecisionLines ? "\n" + extraDecisionLines : ""));
      } else {
        const summary = postToDiscord
          ? "Generated 3D model and posted it to Discord."
          : (postToTelegram
            ? "Generated 3D model and posted it to Telegram."
            : (postToWhatsApp
              ? "Generated 3D model and posted it to WhatsApp."
              : "Generated 3D model in 3D Model Studio."));
        setOutput(summary + (extraDecisionLines ? "\n" + extraDecisionLines : ""));
      }
      if (postToDiscord) {
        await loadBotMessages();
      }
      await refreshState();
    } catch (error) {
      const detail = error && error.message ? error.message : "Unknown error";
      const stopped = /stopped|aborted/i.test(detail);
      setModel3dStatus(stopped ? "3D model generation stopped." : "3D model generation failed.");
      setOutput(stopped ? "Stopped 3D model generation." : "Failed to generate 3D model: " + detail);
    } finally {
      finishModel3dGenerationRequest(dashboardRequestId);
    }
  }

  async function runModel3dSeparateByLoosePartsForSelectedModel(requestedExportMode) {
    const selected = getSelectedGeneratedModel();
    if (!selected) {
      return void setOutput("Select a generated model first.");
    }
    const exportMode = requestedExportMode === "single_file"
      ? "single_file"
      : "per_part";
    setModel3dStatus("Separating " + selected.modelFileName + " by loose parts...");
    try {
      const result = await request("/api/model3d-separate-loose-parts", {
        modelId: selected.id,
        executionTarget: document.getElementById("model3d-generation-target")?.value === "remote" ? "remote" : "local",
        exportMode
      });
      const generatedModels = Array.isArray(result?.models) ? result.models : [];
      const preferredModelId = exportMode === "per_part"
        ? String(generatedModels[0]?.id || "")
        : String(result?.generated?.id || selected.id || "");
      await loadModel3dHistory(preferredModelId);
      await renderModel3dViewer();
      setModel3dStatus("Separated " + selected.modelFileName + " by loose parts.");
      if (exportMode === "per_part") {
        setOutput("Separated " + selected.modelFileName + " into " + (result?.partCount || generatedModels.length || "multiple") + " part files and added them to Recent Models.");
      } else {
        setOutput("Separated " + selected.modelFileName + " by loose parts and saved the result as one file.");
      }
    } catch (error) {
      const detail = describeClientError(error, "Separate by loose parts failed without an error detail.");
      setModel3dStatus("Separate by loose parts failed for "+selected.modelFileName+" selected model.");
      setOutput("Failed to separate selected model "+selected.modelFileName+" by loose parts: " + detail);
    }
  }

  async function runLowPolyGenerationForSelectedModel() {
    const selected = getSelectedGeneratedModel();
    if (!selected) {
      return void setOutput("Select a generated model first.");
    }
    const lowPolyOptions = await openLowPolyConfigurationOverlay(selected);
    if (!lowPolyOptions) {
      return;
    }
    return runLowPolyGenerationForSelectedModelWithOptions(selected, lowPolyOptions);
  }

  function openLowPolyConfigurationOverlay(selected) {
    document.getElementById("model3d-lowpoly-configuration-overlay")?.remove();
    return new Promise(resolve => {
      const overlay = document.createElement("div");
      overlay.id = "model3d-lowpoly-configuration-overlay";
      overlay.className = "runtime-overlay model3d-share-overlay model3d-lowpoly-configuration-overlay";
      overlay.innerHTML = "<button class='runtime-overlay-backdrop model3d-lowpoly-configuration-backdrop' type='button' aria-label='Cancel'></button>"
        + "<section class='runtime-overlay-panel model3d-share-overlay-panel model3d-lowpoly-configuration-panel' role='dialog' aria-modal='true' aria-labelledby='model3d-lowpoly-configuration-title'>"
        + "<header class='runtime-overlay-header'><div class='runtime-overlay-title-wrap'><span class='panel-kicker'>3D Quick Action</span><h3 id='model3d-lowpoly-configuration-title'>Create Lowpoly</h3><p class='model3d-share-overlay-message'>Choose a fixed target or let the LLM choose a target inside your budget for <strong>" + escapeHtml(selected.modelFileName) + "</strong>.</p></div><button class='secondary mini-button model3d-lowpoly-configuration-close' type='button' aria-label='Close'>✕</button></header>"
        + "<div class='model3d-share-overlay-body model3d-lowpoly-configuration-body'>"
        + "<div class='field'><label for='model3d-lowpoly-configuration-mode'>Target Mode</label><select id='model3d-lowpoly-configuration-mode'><option value='llm' selected>LLM detection within bounds</option><option value='custom'>Custom face count</option></select></div>"
        + "<div class='model3d-lowpoly-configuration-llm-fields'><div class='field'><label for='model3d-lowpoly-configuration-min'>LLM Minimum Faces</label><input id='model3d-lowpoly-configuration-min' type='number' min='1' step='1' value='500'></div><div class='field'><label for='model3d-lowpoly-configuration-max'>LLM Maximum Faces</label><input id='model3d-lowpoly-configuration-max' type='number' min='1' step='1' value='5000'></div><div class='hint'>The detected target is clamped to this range before Blender runs.</div></div>"
        + "<div class='model3d-lowpoly-configuration-custom-fields hidden'><div class='field'><label for='model3d-lowpoly-configuration-preset'>Face Count</label><select id='model3d-lowpoly-configuration-preset'><option value='500'>Tiny — 500 faces</option><option value='1000'>Small — 1,000 faces</option><option value='1500' selected>Medium — 1,500 faces</option><option value='3000'>Large — 3,000 faces</option><option value='5000'>Huge — 5,000 faces</option><option value='custom'>Custom value</option></select></div><div class='field hidden' id='model3d-lowpoly-configuration-custom-field'><label for='model3d-lowpoly-configuration-count'>Custom Faces</label><input id='model3d-lowpoly-configuration-count' type='number' min='1' step='1' value='1500'></div></div>"
        + "</div><div class='model3d-share-overlay-actions'><button class='secondary model3d-lowpoly-configuration-cancel' type='button'>Cancel</button><button class='primary model3d-lowpoly-configuration-submit' type='button'>Create Lowpoly</button></div></section>";
      document.body.appendChild(overlay);
      const mode = overlay.querySelector("#model3d-lowpoly-configuration-mode");
      const customFields = overlay.querySelector(".model3d-lowpoly-configuration-custom-fields");
      const llmFields = overlay.querySelector(".model3d-lowpoly-configuration-llm-fields");
      const preset = overlay.querySelector("#model3d-lowpoly-configuration-preset");
      const customField = overlay.querySelector("#model3d-lowpoly-configuration-custom-field");
      const close = value => {
        overlay.remove();
        resolve(value);
      };
      const syncMode = () => {
        const isLlm = mode?.value === "llm";
        customFields?.classList.toggle("hidden", isLlm);
        llmFields?.classList.toggle("hidden", !isLlm);
      };
      mode?.addEventListener("change", syncMode);
      preset?.addEventListener("change", () => customField?.classList.toggle("hidden", preset.value !== "custom"));
      overlay.querySelectorAll(".model3d-lowpoly-configuration-backdrop,.model3d-lowpoly-configuration-close,.model3d-lowpoly-configuration-cancel").forEach(node => node.addEventListener("click", () => close(null)));
      overlay.querySelector(".model3d-lowpoly-configuration-submit")?.addEventListener("click", () => {
        const min = Math.max(1, Number.parseInt(overlay.querySelector("#model3d-lowpoly-configuration-min")?.value || "500", 10) || 500);
        const max = Math.max(min, Number.parseInt(overlay.querySelector("#model3d-lowpoly-configuration-max")?.value || "5000", 10) || 5000);
        const selectedCount = preset?.value === "custom" ? overlay.querySelector("#model3d-lowpoly-configuration-count")?.value : preset?.value;
        const targetFaceCount = Math.max(1, Number.parseInt(selectedCount || "1500", 10) || 1500);
        close(mode?.value === "llm" ? { lowPolyUseLlmTargetFaces: true, llmMinTargetFaceCount: min, llmMaxTargetFaceCount: max } : { lowPolyUseLlmTargetFaces: false, lowPolyTargetFaceCount: targetFaceCount });
      });
      syncMode();
      mode?.focus();
    });
  }

  async function runLowPolyGenerationForSelectedModelWithOptions(selected, lowPolyOptions) {
    const executionTarget = document.getElementById("model3d-generation-target")?.value === "remote" ? "remote" : "local";
    setModel3dStatus("Generating low poly from selected model " + selected.modelFileName + "...");
    try {
      const result = await request("/api/model3d-lowpoly-generate", {
        modelId: selected.id,
        executionTarget,
        llmTargetFaces: lowPolyOptions.lowPolyUseLlmTargetFaces,
        targetFaces: lowPolyOptions.lowPolyUseLlmTargetFaces ? undefined : lowPolyOptions.lowPolyTargetFaceCount,
        llmMinTargetFaces: lowPolyOptions.llmMinTargetFaceCount,
        llmMaxTargetFaces: lowPolyOptions.llmMaxTargetFaceCount,
        llmDecisionSource: "model-render",
        prompt: "Create a low poly version of this generated model: " + selected.modelFileName,
        context: selected.modelFileName
      });
      await loadModel3dHistory(selected.id);
      const targetFaceCount = typeof result?.targetFaceCount === "number" && Number.isFinite(result.targetFaceCount)
        ? Math.max(1, Math.round(result.targetFaceCount))
        : lowPolyOptions.lowPolyTargetFaceCount;
      const reasonSuffix = result?.suggestionReason ? " Reason: " + result.suggestionReason : "";
      setModel3dStatus("Low poly model generated for " + selected.modelFileName + ".");
      setOutput("Generated low poly model for " + selected.modelFileName + " with target faces " + targetFaceCount + "." + reasonSuffix);
    } catch (error) {
      const detail = describeClientError(error, "Low poly generation failed without an error detail.");
      setModel3dStatus("Low poly generation for selected model failed.");
      setOutput("Failed to generate low poly from selected model: " + detail);
    }
  }

  async function runModel3dLlmScaleForSelectedModel() {
    const selected = getSelectedGeneratedModel();
    if (!selected) {
      return void setOutput("Select a generated model first.");
    }
    setModel3dStatus("Scaling " + selected.modelFileName + " with LLM height...");
    setModel3dThreeStatus("Scaling selected model with LLM height...");
    try {
      const result = await request("/api/model3d-edit", {
        modelId: selected.id,
        dimensionMode: "llm",
        metallicMode: "keep",
        roughnessMode: "keep",
        executionTarget: "local",
        prompt: selected.prompt || selected.modelFileName || selected.id,
        context: selected.modelFileName || selected.id
      });
      const generated = result?.generated || result;
      await loadModel3dHistory(generated?.id || selected.id);
      setModel3dStatus("Scaled " + selected.modelFileName + " with LLM height.");
      setModel3dThreeStatus("Scaled selected model with LLM height.");
      setOutput("Scaled " + selected.modelFileName + " using the LLM real-world height estimate." + describeModel3dScaleDecision(result));
      await refreshState();
    } catch (error) {
      const detail = describeClientError(error, "LLM scale failed without an error detail.");
      setModel3dStatus("LLM scale failed for selected model.");
      setModel3dThreeStatus("LLM scale failed.");
      setOutput("Failed to scale selected model with LLM: " + detail);
    }
  }

  const AUTO_RIG_MARKER_PROFILES = {
    human: [
      { id: "chin", group: "CHIN", label: "Chin", key: "neck", color: "#33d6d3" },
      { id: "shoulder.L", group: "SHOULDERS", label: "Left Shoulder", key: "shoulder.L", pairKey: "shoulder.R", side: "L", color: "#56c5ff" },
      { id: "shoulder.R", group: "SHOULDERS", label: "Right Shoulder", key: "shoulder.R", pairKey: "shoulder.L", side: "R", color: "#56c5ff" },
      { id: "wrist.L", group: "WRISTS", label: "Left Wrist", key: "hand.L", pairKey: "hand.R", side: "L", color: "#8bdc3f" },
      { id: "wrist.R", group: "WRISTS", label: "Right Wrist", key: "hand.R", pairKey: "hand.L", side: "R", color: "#8bdc3f" },
      { id: "elbow.L", group: "ELBOWS", label: "Left Elbow", key: "elbow.L", pairKey: "elbow.R", side: "L", color: "#f0d950" },
      { id: "elbow.R", group: "ELBOWS", label: "Right Elbow", key: "elbow.R", pairKey: "elbow.L", side: "R", color: "#f0d950" },
      { id: "knee.L", group: "KNEES", label: "Left Knee", key: "knee.L", pairKey: "knee.R", side: "L", color: "#ff9c32" },
      { id: "knee.R", group: "KNEES", label: "Right Knee", key: "knee.R", pairKey: "knee.L", side: "R", color: "#ff9c32" },
      { id: "ankle.L", group: "ANKLES", label: "Left Ankle", key: "ankle.L", pairKey: "ankle.R", side: "L", color: "#42f5e9" },
      { id: "ankle.R", group: "ANKLES", label: "Right Ankle", key: "ankle.R", pairKey: "ankle.L", side: "R", color: "#42f5e9" },
      { id: "foot.L", group: "FEET", label: "Left Foot", key: "foot.L", pairKey: "foot.R", side: "L", color: "#52b2ff" },
      { id: "foot.R", group: "FEET", label: "Right Foot", key: "foot.R", pairKey: "foot.L", side: "R", color: "#52b2ff" },
      { id: "groin", group: "GROIN", label: "Groin", key: "hips", color: "#ef5d93" }
    ],
    quadruped: [
      { id: "nose", group: "HEAD", label: "Nose / Snout", key: "head", color: "#33d6d3" },
      { id: "chest", group: "TORSO", label: "Chest", key: "chest", color: "#ef5d93" },
      { id: "hips", group: "TORSO", label: "Hips", key: "hips", color: "#f58d5e" },
      { id: "shoulder.L", group: "FRONT LEGS", label: "Left Front Shoulder", key: "shoulder.L", pairKey: "shoulder.R", side: "L", color: "#56c5ff" },
      { id: "shoulder.R", group: "FRONT LEGS", label: "Right Front Shoulder", key: "shoulder.R", pairKey: "shoulder.L", side: "R", color: "#56c5ff" },
      { id: "elbow.L", group: "FRONT LEGS", label: "Left Front Elbow", key: "elbow.L", pairKey: "elbow.R", side: "L", color: "#f0d950" },
      { id: "elbow.R", group: "FRONT LEGS", label: "Right Front Elbow", key: "elbow.R", pairKey: "elbow.L", side: "R", color: "#f0d950" },
      { id: "paw.front.L", group: "FRONT PAWS", label: "Left Front Paw", key: "hand.L", pairKey: "hand.R", side: "L", color: "#8bdc3f" },
      { id: "paw.front.R", group: "FRONT PAWS", label: "Right Front Paw", key: "hand.R", pairKey: "hand.L", side: "R", color: "#8bdc3f" },
      { id: "knee.L", group: "HIND LEGS", label: "Left Hind Knee", key: "knee.L", pairKey: "knee.R", side: "L", color: "#ff9c32" },
      { id: "knee.R", group: "HIND LEGS", label: "Right Hind Knee", key: "knee.R", pairKey: "knee.L", side: "R", color: "#ff9c32" },
      { id: "ankle.L", group: "HIND LEGS", label: "Left Hind Hock", key: "ankle.L", pairKey: "ankle.R", side: "L", color: "#42f5e9" },
      { id: "ankle.R", group: "HIND LEGS", label: "Right Hind Hock", key: "ankle.R", pairKey: "ankle.L", side: "R", color: "#42f5e9" },
      { id: "paw.back.L", group: "HIND PAWS", label: "Left Hind Paw", key: "foot.L", pairKey: "foot.R", side: "L", color: "#52b2ff" },
      { id: "paw.back.R", group: "HIND PAWS", label: "Right Hind Paw", key: "foot.R", pairKey: "foot.L", side: "R", color: "#52b2ff" },
      { id: "tail.base", group: "TAIL", label: "Tail Base", key: "tail.base", color: "#c77dff" }
    ],
    bird: [
      { id: "beak", group: "HEAD", label: "Beak", key: "head", color: "#33d6d3" },
      { id: "chest", group: "TORSO", label: "Chest", key: "chest", color: "#ef5d93" },
      { id: "hips", group: "TORSO", label: "Hips", key: "hips", color: "#f58d5e" },
      { id: "wing.L", group: "WINGS", label: "Left Wing Root", key: "shoulder.L", pairKey: "shoulder.R", side: "L", color: "#56c5ff" },
      { id: "wing.R", group: "WINGS", label: "Right Wing Root", key: "shoulder.R", pairKey: "shoulder.L", side: "R", color: "#56c5ff" },
      { id: "wing.tip.L", group: "WINGS", label: "Left Wing Tip", key: "hand.L", pairKey: "hand.R", side: "L", color: "#8bdc3f" },
      { id: "wing.tip.R", group: "WINGS", label: "Right Wing Tip", key: "hand.R", pairKey: "hand.L", side: "R", color: "#8bdc3f" },
      { id: "knee.L", group: "LEGS", label: "Left Bird Knee", key: "knee.L", pairKey: "knee.R", side: "L", color: "#ff9c32" },
      { id: "knee.R", group: "LEGS", label: "Right Bird Knee", key: "knee.R", pairKey: "knee.L", side: "R", color: "#ff9c32" },
      { id: "ankle.L", group: "LEGS", label: "Left Bird Ankle", key: "ankle.L", pairKey: "ankle.R", side: "L", color: "#42f5e9" },
      { id: "ankle.R", group: "LEGS", label: "Right Bird Ankle", key: "ankle.R", pairKey: "ankle.L", side: "R", color: "#42f5e9" },
      { id: "foot.L", group: "FEET", label: "Left Foot", key: "foot.L", pairKey: "foot.R", side: "L", color: "#52b2ff" },
      { id: "foot.R", group: "FEET", label: "Right Foot", key: "foot.R", pairKey: "foot.L", side: "R", color: "#52b2ff" },
      { id: "tail.base", group: "TAIL", label: "Tail Base", key: "tail.base", color: "#c77dff" }
    ],
    shark: [
      { id: "snout", group: "HEAD", label: "Snout", key: "head", color: "#33d6d3" },
      { id: "dorsal", group: "SPINE", label: "Dorsal Fin", key: "chest", color: "#ef5d93" },
      { id: "fin.L", group: "FINS", label: "Left Pectoral Fin", key: "shoulder.L", pairKey: "shoulder.R", side: "L", color: "#56c5ff" },
      { id: "fin.R", group: "FINS", label: "Right Pectoral Fin", key: "shoulder.R", pairKey: "shoulder.L", side: "R", color: "#56c5ff" },
      { id: "body.mid", group: "SPINE", label: "Mid Body", key: "hips", color: "#f58d5e" },
      { id: "tail.base", group: "TAIL", label: "Tail Base", key: "tail.base", color: "#c77dff" },
      { id: "tail.mid", group: "TAIL", label: "Tail Mid", key: "tail.mid", color: "#8bdc3f" },
      { id: "tail.tip", group: "TAIL", label: "Tail Tip", key: "tail.tip", color: "#52b2ff" }
    ],
    basic_bones: [
      { id: "bone.root", group: "BONES", label: "Root Bone", key: "bone.root", color: "#33d6d3" },
      { id: "bone.01", group: "BONES", label: "Bone 1", key: "bone.01", color: "#56c5ff" },
      { id: "bone.02", group: "BONES", label: "Bone 2", key: "bone.02", color: "#8bdc3f" },
      { id: "bone.03", group: "BONES", label: "Bone 3", key: "bone.03", color: "#f0d950" },
      { id: "bone.04", group: "BONES", label: "Bone 4", key: "bone.04", color: "#ff9c32" },
      { id: "bone.05", group: "BONES", label: "Bone 5", key: "bone.05", color: "#42f5e9" }
    ]
  };
  const AUTO_RIG_ADVANCED_HUMAN_MARKERS = [
    { id: "eye.L", group: "FACE", label: "Left Eye", key: "eye.L", pairKey: "eye.R", side: "L", color: "#c77dff" },
    { id: "eye.R", group: "FACE", label: "Right Eye", key: "eye.R", pairKey: "eye.L", side: "R", color: "#c77dff" },
    { id: "teeth.top", group: "TEETH", label: "Upper Teeth", key: "teeth.top", color: "#f8f7d8" },
    { id: "teeth.bottom", group: "TEETH", label: "Lower Teeth", key: "teeth.bottom", color: "#f8f7d8" },
    { id: "tongue", group: "TONGUE", label: "Tongue", key: "tongue", color: "#ff7aa8" }
  ];

  function normalizeAutoRigProfile(profile) {
    const raw = String(profile || "").trim().toLowerCase();
    if (!raw || raw === "auto" || raw === "basic_human" || raw === "human") return "human";
    if (raw === "cat" || raw === "wolf" || raw === "horse" || raw === "basic_quadruped") return raw;
    if (raw === "bird" || raw === "shark" || raw === "basic_bones") return raw;
    return "human";
  }

  function getSelectedAutoRigProfile(fallback) {
    return normalizeAutoRigProfile(document.getElementById("model3d-autorig-lod-select")?.value || fallback || state.model3dAutoRigVerification?.rigProfile || "auto");
  }

  function getAutoRigMarkerDefinitions(profile) {
    const normalized = normalizeAutoRigProfile(profile || state.model3dAutoRigVerification?.rigProfile || "auto");
    const baseMarkers = normalized === "cat" || normalized === "wolf" || normalized === "horse" || normalized === "basic_quadruped"
      ? AUTO_RIG_MARKER_PROFILES.quadruped
      : AUTO_RIG_MARKER_PROFILES[normalized] || AUTO_RIG_MARKER_PROFILES.human;
    if (normalized !== "human" || state.model3dAutoRigMode !== "advanced") return baseMarkers;
    return baseMarkers.concat(AUTO_RIG_ADVANCED_HUMAN_MARKERS);
  }

  function readAutoRigVerificationLandmarksFromUi() {
    const verification = state.model3dAutoRigVerification;
    return verification && verification.landmarks ? JSON.parse(JSON.stringify(verification.landmarks)) : {};
  }

  function getAutoRigFrontPreviewImage(payload) {
    const images = Array.isArray(payload?.previewImages) ? payload.previewImages : [];
    return images.find(image => image.view === "front") || images[0] || null;
  }
  function getAutoRigMultiViewFrontFileName(selected) {
    const fileNames = Array.isArray(selected?.multiViewFileNames)
      ? selected.multiViewFileNames.map(fileName => String(fileName || "").trim()).filter(Boolean)
      : [];
    return fileNames.find(fileName => /(^|[-_.])front([-_.]|$)/i.test(fileName)) || fileNames[0] || "";
  }
  function getAutoRigMultiViewFrontUrl(selected) {
    const urls = Array.isArray(selected?.multiViewUrls)
      ? selected.multiViewUrls.map(url => String(url || "").trim()).filter(Boolean)
      : [];
    const explicitFrontUrl = urls.find(url => /(^|[-_.])front([-_.]|$)/i.test(url));
    if (explicitFrontUrl) {
      return buildAbsoluteDashboardUrl(explicitFrontUrl);
    }
    if (urls[0]) {
      return buildAbsoluteDashboardUrl(urls[0]);
    }
    const fileName = getAutoRigMultiViewFrontFileName(selected);
    return fileName && selected?.id ? buildAbsoluteDashboardUrl(getModel3dFileUrl(selected.id, fileName)) : "";
  }
  function mergeAutoRigFrontPreviewFromSelected(verification, selected) {
    const multiViewFrontUrl = getAutoRigMultiViewFrontUrl(selected);
    if (!verification || !multiViewFrontUrl) {
      return verification;
    }
    const previewImages = Array.isArray(verification.previewImages) ? verification.previewImages.slice() : [];
    const frontIndex = previewImages.findIndex(image => image?.view === "front");
    const frontImage = { ...(frontIndex >= 0 ? previewImages[frontIndex] : {}), view: "front", dataUrl: multiViewFrontUrl, source: "multi-view" };
    if (frontIndex >= 0) {
      previewImages[frontIndex] = frontImage;
    } else {
      previewImages.unshift(frontImage);
    }
    return { ...verification, previewImages };
  }
  function buildAutoRigFallbackLandmarks(profile) {
    const normalized = normalizeAutoRigProfile(profile);
    if (normalized === "cat" || normalized === "wolf" || normalized === "basic_quadruped") {
      return {
        head: [0, 1.22, 1.86],
        chest: [0, 1.04, 1.28],
        hips: [0, 0.92, 0.54],
        "shoulder.L": [-0.34, 1.06, 1.26],
        "shoulder.R": [0.34, 1.06, 1.26],
        "elbow.L": [-0.44, 0.8, 0.9],
        "elbow.R": [0.44, 0.8, 0.9],
        "hand.L": [-0.46, 0.24, 0.24],
        "hand.R": [0.46, 0.24, 0.24],
        "knee.L": [-0.28, 0.72, 0.44],
        "knee.R": [0.28, 0.72, 0.44],
        "ankle.L": [-0.26, 0.24, -0.02],
        "ankle.R": [0.26, 0.24, -0.02],
        "foot.L": [-0.26, 0.08, -0.22],
        "foot.R": [0.26, 0.08, -0.22],
        "tail.base": [0, 0.96, 0.08]
      };
    }
    if (normalized === "horse") {
      return {
        head: [0, 1.56, 2.08],
        chest: [0, 1.3, 1.42],
        hips: [0, 1.18, 0.56],
        "shoulder.L": [-0.36, 1.3, 1.38],
        "shoulder.R": [0.36, 1.3, 1.38],
        "elbow.L": [-0.42, 0.92, 0.92],
        "elbow.R": [0.42, 0.92, 0.92],
        "hand.L": [-0.42, 0.1, 0.14],
        "hand.R": [0.42, 0.1, 0.14],
        "knee.L": [-0.26, 0.88, 0.5],
        "knee.R": [0.26, 0.88, 0.5],
        "ankle.L": [-0.24, 0.18, -0.04],
        "ankle.R": [0.24, 0.18, -0.04],
        "foot.L": [-0.24, 0.04, -0.18],
        "foot.R": [0.24, 0.04, -0.18],
        "tail.base": [0, 1.2, 0.08]
      };
    }
    if (normalized === "bird") {
      return {
        head: [0, 1.62, 1.88],
        chest: [0, 1.26, 1.14],
        hips: [0, 0.94, 0.48],
        "shoulder.L": [-0.38, 1.34, 1.22],
        "shoulder.R": [0.38, 1.34, 1.22],
        "hand.L": [-0.82, 1.12, 0.92],
        "hand.R": [0.82, 1.12, 0.92],
        "knee.L": [-0.18, 0.62, 0.44],
        "knee.R": [0.18, 0.62, 0.44],
        "ankle.L": [-0.16, 0.26, 0.08],
        "ankle.R": [0.16, 0.26, 0.08],
        "foot.L": [-0.14, 0.02, -0.22],
        "foot.R": [0.14, 0.02, -0.22],
        "tail.base": [0, 0.96, 0.12]
      };
    }
    if (normalized === "shark") {
      return {
        head: [0, 0.82, 1.92],
        chest: [0, 0.9, 1.22],
        hips: [0, 0.8, 0.62],
        "shoulder.L": [-0.46, 0.82, 1.04],
        "shoulder.R": [0.46, 0.82, 1.04],
        "tail.base": [0, 0.74, 0.28],
        "tail.mid": [0, 0.68, -0.22],
        "tail.tip": [0, 0.62, -0.82]
      };
    }
    if (normalized === "basic_bones") {
      return {
        "bone.root": [0, 1.02, 0.72],
        "bone.01": [0, 1.22, 1.04],
        "bone.02": [0, 1.34, 1.42],
        "bone.03": [0.18, 1.18, 0.96],
        "bone.04": [-0.18, 1.18, 0.96],
        "bone.05": [0, 0.86, 0.28]
      };
    }
    return {
      head: [0, 1.76, 1.84],
      neck: [0, 1.54, 1.5],
      chest: [0, 1.34, 1.12],
      hips: [0, 1.02, 0.68],
      "shoulder.L": [-0.36, 1.48, 1.4],
      "shoulder.R": [0.36, 1.48, 1.4],
      "elbow.L": [-0.58, 1.27, 1.12],
      "elbow.R": [0.58, 1.27, 1.12],
      "hand.L": [-0.72, 1.05, 0.82],
      "hand.R": [0.72, 1.05, 0.82],
      "knee.L": [-0.2, 0.58, 0.28],
      "knee.R": [0.2, 0.58, 0.28],
      "ankle.L": [-0.18, 0.08, 0.02],
      "ankle.R": [0.18, 0.08, 0.02],
      "foot.L": [-0.18, 0.02, -0.18],
      "foot.R": [0.18, 0.02, -0.18],
      "eye.L": [-0.09, 1.72, 1.78],
      "eye.R": [0.09, 1.72, 1.78],
      "teeth.top": [0, 1.63, 1.72],
      "teeth.bottom": [0, 1.58, 1.68],
      tongue: [0, 1.52, 1.62]
    };
  }

  function getAutoRigFallbackClassification(profile) {
    const normalized = normalizeAutoRigProfile(profile);
    if (normalized === "cat") return { creature_type: "quadruped", animal: "cat" };
    if (normalized === "wolf") return { creature_type: "quadruped", animal: "wolf" };
    if (normalized === "horse") return { creature_type: "quadruped", animal: "horse" };
    if (normalized === "basic_quadruped") return { creature_type: "quadruped", animal: "none" };
    if (normalized === "bird") return { creature_type: "avian", animal: "bird" };
    if (normalized === "shark") return { creature_type: "aquatic", animal: "shark" };
    if (normalized === "basic_bones") return { creature_type: "custom", animal: "none" };
    return { creature_type: "humanoid", animal: "none" };
  }
  function resolveAutoRigFallbackPreviewUrl(selected) {
    const multiViewFrontUrl = getAutoRigMultiViewFrontUrl(selected);
    if (multiViewFrontUrl) {
      return multiViewFrontUrl;
    }
    const directCandidates = [
      selected?.previewImageUrl,
      selected?.previewGifUrl,
      selected?.sourceImageUrl,
      selected?.lowPolyPreviewImageUrl,
      selected?.lowPolyPreviewGifUrl
    ];
    for (const candidate of directCandidates) {
      const normalized = String(candidate || "").trim();
      if (normalized) {
        return buildAbsoluteDashboardUrl(normalized);
      }
    }
    const fileNameCandidates = [
      selected?.previewImageFileName,
      selected?.previewGifFileName,
      selected?.sourceImageFileName,
      selected?.lowPolyPreviewImageFileName,
      selected?.lowPolyPreviewGifFileName
    ];
    for (const candidate of fileNameCandidates) {
      const fileName = String(candidate || "").trim();
      if (fileName && selected?.id) {
        return buildAbsoluteDashboardUrl(getModel3dFileUrl(selected.id, fileName));
      }
    }
    return "";
  }
  function buildAutoRigFallbackVerification(selected) {
    const previewUrl = resolveAutoRigFallbackPreviewUrl(selected);
    const rigProfile = getSelectedAutoRigProfile("basic_human");
    return {
      modelId: selected?.id || "",
      rigProfile,
      classification: getAutoRigFallbackClassification(rigProfile),
      markerProjection: { centerX: 0, centerZ: 0.84, orthoScale: 2.1 },
      landmarks: buildAutoRigFallbackLandmarks(rigProfile),
      previewImages: previewUrl ? [{ view: "front", dataUrl: previewUrl }] : []
    };
  }

  function getAutoRigLandmarkBounds(landmarks) {
    const points = Object.values(landmarks || {}).filter(value => Array.isArray(value) && value.length === 3);
    const xs = points.map(value => Number(value[0])).filter(Number.isFinite);
    const zs = points.map(value => Number(value[2])).filter(Number.isFinite);
    if (xs.length === 0 || zs.length === 0) {
      return { minX: -1, maxX: 1, minZ: 0, maxZ: 2, centerX: 0 };
    }
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minZ = Math.min(...zs);
    const maxZ = Math.max(...zs);
    const spanX = Math.max(0.001, maxX - minX);
    const spanZ = Math.max(0.001, maxZ - minZ);
    return {
      minX: minX - spanX * 0.22,
      maxX: maxX + spanX * 0.22,
      minZ: minZ - spanZ * 0.08,
      maxZ: maxZ + spanZ * 0.08,
      centerX: [landmarks?.hips?.[0], landmarks?.chest?.[0], landmarks?.neck?.[0], landmarks?.["bone.root"]?.[0], landmarks?.head?.[0]]
        .map(value => Number(value))
        .filter(Number.isFinite)
        .reduce((sum, value, _, values) => sum + (value / Math.max(1, values.length)), 0)
    };
  }

  function getAutoRigProjection(verification) {
    const raw = verification && verification.markerProjection ? verification.markerProjection : null;
    const centerX = Number(raw?.centerX);
    const centerZ = Number(raw?.centerZ);
    const orthoScale = Number(raw?.orthoScale);
    if (Number.isFinite(centerX) && Number.isFinite(centerZ) && Number.isFinite(orthoScale) && orthoScale > 0) {
      return { centerX, centerZ, orthoScale };
    }
    const bounds = getAutoRigLandmarkBounds(verification?.landmarks || {});
    return {
      centerX: (bounds.minX + bounds.maxX) * 0.5,
      centerZ: (bounds.minZ + bounds.maxZ) * 0.5,
      orthoScale: Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ, 0.001)
    };
  }

  function getAutoRigStageImageFrame(stage) {
    const image = stage ? stage.querySelector(".model3d-autorig-main-image") : null;
    const stageRect = stage ? stage.getBoundingClientRect() : { width: 1, height: 1, left: 0, top: 0 };
    if (!image) {
      const stageWidth = Math.max(1, stageRect.width || 1);
      const stageHeight = Math.max(1, stageRect.height || 1);
      return {
        left: 0,
        top: 0,
        width: stageWidth,
        height: stageHeight,
        stageWidth,
        stageHeight,
        viewportLeft: stageRect.left,
        viewportTop: stageRect.top
      };
    }
    const naturalWidth = Math.max(1, image?.naturalWidth || 1);
    const naturalHeight = Math.max(1, image?.naturalHeight || naturalWidth);
    const stageWidth = Math.max(1, stageRect.width || 1);
    const stageHeight = Math.max(1, stageRect.height || 1);
    const imageAspect = naturalWidth / naturalHeight;
    const stageAspect = stageWidth / stageHeight;
    const width = imageAspect > stageAspect ? stageWidth : stageHeight * imageAspect;
    const height = imageAspect > stageAspect ? stageWidth / imageAspect : stageHeight;
    return {
      left: (stageWidth - width) * 0.5,
      top: (stageHeight - height) * 0.5,
      width,
      height,
      stageWidth,
      stageHeight,
      viewportLeft: stageRect.left,
      viewportTop: stageRect.top
    };
  }

  function autoRigMarkerPosition(marker, verification, stage) {
    const landmarks = verification?.landmarks || {};
    const projection = getAutoRigProjection(verification);
    const imageFrame = getAutoRigStageImageFrame(stage);
    const value = landmarks?.[marker.key];
    if (!Array.isArray(value)) {
      return { x: 0.5, y: 0.5 };
    }
    const xInImage = 0.5 + ((Number(value[0]) - projection.centerX) / projection.orthoScale);
    const yInImage = 0.5 - ((Number(value[2]) - projection.centerZ) / projection.orthoScale);
    const x = (imageFrame.left + Math.max(0, Math.min(1, xInImage)) * imageFrame.width) / imageFrame.stageWidth;
    const y = (imageFrame.top + Math.max(0, Math.min(1, yInImage)) * imageFrame.height) / imageFrame.stageHeight;
    return {
      x: Math.max(0.01, Math.min(0.99, x)),
      y: Math.max(0.01, Math.min(0.99, y))
    };
  }

  function renderAutoRigMarkerRail(payload) {
    const rail = document.getElementById("model3d-autorig-marker-rail");
    if (!rail) {
      return;
    }
    const groups = [];
    for (const marker of getAutoRigMarkerDefinitions(payload?.rigProfile)) {
      if (!payload.landmarks?.[marker.key]) {
        continue;
      }
      let group = groups.find(entry => entry.label === marker.group);
      if (!group) {
        group = { label: marker.group, markers: [] };
        groups.push(group);
      }
      group.markers.push(marker);
    }
    rail.innerHTML = groups.map(group => (
      "<div class='model3d-autorig-marker-group'>"
      + "<span>" + escapeHtml(group.label) + "</span>"
      + "<div class='model3d-autorig-marker-dots'>"
      + group.markers.map(marker => "<button type='button' data-autorig-focus-marker='" + escapeHtml(marker.id) + "' style='--marker-color:" + escapeHtml(marker.color) + "' aria-label='" + escapeHtml(marker.label) + "'></button>").join("")
      + "</div></div>"
    )).join("");
    rail.querySelectorAll("[data-autorig-focus-marker]").forEach(button => {
      button.addEventListener("click", () => {
        const marker = document.querySelector("[data-autorig-marker='" + CSS.escape(button.getAttribute("data-autorig-focus-marker") || "") + "']");
        marker?.classList.add("pulse");
        window.setTimeout(() => marker?.classList.remove("pulse"), 700);
      });
    });
  }

  function getAutoRigDebugPayload(useVision) {
    const selected = getSelectedGeneratedModel();
    const landmarks = readAutoRigVerificationLandmarksFromUi();
    return {
      modelId: selected?.id || "",
      modelFileName: selected?.modelFileName || "",
      rigProfile: document.getElementById("model3d-autorig-lod-select")?.value || state.model3dAutoRigVerification?.rigProfile || "auto",
      useVision: useVision === true,
      mode: state.model3dAutoRigMode || "basic",
      advancedOptions: {
        face: document.getElementById("model3d-autorig-advanced-face")?.checked === true,
        teeth: document.getElementById("model3d-autorig-advanced-teeth")?.checked === true,
        tongue: document.getElementById("model3d-autorig-advanced-tongue")?.checked === true,
        eyes: document.getElementById("model3d-autorig-advanced-eyes")?.checked === true
      },
      landmarks
    };
  }

  function renderAutoRigDebugPayload(useVision) {
    const output = document.getElementById("model3d-autorig-debug-output");
    if (!output) {
      return;
    }
    output.textContent = JSON.stringify(getAutoRigDebugPayload(useVision), null, 2);
  }

  function revealAutoRigPanelUi() {
    switchModel3dStudioTab("rigging");
    setWorkflowRightSidebarCollapsed("model3d", false, { persist: false });
    const workspaceNode = document.querySelector("[data-workflow-sidebar-workspace=\"model3d\"]");
    const panelNode = document.querySelector("[data-workflow-sidebar-panel=\"model3d\"]");
    const resizerNode = document.querySelector("[data-workflow-sidebar-resizer=\"model3d\"]");
    if (workspaceNode) {
      workspaceNode.classList.remove("workflow-side-collapsed");
    }
    if (panelNode) {
      panelNode.classList.remove("hidden");
      panelNode.setAttribute("aria-hidden", "false");
    }
    if (resizerNode) {
      resizerNode.classList.remove("hidden");
    }
    const cardNode = document.getElementById("model3d-autorig-verification-card");
    const foldoutNode = cardNode?.closest?.("details.studio-side-foldout");
    if (foldoutNode) {
      foldoutNode.open = true;
    }
  }

  function setAutoRigMode(mode) {
    state.model3dAutoRigMode = mode === "advanced" ? "advanced" : "basic";
    document.querySelectorAll("[data-autorig-tab]").forEach(button => {
      button.classList.toggle("active", String(button.getAttribute("data-autorig-tab") || "") === state.model3dAutoRigMode);
    });
    document.querySelectorAll("[data-autorig-panel]").forEach(panel => {
      panel.classList.toggle("hidden", String(panel.getAttribute("data-autorig-panel") || "") !== state.model3dAutoRigMode);
    });
    const lod = document.getElementById("model3d-autorig-lod-select");
    if (lod) {
      Array.from(lod.options).forEach(option => {
        option.hidden = option.getAttribute("data-autorig-advanced-option") === "true" && state.model3dAutoRigMode !== "advanced";
      });
      if (state.model3dAutoRigMode !== "advanced" && lod.value === "human") {
        lod.value = "basic_human";
      }
    }
    renderAutoRigDebugPayload(false);
    renderAutoRigMarkerRail(state.model3dAutoRigVerification || {});
    positionAutoRigMarkers();
  }

  function applyAutoRigProfileSelection(nextProfile) {
    const verification = state.model3dAutoRigVerification;
    if (!verification) return;
    const rigProfile = normalizeAutoRigProfile(nextProfile);
    const fallbackLandmarks = buildAutoRigFallbackLandmarks(rigProfile);
    const allowedKeys = new Set(getAutoRigMarkerDefinitions(rigProfile).map(marker => String(marker.key || "")));
    const preservedLandmarks = Object.fromEntries(Object.entries(verification.landmarks || {}).filter(([key]) => allowedKeys.has(String(key || ""))));
    verification.rigProfile = rigProfile;
    verification.classification = getAutoRigFallbackClassification(rigProfile);
    verification.landmarks = { ...fallbackLandmarks, ...preservedLandmarks };
    renderAutoRigVerification(verification);
  }

  function bindAutoRigControls() {
    const lod = document.getElementById("model3d-autorig-lod-select");
    if (lod && lod.dataset.bound !== "true") {
      lod.dataset.bound = "true";
      lod.addEventListener("change", () => applyAutoRigProfileSelection(lod.value || "auto"));
    }
  }

  function updateAutoRigMarkerFromPointer(markerId, clientX, clientY) {
    const verification = state.model3dAutoRigVerification;
    const marker = getAutoRigMarkerDefinitions(verification?.rigProfile).find(entry => entry.id === markerId);
    const stage = document.getElementById("model3d-autorig-stage");
    if (!verification || !marker || !stage || !verification.landmarks?.[marker.key]) {
      return;
    }
    const rect = stage.getBoundingClientRect();
    const imageFrame = getAutoRigStageImageFrame(stage);
    const projection = getAutoRigProjection(verification);
    const xStage = clientX - rect.left;
    const yStage = clientY - rect.top;
    const xNorm = Math.max(0, Math.min(1, (xStage - imageFrame.left) / Math.max(1, imageFrame.width)));
    const yNorm = Math.max(0, Math.min(1, (yStage - imageFrame.top) / Math.max(1, imageFrame.height)));
    const value = verification.landmarks[marker.key];
    const nextX = projection.centerX + (xNorm - 0.5) * projection.orthoScale;
    const nextZ = projection.centerZ + (0.5 - yNorm) * projection.orthoScale;
    const deltaX = nextX - value[0];
    const deltaZ = nextZ - value[2];
    verification.landmarks[marker.key] = [nextX, value[1], nextZ];
    if (marker.key === "neck" && Array.isArray(verification.landmarks.head)) {
      const head = verification.landmarks.head;
      verification.landmarks.head = [head[0] + deltaX, head[1], head[2] + deltaZ];
    }
    const useSymmetry = document.getElementById("model3d-autorig-symmetry")?.checked !== false;
    if (useSymmetry && marker.pairKey && verification.landmarks[marker.pairKey]) {
      const pairValue = verification.landmarks[marker.pairKey];
      verification.landmarks[marker.pairKey] = [projection.centerX - (nextX - projection.centerX), pairValue[1], nextZ];
    }
    positionAutoRigMarkers();
  }

  function positionAutoRigMarkers() {
    const verification = state.model3dAutoRigVerification;
    const stage = document.getElementById("model3d-autorig-stage");
    if (!verification || !stage) {
      return;
    }
    getAutoRigMarkerDefinitions(verification.rigProfile).forEach(marker => {
      const node = stage.querySelector("[data-autorig-marker='" + marker.id + "']");
      if (!node) {
        return;
      }
      const pos = autoRigMarkerPosition(marker, verification, stage);
      node.style.left = (pos.x * 100).toFixed(3) + "%";
      node.style.top = (pos.y * 100).toFixed(3) + "%";
    });
  }

  function bindAutoRigStageMarkers() {
    const stage = document.getElementById("model3d-autorig-stage");
    if (!stage) {
      return;
    }
    stage.querySelectorAll("[data-autorig-marker]").forEach(markerNode => {
      markerNode.addEventListener("pointerdown", event => {
        event.preventDefault();
        const markerId = markerNode.getAttribute("data-autorig-marker") || "";
        markerNode.setPointerCapture(event.pointerId);
        markerNode.classList.add("dragging");
        updateAutoRigMarkerFromPointer(markerId, event.clientX, event.clientY);
        const onMove = moveEvent => updateAutoRigMarkerFromPointer(markerId, moveEvent.clientX, moveEvent.clientY);
        const onUp = () => {
          markerNode.classList.remove("dragging");
          markerNode.removeEventListener("pointermove", onMove);
          markerNode.removeEventListener("pointerup", onUp);
          markerNode.removeEventListener("pointercancel", onUp);
        };
        markerNode.addEventListener("pointermove", onMove);
        markerNode.addEventListener("pointerup", onUp);
        markerNode.addEventListener("pointercancel", onUp);
      });
    });
  }

  function renderAutoRigVerification(payload) {
    state.model3dAutoRigVerification = payload || null;
    document.body.classList.toggle("model3d-autorig-open", Boolean(payload));
    state.model3dAutoRigMode = state.model3dAutoRigMode || "basic";
    if (payload) {
      revealAutoRigPanelUi();
    }
    const card = document.getElementById("model3d-autorig-verification-card");
    if (!card) {
      return;
    }
    card.classList.toggle("hidden", !payload);
    if (!payload) {
      return;
    }
    const classification = payload.classification || {};
    const creature = classification.creature_type || "unknown";
    const animal = classification.animal && classification.animal !== "none" ? " / " + classification.animal : "";
    const front = getAutoRigFrontPreviewImage(payload);
    const stage = document.getElementById("model3d-autorig-stage");
    const rigProfile = normalizeAutoRigProfile(payload.rigProfile || "auto");
    if (stage) {
      const markers = getAutoRigMarkerDefinitions(rigProfile).filter(marker => payload.landmarks?.[marker.key]);
      stage.innerHTML = (front
        ? "<img class='model3d-autorig-main-image' src='" + escapeHtml(front.dataUrl || "") + "' alt='AutoRig front marker placement'>"
        : "<div class='model3d-autorig-fallback-stage'><span>Manual Marker Layout</span><small>No preview image was available, so this panel opened with a local marker stage.</small></div>")
        + "<div class='model3d-autorig-centerline'></div>"
        + "<div class='model3d-autorig-profile-chip'>Rig profile: " + escapeHtml(rigProfile) + " | " + escapeHtml(creature + animal) + "</div>"
        + markers.map(marker => "<button class='model3d-autorig-marker' data-autorig-marker='" + escapeHtml(marker.id) + "' type='button' style='--marker-color:" + escapeHtml(marker.color) + "' title='" + escapeHtml(marker.label) + "' aria-label='" + escapeHtml(marker.label) + "'><span></span></button>").join("");
      const mainImage = stage.querySelector(".model3d-autorig-main-image");
      if (mainImage) {
        mainImage.addEventListener("load", positionAutoRigMarkers, { once: true });
      }
    }
    const helpPreview = document.getElementById("model3d-autorig-help-preview");
    if (helpPreview) {
      helpPreview.innerHTML = front ? "<img src='" + escapeHtml(front.dataUrl || "") + "' alt='AutoRig marker reference'>" : "";
    }
    const lod = document.getElementById("model3d-autorig-lod-select");
    if (lod) {
      lod.value = Array.from(lod.options).some(option => option.value === rigProfile) ? rigProfile : "auto";
    }
    bindAutoRigControls();
    renderAutoRigMarkerRail(payload);
    positionAutoRigMarkers();
    bindAutoRigStageMarkers();
    setAutoRigMode(state.model3dAutoRigMode);
    renderAutoRigDebugPayload(false);
  }

  async function runAutoRigPreviewForSelectedModel(options) {
    const selected = getSelectedGeneratedModel();
    if (!selected) {
      return void setOutput("Select a generated model first.");
    }
    const useEditedLandmarks = options && options.useEditedLandmarks;
    const useVision = options && Object.prototype.hasOwnProperty.call(options, "useVision") ? options.useVision === true : !useEditedLandmarks;
    const landmarks = useEditedLandmarks ? readAutoRigVerificationLandmarksFromUi() : undefined;
    setModel3dStatus((useVision ? "Preparing LLM AutoRig preview for " : "Preparing manual AutoRig preview for ") + selected.modelFileName + "...");
    renderAutoRigDebugPayload(useVision);
    try {
      const rigProfile = options && options.useEditedLandmarks ? document.getElementById("model3d-autorig-lod-select")?.value || "auto" : "auto";
      const preview = await request("/api/model3d-autorig-preview", {
        modelId: selected.id,
        rigProfile,
        useVision,
        landmarks,
        executionTarget: document.getElementById("model3d-generation-target")?.value === "remote" ? "remote" : "local"
      });
      if (options && options.useEditedLandmarks && landmarks && preview?.landmarks) {
        preview.landmarks = { ...preview.landmarks, ...landmarks };
      }
      renderAutoRigVerification(preview);
      renderAutoRigDebugPayload(useVision);
      setModel3dStatus((useVision ? "LLM AutoRig preview ready for " : "Manual AutoRig preview ready for ") + selected.modelFileName + ".");
      setOutput("Rig panel is open. Adjust markers, run an optional LLM pass, or finalize the rig.");
    } catch (error) {
      const detail = describeClientError(error, "AutoRig preview failed without an error detail.");
      setModel3dStatus("AutoRig preview failed for selected model.");
      setOutput("Failed to prepare AutoRig preview: " + detail);
    }
  }

  async function openAutoRigPanelForSelectedModel() {
    const selected = getSelectedGeneratedModel();
    if (!selected) {
      return void setOutput("Select a generated model first.");
    }
    if (state.model3dAutoRigVerification && state.model3dAutoRigVerification.modelId === selected.id) {
      renderAutoRigVerification(mergeAutoRigFrontPreviewFromSelected(state.model3dAutoRigVerification, selected));
      setModel3dStatus("Rig panel opened for " + selected.modelFileName + ".");
      setOutput("Rig panel opened with the selected model's multi-view front texture.");
      return;
    }
    renderAutoRigVerification(buildAutoRigFallbackVerification(selected));
    setModel3dStatus("Rig panel opened for " + selected.modelFileName + ".");
    setOutput("Rig panel opened with the selected model's multi-view front texture.");
  }

  async function finalizeAutoRigForSelectedModel() {
    const selected = getSelectedGeneratedModel();
    if (!selected) {
      return void setOutput("Select a generated model first.");
    }
    const landmarks = readAutoRigVerificationLandmarksFromUi();
    setModel3dStatus("Finalizing AutoRig for " + selected.modelFileName + "...");
    try {
      const generated = await request("/api/model3d-autorig", {
        modelId: selected.id,
        rigProfile: document.getElementById("model3d-autorig-lod-select")?.value || state.model3dAutoRigVerification?.rigProfile || "auto",
        useVision: false,
        landmarks,
        executionTarget: document.getElementById("model3d-generation-target")?.value === "remote" ? "remote" : "local"
      });
      await loadModel3dHistory(generated?.id || selected.id);
      renderAutoRigVerification(null);
      setModel3dStatus("AutoRig completed for " + selected.modelFileName + ".");
      setOutput("AutoRig finalized with verified landmark positions for " + selected.modelFileName + ".");
      await refreshState();
    } catch (error) {
      const detail = describeClientError(error, "AutoRig finalization failed without an error detail.");
      setModel3dStatus("AutoRig failed for selected model.");
      setOutput("Failed to finalize AutoRig: " + detail);
    }
  }

  return {
    requestModel3dGenerationWithPreviewStream,
    runModel3dGenerationFromStudio,
    stopModel3dGeneration,
    runModel3dSeparateByLoosePartsForSelectedModel,
    runLowPolyGenerationForSelectedModel,
    runModel3dLlmScaleForSelectedModel,
    renderAutoRigVerification,
    setAutoRigMode,
    openAutoRigPanelForSelectedModel,
    runAutoRigPreviewForSelectedModel,
    finalizeAutoRigForSelectedModel
  };
}
