function createDashboardAutomationStudioHelpers(input) {
  const state = input?.state || {};
  const request = typeof input?.request === "function" ? input.request : async function requestFallback() {
    throw new Error("Dashboard request helper is not available.");
  };
  const clearChildren = typeof input?.clearChildren === "function" ? input.clearChildren : function clearChildrenFallback(node) {
    if (node) {
      node.innerHTML = "";
    }
  };
  const escapeHtml = typeof input?.escapeHtml === "function" ? input.escapeHtml : value => String(value || "");
  const resolveChannelLabel = typeof input?.resolveChannelLabel === "function" ? input.resolveChannelLabel : (channelId, fallback) => fallback || channelId || "No channel selected";
  const normalizeScheduledTargetMessenger = typeof input?.normalizeScheduledTargetMessenger === "function"
    ? input.normalizeScheduledTargetMessenger
    : value => value === "telegram" || value === "matrix" ? value : "discord";
  const normalizeTelegramChatId = typeof input?.normalizeTelegramChatId === "function" ? input.normalizeTelegramChatId : value => String(value || "").trim();
  const normalizeMatrixRoomId = typeof input?.normalizeMatrixRoomId === "function" ? input.normalizeMatrixRoomId : value => String(value || "").trim();
  const formatImagePostProcessingRecipes = typeof input?.formatImagePostProcessingRecipes === "function" ? input.formatImagePostProcessingRecipes : () => "";
  const parseImagePostProcessingRecipes = typeof input?.parseImagePostProcessingRecipes === "function" ? input.parseImagePostProcessingRecipes : () => [];
  const getModel3dInitialExtraSampleText = typeof input?.getModel3dInitialExtraSampleText === "function" ? input.getModel3dInitialExtraSampleText : () => "";
  const getModel3dDestinationExtraSampleText = typeof input?.getModel3dDestinationExtraSampleText === "function" ? input.getModel3dDestinationExtraSampleText : () => "";
  const getScheduledModelPostOptionsModule = typeof input?.getScheduledModelPostOptionsModule === "function" ? input.getScheduledModelPostOptionsModule : () => null;
  const getAutomationScopeId = typeof input?.getAutomationScopeId === "function" ? input.getAutomationScopeId : () => "";
  const setMultiSelectValues = typeof input?.setMultiSelectValues === "function" ? input.setMultiSelectValues : function setMultiSelectValuesFallback() {};
  const getMultiSelectValues = typeof input?.getMultiSelectValues === "function" ? input.getMultiSelectValues : () => [];
  const switchScheduledTriggerMode = typeof input?.switchScheduledTriggerMode === "function" ? input.switchScheduledTriggerMode : function switchScheduledTriggerModeFallback() {};
  const switchScheduleMode = typeof input?.switchScheduleMode === "function" ? input.switchScheduleMode : function switchScheduleModeFallback() {};
  const parseCronToBasic = typeof input?.parseCronToBasic === "function" ? input.parseCronToBasic : () => null;
  const updateScheduledSourceFields = typeof input?.updateScheduledSourceFields === "function" ? input.updateScheduledSourceFields : function updateScheduledSourceFieldsFallback() {};
  const updateScheduledModelPostOptionsUi = typeof input?.updateScheduledModelPostOptionsUi === "function" ? input.updateScheduledModelPostOptionsUi : function updateScheduledModelPostOptionsUiFallback() {};
  const updateJoinSourceFields = typeof input?.updateJoinSourceFields === "function" ? input.updateJoinSourceFields : function updateJoinSourceFieldsFallback() {};
  const updateAutomationTargetChips = typeof input?.updateAutomationTargetChips === "function" ? input.updateAutomationTargetChips : function updateAutomationTargetChipsFallback() {};
  const setOutput = typeof input?.setOutput === "function" ? input.setOutput : function setOutputFallback() {};
  const setElementValue = typeof input?.setElementValue === "function" ? input.setElementValue : function setElementValueFallback() {};
  const setElementChecked = typeof input?.setElementChecked === "function" ? input.setElementChecked : function setElementCheckedFallback() {};

  function readValue(id) {
    const node = document.getElementById(id);
    return node && typeof node.value === "string" ? node.value : "";
  }

  function readTrimmedValue(id) {
    return readValue(id).trim();
  }

  function readChecked(id) {
    return document.getElementById(id)?.checked === true;
  }

  function readInteger(id, fallback) {
    return Number.parseInt(readValue(id), 10) || fallback;
  }

  function bindClick(id, handler) {
    const node = document.getElementById(id);
    if (node) {
      node.addEventListener("click", handler);
    }
  }

  async function loadUrageNetMediaGallerySettings() {
    const settings = await request("/api/automation/uragenet-media-gallery-settings");
    setElementValue("uragenet-media-gallery-url", settings.baseUrl || "");
    setElementValue("uragenet-media-gallery-username", settings.username || "");
    const status = document.getElementById("uragenet-media-gallery-settings-status");
    if (status) status.textContent = settings.passwordConfigured ? "Application password saved securely." : "Application password not configured.";
  }

  async function saveUrageNetMediaGallerySettingsFromUi() {
    const saved = await request("/api/automation/uragenet-media-gallery-settings", {
      baseUrl: readTrimmedValue("uragenet-media-gallery-url"),
      username: readTrimmedValue("uragenet-media-gallery-username"),
      password: readValue("uragenet-media-gallery-password")
    });
    setElementValue("uragenet-media-gallery-password", "");
    const status = document.getElementById("uragenet-media-gallery-settings-status");
    if (status) status.textContent = saved.passwordConfigured ? "Saved. Application password is stored securely on this machine." : "Saved URL and username.";
  }

  function bindChange(id, handler) {
    const node = document.getElementById(id);
    if (node) {
      node.addEventListener("change", handler);
    }
  }

  function getAutomationTextFiles(action) {
    if (Array.isArray(action?.textFiles) && action.textFiles.length > 0) {
      return action.textFiles;
    }
    return action?.jokesFile ? [action.jokesFile] : ["jokes.txt"];
  }

  function renderScheduledAutomationList() {
    const container = document.getElementById("scheduled-automation-list");
    if (!container) {
      return;
    }
    clearChildren(container);
    if (!state.scheduledAutomations || state.scheduledAutomations.length === 0) {
      const empty = document.createElement("div");
      empty.className = "item";
      empty.textContent = "No scheduled jobs yet.";
      container.appendChild(empty);
      return;
    }
    for (const item of state.scheduledAutomations) {
      const row = document.createElement("button");
      row.className = "bot-message-row" + (item.id === state.selectedScheduledAutomationId ? " active" : "");
      row.innerHTML =
        "<div class='bot-message-row-title'><strong>" + escapeHtml(item.name || "Untitled") + "</strong><span class='bot-message-row-tag'>" + (item.enabled ? "Enabled" : "Disabled") + "</span></div>"
        + "<div class='bot-message-row-meta'>" + escapeHtml(resolveChannelLabel(item.channelId, item.channelId || "No channel", item.targetMessenger)) + " | " + escapeHtml(item.triggerMode === "interval" ? "Every " + item.intervalValue + " " + item.intervalUnit : item.cron || "cron") + "</div>";
      row.addEventListener("click", () => {
        setScheduledForm(item);
      });
      container.appendChild(row);
    }
  }

  function renderJoinAutomationList() {
    const container = document.getElementById("join-automation-list");
    if (!container) {
      return;
    }
    clearChildren(container);
    if (!state.joinAutomations || state.joinAutomations.length === 0) {
      const empty = document.createElement("div");
      empty.className = "item";
      empty.textContent = "No join actions yet.";
      container.appendChild(empty);
      return;
    }
    for (const item of state.joinAutomations) {
      const row = document.createElement("button");
      row.className = "bot-message-row" + (item.id === state.selectedJoinAutomationId ? " active" : "");
      row.innerHTML =
        "<div class='bot-message-row-title'><strong>" + escapeHtml(item.name || "Untitled") + "</strong><span class='bot-message-row-tag'>" + (item.enabled ? "Enabled" : "Disabled") + "</span></div>"
        + "<div class='bot-message-row-meta'>" + escapeHtml(resolveChannelLabel(item.channelId, item.channelId || "No channel")) + " | " + escapeHtml("Delay " + (item.delaySeconds || 0) + "s") + "</div>";
      row.addEventListener("click", () => {
        setJoinForm(item);
      });
      container.appendChild(row);
    }
  }

  function setScheduledForm(value) {
    const entry = value || null;
    const action = entry?.action || {};
    state.selectedScheduledAutomationId = entry?.id || "";
    state.scheduledTargetMessenger = entry
      ? normalizeScheduledTargetMessenger(entry.targetMessenger)
      : normalizeScheduledTargetMessenger(state.scheduledTargetMessenger);
    state.scheduledTargetChannelId = entry?.channelId
      || (state.scheduledTargetMessenger === "telegram"
        ? (state.selectedTelegramChatId || state.scheduledTargetChannelId || "")
        : state.scheduledTargetMessenger === "matrix"
          ? (state.selectedMatrixRoomId || state.scheduledTargetChannelId || "")
          : (state.selectedChannelId || state.scheduledTargetChannelId || ""));
    setElementValue("scheduled-target-messenger-select", state.scheduledTargetMessenger);
    setElementValue("scheduled-target-telegram-chat-id", state.scheduledTargetMessenger === "telegram" ? state.scheduledTargetChannelId : "");
    setElementValue("scheduled-target-matrix-room-id", state.scheduledTargetMessenger === "matrix" ? state.scheduledTargetChannelId : "");
    setElementValue("scheduled-name", entry?.name || "");
    setElementChecked("scheduled-enabled", entry ? entry.enabled !== false : true);
    setElementValue("scheduled-cron", entry?.cron || "0 9 * * *");
    setElementValue("scheduled-interval-value", String(entry?.intervalValue || 1));
    setElementValue("scheduled-interval-unit", entry?.intervalUnit || "days");
    setElementValue("scheduled-repeat-count", String(entry?.repeatCount || 1));
    setElementValue("scheduled-repeat-delay-seconds", String(Number.isFinite(entry?.repeatDelaySeconds) ? entry.repeatDelaySeconds : 0));
    setElementValue("scheduled-source", action.source || "template");
    setElementValue("scheduled-prompt", action.prompt || "");
    setElementValue("scheduled-prompt-text-file", action.promptTextFile || "");
    setElementChecked("scheduled-text-source-no-repeat", action.textSourceSelectionMode === "no-repeat");
    setElementValue("scheduled-template", action.template || "");
    setElementValue("scheduled-model-image", action.modelImage || "");
    setElementValue("scheduled-model-image-pool", action.modelImagePoolId || "");
    setElementChecked("scheduled-image-auto-prompt", action.imageAutoPrompt === true);
    setElementChecked("scheduled-image-auto-filename", action.imageAutoFileName === true);
    setElementChecked("scheduled-image-auto-description", action.imageAutoDescription === true);
    setElementChecked("scheduled-image-candidate-selection-enabled", action.imageCandidateSelectionEnabled === true);
    setElementValue("scheduled-image-candidate-count", String(action.imageCandidateCount || 3));
    setElementValue("scheduled-image-candidate-selection-mode", action.imageCandidateSelectionMode === "first" ? "first" : "llm");
    setElementValue("scheduled-image-candidate-queue-mode", action.imageCandidateQueueMode === "comfy" ? "comfy" : "sequential");
    setElementValue("scheduled-image-candidate-processing-mode", action.imageCandidateProcessingMode === "all" ? "all" : "selected");
    setElementChecked("scheduled-image-create-video", action.imageCreateVideo === true);
    setElementValue("scheduled-image-video-mode", action.imageVideoMode || "text-to-video");
    setElementValue("scheduled-image-video-direction", action.imageVideoPromptDirection || "");
    setElementValue("scheduled-image-video-negative", action.imageVideoWorkflowSettings?.negativePrompt || "");
    setElementValue("scheduled-image-video-width", String(action.imageVideoWorkflowSettings?.width || 512));
    setElementValue("scheduled-image-video-height", String(action.imageVideoWorkflowSettings?.height || 512));
    setElementValue("scheduled-image-video-frames", String(action.imageVideoWorkflowSettings?.frames || 13));
    setElementValue("scheduled-image-video-fps", String(action.imageVideoWorkflowSettings?.fps || 6));
    setElementValue("scheduled-image-video-steps", String(action.imageVideoWorkflowSettings?.steps || 25));
    setElementChecked("scheduled-image-variant-remove-background", action.imagePostProcessingOptions?.removeBackground === true);
    setElementChecked("scheduled-image-variant-delight", action.imagePostProcessingOptions?.delight === true);
    setElementChecked("scheduled-image-variant-pixel-art", action.imagePostProcessingOptions?.pixelArt === true);
    setElementChecked("scheduled-image-video-convert-gif", action.imagePostProcessingOptions?.videoConvertToGif === true);
    setElementValue("scheduled-image-video-gif-playback-mode", action.imagePostProcessingOptions?.videoGifPlaybackMode === "pingpong" ? "pingpong" : "loop");
    setElementChecked("scheduled-image-video-gif-remove-background", action.imagePostProcessingOptions?.videoGifRemoveBackground === true);
    setElementChecked("scheduled-image-video-gif-pixel-art", action.imagePostProcessingOptions?.videoGifPixelArt === true);
    setElementValue("scheduled-image-variant-post-mode", action.imagePostProcessingOptions?.postMode === "separate" ? "separate" : "combined");
    setElementValue("scheduled-image-variant-recipes", formatImagePostProcessingRecipes(action.imagePostProcessingOptions?.recipes));
    setElementChecked("scheduled-model-random-source", action.modelRandomSource !== false);
    setElementChecked("scheduled-model-auto-prompt", action.modelAutoPrompt === true);
    const useLegacyLlmMetadata = action.modelUseLlmMetadata === true;
    const useLlmModelFileName = action.modelUseLlmModelFileName === true || (useLegacyLlmMetadata && action.modelUseLlmModelFileName !== false);
    const useLlmModelDescription = action.modelUseLlmModelDescription === true || (useLegacyLlmMetadata && action.modelUseLlmModelDescription !== false);
    setElementChecked("scheduled-model-llm-filename", useLlmModelFileName);
    setElementChecked("scheduled-model-llm-description", useLlmModelDescription);
    setElementChecked("scheduled-model-ask-llm-metallic", action.modelAskLlmIfShouldBeMetallic === true);
    setElementChecked("scheduled-model-auto-scale-real-height", action.modelAskLlmForRealWorldHeightAndScale === true);
    setElementValue("scheduled-model-llm-metadata-timing", action.modelMetadataTiming === "after" || action.modelMetadataTiming === "parallel" ? action.modelMetadataTiming : "before");
    setElementValue("scheduled-model-generation-target", action.modelGenerationTarget === "remote" ? "remote" : "local");
    setElementValue("scheduled-model-metadata-target", action.modelMetadataTarget === "remote" ? "remote" : "local");
    setElementChecked("scheduled-model-unload-llm-before-generate", action.modelUnloadLlmBeforeGenerate !== false);
    setElementChecked("scheduled-model-send-start-notice", action.modelSendStartNotice !== false);
    setElementChecked("scheduled-write-published-media-manifest", action.writePublishedMediaManifest === true);
    setElementChecked("scheduled-publish-to-uragenet-media-gallery", action.publishToUrageNetMediaGallery === true);
    setMultiSelectValues("scheduled-text-files", getAutomationTextFiles(action));
    const scheduledModelPostOptionsModule = getScheduledModelPostOptionsModule();
    if (scheduledModelPostOptionsModule?.apply) {
      scheduledModelPostOptionsModule.apply(action.modelPostOptions || {}, {
        initialExtraText: getModel3dInitialExtraSampleText(),
        destinationExtraText: getModel3dDestinationExtraSampleText()
      });
    }
    if (scheduledModelPostOptionsModule?.applyImage) {
      scheduledModelPostOptionsModule.applyImage(action.imagePostOptions || {});
    }
    const triggerMode = entry?.triggerMode === "interval" ? "interval" : "cron";
    switchScheduledTriggerMode(triggerMode);
    if (triggerMode === "cron") {
      const parsedBasic = parseCronToBasic(entry?.cron || "0 9 * * *");
      if (parsedBasic) {
        switchScheduleMode("basic");
        setElementValue("scheduled-basic-pattern", parsedBasic.pattern);
        setElementValue("scheduled-basic-time", parsedBasic.time);
        setElementValue("scheduled-basic-weekday", parsedBasic.weekday);
        setElementValue("scheduled-basic-monthday", parsedBasic.monthDay);
      } else {
        switchScheduleMode("advanced");
      }
    }
    updateScheduledSourceFields();
    updateScheduledModelPostOptionsUi();
    updateAutomationTargetChips();
    renderScheduledAutomationList();
  }

  function setJoinForm(value) {
    const entry = value || null;
    const action = entry?.action || {};
    state.selectedJoinAutomationId = entry?.id || "";
    state.joinTargetChannelId = entry?.channelId || state.selectedChannelId || state.joinTargetChannelId || "";
    setElementValue("join-name", entry?.name || "");
    setElementChecked("join-enabled", entry ? entry.enabled !== false : true);
    setElementValue("join-delay-seconds", String(Number.isFinite(entry?.delaySeconds) ? entry.delaySeconds : 0));
    setElementValue("join-source", action.source || "template");
    setElementValue("join-prompt", action.prompt || "");
    setElementValue("join-prompt-text-file", action.promptTextFile || "");
    setElementChecked("join-text-source-no-repeat", action.textSourceSelectionMode === "no-repeat");
    setElementValue("join-template", action.template || "");
    setElementValue("join-model-image", action.modelImage || "");
    setElementValue("join-model-image-pool", action.modelImagePoolId || "");
    setElementChecked("join-model-random-source", action.modelRandomSource !== false);
    setElementValue("join-model-generation-target", action.modelGenerationTarget === "remote" ? "remote" : "local");
    setElementChecked("join-model-auto-prompt", action.modelAutoPrompt === true);
    const useJoinLegacyLlmMetadata = action.modelUseLlmMetadata === true;
    const useJoinLlmModelFileName = action.modelUseLlmModelFileName === true || (useJoinLegacyLlmMetadata && action.modelUseLlmModelFileName !== false);
    const useJoinLlmModelDescription = action.modelUseLlmModelDescription === true || (useJoinLegacyLlmMetadata && action.modelUseLlmModelDescription !== false);
    setElementChecked("join-model-llm-filename", useJoinLlmModelFileName);
    setElementChecked("join-model-llm-description", useJoinLlmModelDescription);
    setElementChecked("join-model-ask-llm-metallic", action.modelAskLlmIfShouldBeMetallic === true);
    setElementChecked("join-model-auto-scale-real-height", action.modelAskLlmForRealWorldHeightAndScale === true);
    setElementValue("join-model-llm-metadata-timing", action.modelMetadataTiming === "after" || action.modelMetadataTiming === "parallel" ? action.modelMetadataTiming : "before");
    setElementValue("join-model-metadata-target", action.modelMetadataTarget === "remote" ? "remote" : "local");
    setElementChecked("join-model-unload-llm-before-generate", action.modelUnloadLlmBeforeGenerate !== false);
    setElementChecked("join-model-send-start-notice", action.modelSendStartNotice !== false);
    setMultiSelectValues("join-text-files", getAutomationTextFiles(action));
    updateJoinSourceFields();
    updateAutomationTargetChips();
    renderJoinAutomationList();
  }

  async function loadAutomations() {
    const automationScopeId = getAutomationScopeId();
    if (!automationScopeId) {
      state.scheduledAutomations = [];
      state.joinAutomations = [];
      state.selectedScheduledAutomationId = "";
      state.selectedJoinAutomationId = "";
      renderScheduledAutomationList();
      renderJoinAutomationList();
      setScheduledForm(null);
      setJoinForm(null);
      return;
    }
    const scheduledPromise = request("/api/scheduled-automations?guildId=" + encodeURIComponent(automationScopeId));
    const joinPromise = state.selectedMessenger === "discord" && state.selectedGuildId
      ? request("/api/join-automations?guildId=" + encodeURIComponent(state.selectedGuildId))
      : Promise.resolve([]);
    const [scheduledPayload, joinPayload] = await Promise.all([scheduledPromise, joinPromise]);
    state.scheduledAutomations = Array.isArray(scheduledPayload) ? scheduledPayload : [];
    state.joinAutomations = Array.isArray(joinPayload) ? joinPayload : [];
    if (!state.scheduledAutomations.some(item => item.id === state.selectedScheduledAutomationId)) {
      state.selectedScheduledAutomationId = "";
    }
    if (!state.joinAutomations.some(item => item.id === state.selectedJoinAutomationId)) {
      state.selectedJoinAutomationId = "";
    }
    const selectedScheduled = state.scheduledAutomations.find(item => item.id === state.selectedScheduledAutomationId) || state.scheduledAutomations[0] || null;
    const selectedJoin = state.joinAutomations.find(item => item.id === state.selectedJoinAutomationId) || state.joinAutomations[0] || null;
    setScheduledForm(selectedScheduled);
    setJoinForm(selectedJoin);
  }

  function getDefaultScheduledModelPostOptions() {
    return {
      targetMode: "channel",
      sendInitialToSelectedChannel: false,
      threadNameMode: "fixed",
      threadName: "",
      threadNameBase: "Day",
      modelNameSource: "llm",
      forumChannelId: "",
      forumChannelName: "textures",
      lowPolyForumChannelId: "",
      lowPolyForumChannelName: "",
      initialExtraText: getModel3dInitialExtraSampleText(),
      modelUploadTarget: "selected",
      includeModelFile: true,
      includePreviewMedia: true,
      includeSourceImage: true,
      includeEmbed: true,
      includeButtons: true,
      includeEmbedInInitial: true,
      uploadTextureMessages: false,
      uploadMultiViewTextures: true,
      uploadUvMapTextures: true,
      uploadNormalMapTextures: true,
      textureUploadTarget: "target",
      destinationExtraText: getModel3dDestinationExtraSampleText(),
      generateLowPolyVersion: false,
      lowPolyExecutionTarget: "local",
      lowPolyUseLlmTargetFaces: false,
      lowPolyLlmDecisionSource: "input-image",
      lowPolyTargetFaceCount: 1500,
      sendSourceImageToSelectedChannel: false
    };
  }

  function getDefaultScheduledImagePostOptions() {
    return {
      targetMode: "channel",
      sendInitialToSelectedChannel: false,
      threadNameMode: "fixed",
      threadName: "",
      threadNameBase: "Image Drop",
      forumChannelId: "",
      forumChannelName: "images",
      initialExtraText: "",
      destinationExtraText: "",
      includeEmbed: true
    };
  }

  function resolveScheduledTargetChannelId() {
    const scheduledTargetMessenger = normalizeScheduledTargetMessenger(state.scheduledTargetMessenger);
    const scheduledMatrixRoomId = normalizeMatrixRoomId(readValue("scheduled-target-matrix-room-id")) || normalizeMatrixRoomId(state.selectedMatrixRoomId) || "";
    const scheduledTargetChannelId = scheduledTargetMessenger === "telegram"
      ? (state.scheduledTargetChannelId || normalizeTelegramChatId(state.selectedTelegramChatId) || "")
      : scheduledTargetMessenger === "matrix"
        ? (state.scheduledTargetChannelId || scheduledMatrixRoomId || "")
        : (state.scheduledTargetChannelId || state.selectedChannelId || "");
    return { scheduledTargetMessenger, scheduledTargetChannelId };
  }

  function buildScheduledPayload() {
    const automationScopeId = getAutomationScopeId();
    if (!automationScopeId) {
      setOutput("Select an automation workspace first.");
      return null;
    }
    const { scheduledTargetMessenger, scheduledTargetChannelId } = resolveScheduledTargetChannelId();
    if (!scheduledTargetChannelId) {
      setOutput(scheduledTargetMessenger === "telegram"
        ? "Choose a scheduled Telegram chat first."
        : scheduledTargetMessenger === "matrix"
          ? "Enter a scheduled Matrix room ID first."
          : "Choose a scheduled target channel first.");
      return null;
    }
    state.scheduledTargetChannelId = scheduledTargetChannelId;
    updateAutomationTargetChips();
    const scheduledModelPostOptionsModule = getScheduledModelPostOptionsModule();
    const scheduledMetadataTimingValue = readValue("scheduled-model-llm-metadata-timing");
    const scheduledUseLlmModelFileName = readChecked("scheduled-model-llm-filename");
    const scheduledUseLlmModelDescription = readChecked("scheduled-model-llm-description");
    return {
      id: state.selectedScheduledAutomationId || undefined,
      guildId: automationScopeId,
      targetMessenger: scheduledTargetMessenger,
      channelId: scheduledTargetChannelId,
      name: readTrimmedValue("scheduled-name"),
      enabled: readChecked("scheduled-enabled"),
      triggerMode: state.scheduledTriggerMode,
      cron: readTrimmedValue("scheduled-cron"),
      intervalValue: readInteger("scheduled-interval-value", 1),
      intervalUnit: readValue("scheduled-interval-unit"),
      repeatCount: readInteger("scheduled-repeat-count", 1),
      repeatDelaySeconds: readInteger("scheduled-repeat-delay-seconds", 0),
      source: readValue("scheduled-source"),
      jokesFile: getMultiSelectValues("scheduled-text-files")[0] || "jokes.txt",
      textFiles: getMultiSelectValues("scheduled-text-files"),
      prompt: readValue("scheduled-prompt"),
      promptTextFile: readValue("scheduled-prompt-text-file") || "",
      textSourceSelectionMode: readChecked("scheduled-text-source-no-repeat") ? "no-repeat" : "random",
      template: readValue("scheduled-template"),
      modelImage: readTrimmedValue("scheduled-model-image"),
      modelImagePoolId: readValue("scheduled-model-image-pool") || "",
      imageAutoPrompt: readChecked("scheduled-image-auto-prompt"),
      imageAutoFileName: readChecked("scheduled-image-auto-filename"),
      imageAutoDescription: readChecked("scheduled-image-auto-description"),
      imageCandidateSelectionEnabled: readChecked("scheduled-image-candidate-selection-enabled"),
      imageCandidateCount: Math.min(12, Math.max(1, readInteger("scheduled-image-candidate-count", 3))),
      imageCandidateSelectionMode: readValue("scheduled-image-candidate-selection-mode") === "first" ? "first" : "llm",
      imageCandidateQueueMode: readValue("scheduled-image-candidate-queue-mode") === "comfy" ? "comfy" : "sequential",
      imageCandidateProcessingMode: readValue("scheduled-image-candidate-processing-mode") === "all" ? "all" : "selected",
      imageCreateVideo: readChecked("scheduled-image-create-video"),
      imageVideoMode: readValue("scheduled-image-video-mode") === "text-image-to-video" || readValue("scheduled-image-video-mode") === "both" ? readValue("scheduled-image-video-mode") : "text-to-video",
      imageVideoPromptDirection: readTrimmedValue("scheduled-image-video-direction"),
      imageVideoWorkflowSettings: {
        workflowPath: "comfyui-workflows/video/video_from_text.json",
        imageWorkflowPath: "comfyui-workflows/video/video_from_image_text.json",
        negativePrompt: readTrimmedValue("scheduled-image-video-negative"),
        width: readInteger("scheduled-image-video-width", 0) || undefined,
        height: readInteger("scheduled-image-video-height", 0) || undefined,
        frames: readInteger("scheduled-image-video-frames", 0) || undefined,
        fps: readInteger("scheduled-image-video-fps", 0) || undefined,
        steps: readInteger("scheduled-image-video-steps", 0) || undefined
      },
      imagePostProcessingOptions: {
        removeBackground: readChecked("scheduled-image-variant-remove-background"),
        delight: readChecked("scheduled-image-variant-delight"),
        pixelArt: readChecked("scheduled-image-variant-pixel-art"),
        videoConvertToGif: readChecked("scheduled-image-video-convert-gif"),
        videoGifPlaybackMode: readValue("scheduled-image-video-gif-playback-mode") === "pingpong" ? "pingpong" : "loop",
        videoGifRemoveBackground: readChecked("scheduled-image-video-gif-remove-background"),
        videoGifPixelArt: readChecked("scheduled-image-video-gif-pixel-art"),
        postMode: readValue("scheduled-image-variant-post-mode") === "separate" ? "separate" : "combined",
        recipes: parseImagePostProcessingRecipes(readValue("scheduled-image-variant-recipes"))
      },
      imagePostOptions: scheduledModelPostOptionsModule?.readImage ? scheduledModelPostOptionsModule.readImage() : getDefaultScheduledImagePostOptions(),
      modelRandomSource: readChecked("scheduled-model-random-source"),
      modelAutoPrompt: readChecked("scheduled-model-auto-prompt"),
      modelUseLlmMetadata: scheduledUseLlmModelFileName || scheduledUseLlmModelDescription,
      modelUseLlmModelFileName: scheduledUseLlmModelFileName,
      modelUseLlmModelDescription: scheduledUseLlmModelDescription,
      modelAskLlmIfShouldBeMetallic: readChecked("scheduled-model-ask-llm-metallic"),
      modelAskLlmForRealWorldHeightAndScale: readChecked("scheduled-model-auto-scale-real-height"),
      modelMetadataTiming: scheduledMetadataTimingValue === "after" || scheduledMetadataTimingValue === "parallel" ? scheduledMetadataTimingValue : "before",
      modelGenerationTarget: readValue("scheduled-model-generation-target") === "remote" ? "remote" : "local",
      modelMetadataTarget: readValue("scheduled-model-metadata-target") === "remote" ? "remote" : "local",
      modelUnloadLlmBeforeGenerate: readChecked("scheduled-model-unload-llm-before-generate"),
      modelSendStartNotice: readChecked("scheduled-model-send-start-notice"),
      writePublishedMediaManifest: readChecked("scheduled-write-published-media-manifest"),
      publishToUrageNetMediaGallery: readChecked("scheduled-publish-to-uragenet-media-gallery"),
      modelPostOptions: scheduledModelPostOptionsModule?.read ? scheduledModelPostOptionsModule.read() : getDefaultScheduledModelPostOptions()
    };
  }

  function validateScheduledPayload(payload) {
    if (!payload.name) return "Name is required.";
    if (payload.triggerMode === "cron" && !payload.cron) return "Cron is required for cron/calendar schedules.";
    if (payload.triggerMode === "interval" && payload.intervalValue < 1) return "Run every X must be at least 1.";
    if ((payload.targetMessenger === "telegram" || payload.targetMessenger === "matrix") && payload.source === "model-3d") {
      return "3D model scheduled automations are not supported for " + (payload.targetMessenger === "telegram" ? "Telegram" : "Matrix") + " yet.";
    }
    if (payload.source === "image" && !payload.prompt.trim() && !payload.promptTextFile && !payload.imageAutoPrompt) {
      return "Set an image prompt, prompt text source file, or enable auto prompt for text-to-image automation.";
    }
    if (payload.source === "image" && payload.imagePostOptions.targetMode !== "channel" && payload.imagePostOptions.threadNameMode === "fixed" && !payload.imagePostOptions.threadName) {
      return "Set a fixed thread/post name for text-to-image automation.";
    }
    if (payload.source === "image" && payload.imagePostOptions.targetMode !== "channel" && payload.imagePostOptions.threadNameMode === "increment" && !payload.imagePostOptions.threadNameBase) {
      return "Set a base name for image increment thread/post mode.";
    }
    if (payload.source === "image" && payload.imagePostOptions.targetMode === "forum-post" && !payload.imagePostOptions.forumChannelId) {
      return "Select a forum channel for image forum-post mode.";
    }
    if (payload.source === "image" && payload.imagePostOptions.targetMode === "forum-create-and-post" && !payload.imagePostOptions.forumChannelId && !payload.imagePostOptions.forumChannelName) {
      return "Select a forum channel or set a forum channel name for image forum-create mode.";
    }
    if (payload.source === "model-3d" && !payload.modelImage && !payload.modelImagePoolId) {
      return "Set a model image and/or image pool for 3D model schedules.";
    }
    if (payload.source === "model-3d" && payload.modelPostOptions.targetMode !== "channel" && payload.modelPostOptions.threadNameMode === "fixed" && !payload.modelPostOptions.threadName) {
      return "Set a fixed thread/post name for 3D model automation.";
    }
    if (payload.source === "model-3d" && payload.modelPostOptions.targetMode !== "channel" && payload.modelPostOptions.threadNameMode === "increment" && !payload.modelPostOptions.threadNameBase) {
      return "Set a base name for increment thread/post mode.";
    }
    if (payload.source === "model-3d" && payload.modelPostOptions.targetMode === "forum-post" && !payload.modelPostOptions.forumChannelId) {
      return "Select a forum channel for forum-post mode.";
    }
    if (payload.source === "model-3d" && payload.modelPostOptions.targetMode === "forum-create-and-post" && !payload.modelPostOptions.forumChannelId && !payload.modelPostOptions.forumChannelName) {
      return "Select a forum channel or set a forum channel name for forum-create mode.";
    }
    return "";
  }

  function buildJoinPayload() {
    if (!state.selectedGuildId) {
      setOutput("Select a guild first.");
      return null;
    }
    const joinTargetChannelId = state.joinTargetChannelId || state.selectedChannelId || "";
    if (!joinTargetChannelId) {
      setOutput("Choose a join target channel first.");
      return null;
    }
    state.joinTargetChannelId = joinTargetChannelId;
    updateAutomationTargetChips();
    const joinMetadataTimingValue = readValue("join-model-llm-metadata-timing");
    const joinUseLlmModelFileName = readChecked("join-model-llm-filename");
    const joinUseLlmModelDescription = readChecked("join-model-llm-description");
    return {
      id: state.selectedJoinAutomationId || undefined,
      guildId: state.selectedGuildId,
      channelId: joinTargetChannelId,
      name: readTrimmedValue("join-name"),
      enabled: readChecked("join-enabled"),
      delaySeconds: readInteger("join-delay-seconds", 0),
      source: readValue("join-source"),
      jokesFile: getMultiSelectValues("join-text-files")[0] || "jokes.txt",
      textFiles: getMultiSelectValues("join-text-files"),
      prompt: readValue("join-prompt"),
      promptTextFile: readValue("join-prompt-text-file") || "",
      textSourceSelectionMode: readChecked("join-text-source-no-repeat") ? "no-repeat" : "random",
      template: readValue("join-template"),
      modelImage: readTrimmedValue("join-model-image"),
      modelImagePoolId: readValue("join-model-image-pool") || "",
      modelRandomSource: readChecked("join-model-random-source"),
      modelAutoPrompt: readChecked("join-model-auto-prompt"),
      modelUseLlmMetadata: joinUseLlmModelFileName || joinUseLlmModelDescription,
      modelUseLlmModelFileName: joinUseLlmModelFileName,
      modelUseLlmModelDescription: joinUseLlmModelDescription,
      modelAskLlmIfShouldBeMetallic: readChecked("join-model-ask-llm-metallic"),
      modelAskLlmForRealWorldHeightAndScale: readChecked("join-model-auto-scale-real-height"),
      modelGenerationTarget: readValue("join-model-generation-target") === "remote" ? "remote" : "local",
      modelMetadataTarget: readValue("join-model-metadata-target") === "remote" ? "remote" : "local",
      modelMetadataTiming: joinMetadataTimingValue === "after" || joinMetadataTimingValue === "parallel" ? joinMetadataTimingValue : "before",
      modelUnloadLlmBeforeGenerate: readChecked("join-model-unload-llm-before-generate"),
      modelSendStartNotice: readChecked("join-model-send-start-notice")
    };
  }

  function validateJoinPayload(payload) {
    if (!payload.name) return "Name is required.";
    if (payload.source === "model-3d" && !payload.modelImage && !payload.modelImagePoolId) {
      return "Set a model image and/or image pool for 3D join automations.";
    }
    return "";
  }

  function applySchedulePreset() {
    const presetId = readValue("schedule-preset-select");
    const preset = state.automationPresets.find(item => item.id === presetId && item.scope === "schedule");
    if (!preset?.scheduleDefaults) {
      return void setOutput("Choose a schedule preset first.");
    }
    setScheduledForm({
      name: preset.name,
      enabled: true,
      targetMessenger: normalizeScheduledTargetMessenger(state.scheduledTargetMessenger),
      channelId: state.scheduledTargetChannelId
        || (state.scheduledTargetMessenger === "telegram"
          ? normalizeTelegramChatId(state.selectedTelegramChatId)
          : state.scheduledTargetMessenger === "matrix"
            ? normalizeMatrixRoomId(state.selectedMatrixRoomId)
            : state.selectedChannelId)
        || "",
      triggerMode: preset.scheduleDefaults.triggerMode,
      cron: preset.scheduleDefaults.cron,
      intervalValue: preset.scheduleDefaults.intervalValue,
      intervalUnit: preset.scheduleDefaults.intervalUnit,
      repeatCount: preset.scheduleDefaults.repeatCount,
      repeatDelaySeconds: preset.scheduleDefaults.repeatDelaySeconds,
      action: preset.scheduleDefaults.action
    });
    setOutput("Schedule preset applied.");
  }

  function applyJoinPreset() {
    const presetId = readValue("join-preset-select");
    const preset = state.automationPresets.find(item => item.id === presetId && item.scope === "member-join");
    if (!preset?.joinDefaults) {
      return void setOutput("Choose a join preset first.");
    }
    setJoinForm({
      name: preset.name,
      enabled: true,
      channelId: state.joinTargetChannelId || state.selectedChannelId || "",
      delaySeconds: preset.joinDefaults.delaySeconds,
      action: preset.joinDefaults.action
    });
    setOutput("Join preset applied.");
  }

  async function saveScheduledAutomationFromUi() {
    const payload = buildScheduledPayload();
    if (!payload) {
      return;
    }
    const validationError = validateScheduledPayload(payload);
    if (validationError) {
      return void setOutput(validationError);
    }
    const saved = await request("/api/scheduled-automations", payload);
    setScheduledForm(saved);
    await loadAutomations();
    setOutput("Scheduled job saved.");
  }

  async function deleteScheduledAutomationFromUi() {
    if (!state.selectedScheduledAutomationId) {
      return void setOutput("Select a scheduled job first.");
    }
    await request("/api/scheduled-automations/delete", { id: state.selectedScheduledAutomationId });
    setScheduledForm(null);
    await loadAutomations();
    setOutput("Scheduled job deleted.");
  }

  async function saveJoinAutomationFromUi() {
    const payload = buildJoinPayload();
    if (!payload) {
      return;
    }
    const validationError = validateJoinPayload(payload);
    if (validationError) {
      return void setOutput(validationError);
    }
    const saved = await request("/api/join-automations", payload);
    setJoinForm(saved);
    await loadAutomations();
    setOutput("Join follow-up saved.");
  }

  async function deleteJoinAutomationFromUi() {
    if (!state.selectedJoinAutomationId) {
      return void setOutput("Select a join automation first.");
    }
    await request("/api/join-automations/delete", { id: state.selectedJoinAutomationId });
    setJoinForm(null);
    await loadAutomations();
    setOutput("Join follow-up deleted.");
  }

  function bindEvents() {
    bindChange("scheduled-target-channel-select", event => {
      if (state.scheduledTargetMessenger !== "discord") {
        return;
      }
      const nextChannelId = event.currentTarget && typeof event.currentTarget.value === "string" ? event.currentTarget.value.trim() : "";
      state.scheduledTargetChannelId = nextChannelId || "";
      updateAutomationTargetChips();
      getScheduledModelPostOptionsModule()?.refreshImageVariantTargetBuilder?.();
      setOutput(nextChannelId ? "Scheduled destination updated." : "Scheduled destination cleared.");
    });
    bindChange("join-target-channel-select", event => {
      const nextChannelId = event.currentTarget && typeof event.currentTarget.value === "string" ? event.currentTarget.value.trim() : "";
      state.joinTargetChannelId = nextChannelId || "";
      updateAutomationTargetChips();
      setOutput(nextChannelId ? "Join follow-up target updated." : "Join follow-up target cleared.");
    });
    bindClick("scheduled-use-selected-channel-button", () => {
      if (state.scheduledTargetMessenger !== "discord") {
        return void setOutput("Switch scheduled target messenger to Discord first.");
      }
      if (!state.selectedChannelId) {
        return void setOutput("Select a channel first.");
      }
      state.scheduledTargetChannelId = state.selectedChannelId;
      updateAutomationTargetChips();
      getScheduledModelPostOptionsModule()?.refreshImageVariantTargetBuilder?.();
      setOutput("Scheduled destination updated.");
    });
    bindClick("scheduled-use-selected-telegram-chat-button", () => {
      if (state.scheduledTargetMessenger !== "telegram") {
        return void setOutput("Switch scheduled target messenger to Telegram first.");
      }
      const selectedTelegramChatId = normalizeTelegramChatId(state.selectedTelegramChatId);
      if (!selectedTelegramChatId) {
        return void setOutput("Select a Telegram chat first.");
      }
      state.scheduledTargetChannelId = selectedTelegramChatId;
      setElementValue("scheduled-target-telegram-chat-id", selectedTelegramChatId);
      updateAutomationTargetChips();
      setOutput("Scheduled Telegram destination updated.");
    });
    bindClick("scheduled-use-selected-matrix-room-button", () => {
      if (state.scheduledTargetMessenger !== "matrix") {
        return void setOutput("Switch scheduled target messenger to Matrix first.");
      }
      const selectedMatrixRoomId = normalizeMatrixRoomId(readValue("scheduled-target-matrix-room-id") || state.selectedMatrixRoomId);
      if (!selectedMatrixRoomId) {
        return void setOutput("Enter a Matrix room ID first.");
      }
      state.scheduledTargetChannelId = selectedMatrixRoomId;
      setElementValue("scheduled-target-matrix-room-id", selectedMatrixRoomId);
      updateAutomationTargetChips();
      setOutput("Scheduled Matrix destination updated.");
    });
    bindClick("join-use-selected-channel-button", () => {
      if (!state.selectedChannelId) {
        return void setOutput("Select a channel first.");
      }
      state.joinTargetChannelId = state.selectedChannelId;
      updateAutomationTargetChips();
      setOutput("Join follow-up target updated.");
    });
    bindClick("apply-schedule-preset-button", applySchedulePreset);
    bindClick("apply-join-preset-button", applyJoinPreset);
    bindClick("save-uragenet-media-gallery-settings-button", () => {
      void saveUrageNetMediaGallerySettingsFromUi().catch(error => setOutput(error.message || "Could not save Media Library connection."));
    });
    void loadUrageNetMediaGallerySettings().catch(error => setOutput(error.message || "Could not load Media Library connection."));
    bindClick("clear-schedule-form-button", () => {
      setScheduledForm(null);
      setOutput("Ready for a new scheduled job.");
    });
    bindClick("clear-join-form-button", () => {
      setJoinForm(null);
      setOutput("Ready for a new join follow-up.");
    });
    bindClick("save-scheduled-button", () => {
      void saveScheduledAutomationFromUi();
    });
    bindClick("delete-scheduled-button", () => {
      void deleteScheduledAutomationFromUi();
    });
    bindClick("save-join-button", () => {
      void saveJoinAutomationFromUi();
    });
    bindClick("delete-join-button", () => {
      void deleteJoinAutomationFromUi();
    });
  }

  return {
    renderScheduledAutomationList,
    renderJoinAutomationList,
    setScheduledForm,
    setJoinForm,
    loadAutomations,
    bindEvents
  };
}
