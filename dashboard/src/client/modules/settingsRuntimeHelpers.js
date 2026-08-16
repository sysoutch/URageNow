function createDashboardSettingsRuntimeHelpers(input) {
  const {
    state,
    normalizeMessenger,
    renderMessengerDashboardView,
    renderMessengerRuntimePanel,
    updateMessengerWorkspaceSummary,
    syncLlmModelSelectionUi,
    syncWorkflowLlmModelSelectionUi,
    setOutput,
    clearChildren,
    escapeHtml,
    formatDateTime,
    setElementValue,
    setElementChecked
  } = input;
  function formatRefreshTime(value) {
    return value ? new Date(value).toLocaleTimeString() : "Never";
  }
  function normalizeLlmProvider(value) {
    return value === "lmstudio" || value === "llamacpp" ? value : "ollama";
  }
  function setRefreshStatus(id, label, value) {
    const node = document.getElementById(id);
    if (!node) {
      return;
    }
    node.textContent = label + formatRefreshTime(value);
  }
  function setStatusText(id, text) {
    const node = document.getElementById(id);
    if (node) {
      node.textContent = text;
    }
  }
  function setComfyPathSettingsStatus(text, statusId) {
    const statusIds = statusId
      ? [statusId]
      : [
          "comfy-model-path-settings-status",
          "comfy-image-path-settings-status",
          "comfy-audio-path-settings-status",
          "comfy-music-path-settings-status",
          "comfy-video-path-settings-status"
        ];
    statusIds.forEach(id => {
      setStatusText(id, text);
    });
  }
  function setQuickComfyPathSettingsStatus(text) {
    setStatusText("quick-comfy-path-settings-status", text);
  }
  function setQuickFfmpegSettingsStatus(text) {
    setStatusText("quick-ffmpeg-settings-status", text);
  }
  function setQuickInstallerStatus(text) {
    setStatusText("settings-install-status", text);
  }
  function setLlmConnectionSettingsStatus(text, statusId) {
    setStatusText(statusId || "llm-connection-settings-status", text);
  }
  function setTextInputValue(id, value) {
    setElementValue(id, String(value || ""));
  }
  function renderModerationLog() {
    const container = document.getElementById("feed-moderation");
    if (!container) {
      return;
    }
    clearChildren(container);
    const events = Array.isArray(state.moderationEvents) ? state.moderationEvents : [];
    if (events.length === 0) {
      const empty = document.createElement("div");
      empty.className = "item";
      empty.textContent = "No moderation events recorded yet.";
      container.appendChild(empty);
      return;
    }
    events.forEach(event => {
      const item = document.createElement("div");
      item.className = "item";
      const channels = Array.isArray(event.channels) && event.channels.length > 0
        ? event.channels.map(channelId => "#" + channelId).join(", ")
        : "none";
      const protectionReasons = Array.isArray(event.protectionReasons) && event.protectionReasons.length > 0
        ? event.protectionReasons.join(", ")
        : "";
      item.innerHTML =
        "<strong>" + escapeHtml(String(event.type || "moderation")) + "</strong>"
        + "<div>User: " + escapeHtml(String(event.username || event.userId || "unknown")) + " | " + escapeHtml(String(event.userId || "unknown")) + "</div>"
        + "<div>When: " + escapeHtml(formatDateTime(event.createdAt)) + "</div>"
        + "<div>Channels: " + escapeHtml(channels) + "</div>"
        + "<div>Deleted: " + escapeHtml(String(event.deletedCount || 0)) + " | Timed out: " + escapeHtml(event.timedOut ? "yes" : "no") + "</div>"
        + "<div>Reason: " + escapeHtml(String(event.reason || "(none)")) + "</div>"
        + (protectionReasons ? "<div>Protected because: " + escapeHtml(protectionReasons) + "</div>" : "");
      container.appendChild(item);
    });
  }
  function readTextInputValue(id) {
    return document.getElementById(id)?.value.trim() || "";
  }
  function readCheckedValue(id) {
    return document.getElementById(id)?.checked === true;
  }
  function applyQuickComfyPathSettingsToUi(settings) {
    setTextInputValue("quick-comfy-input-dir-input", settings.comfyUiInputDir || "");
    setTextInputValue("quick-comfy-model-workflow-path-input", settings.comfyUiModelWorkflowPath || "");
    setTextInputValue("quick-comfy-image-workflow-path-input", settings.comfyUiImageWorkflowPath || "");
    setTextInputValue("quick-comfy-image-edit-workflow-path-input", settings.comfyUiImageEditWorkflowPath || "");
    setTextInputValue("quick-comfy-image-layered-workflow-path-input", settings.comfyUiImageLayeredWorkflowPath || "");
    setTextInputValue("quick-comfy-audio-workflow-path-input", settings.comfyUiAudioWorkflowPath || "");
    setTextInputValue("quick-comfy-music-workflow-path-input", settings.comfyUiMusicWorkflowPath || "");
    setTextInputValue("quick-comfy-video-workflow-path-input", settings.comfyUiVideoWorkflowPath || "");
  }
  function applyQuickFfmpegSettingsToUi(settings) {
    setTextInputValue("quick-ffmpeg-executable-path-input", settings.ffmpegExecutablePath || "");
  }
  function applyGlobalSettingsToUi(settings) {
    if (!settings || typeof settings !== "object") {
      return;
    }
    state.globalSettings = settings;
    setElementChecked("require-confirmation", settings.requireConfirmationForLlmSend === true);
    setElementChecked("strip-metadata-webui", settings.stripMetadataWebUiImages !== false);
    setElementChecked("image-strip-metadata-storage", settings.stripMetadataWebUiImages !== false);
    setElementChecked("strip-metadata-discord", settings.stripMetadataDiscordImages !== false);
    setElementChecked("ollama-text-model-visual", settings.ollamaTextModelIsVisual === true);
    setElementChecked("model3d-unload-llm-before-generate", settings.unloadLlmBeforeModel3dGeneration !== false);
    setElementValue("model3d-generation-target", settings.model3dGenerationTarget === "remote" ? "remote" : "local");
    setElementValue("model3d-metadata-target", settings.model3dMetadataTarget === "remote" ? "remote" : "local");
    setElementValue("llm-provider-select", normalizeLlmProvider(settings.llmProvider));
    setTextInputValue("ollama-url-input", settings.ollamaUrl || "");
    setTextInputValue("lmstudio-base-url-input", settings.lmStudioBaseUrl || "");
    setTextInputValue("lmstudio-api-key-input", settings.lmStudioApiKey || "");
    setTextInputValue("lmstudio-context-length-input", settings.lmStudioContextLength || "");
    setElementChecked("lmstudio-text-reasoning-enabled", settings.lmStudioTextModelReasoningEnabled !== false);
    setElementValue("image-llm-provider-select", normalizeLlmProvider(settings.imageLlmProvider));
    setTextInputValue("image-ollama-url-input", settings.imageOllamaUrl || "");
    setTextInputValue("image-lmstudio-base-url-input", settings.imageLmStudioBaseUrl || "");
    setTextInputValue("image-lmstudio-api-key-input", settings.imageLmStudioApiKey || "");
    setElementValue("image-llm-text-model-select", settings.imageLlmTextModel || settings.ollamaTextModel || "");
    setElementValue("image-llm-vision-model-select", settings.imageLlmVisionModel || settings.ollamaVisionModel || "");
    setElementValue("model3d-llm-provider-select", normalizeLlmProvider(settings.model3dLlmProvider));
    setTextInputValue("model3d-ollama-url-input", settings.model3dOllamaUrl || "");
    setTextInputValue("model3d-lmstudio-base-url-input", settings.model3dLmStudioBaseUrl || "");
    setTextInputValue("model3d-lmstudio-api-key-input", settings.model3dLmStudioApiKey || "");
    setElementValue("model3d-llm-text-model-select", settings.model3dLlmTextModel || settings.ollamaTextModel || "");
    setElementValue("model3d-llm-vision-model-select", settings.model3dLlmVisionModel || settings.ollamaVisionModel || "");
    setTextInputValue("comfy-base-url-input", settings.comfyUiBaseUrl || "");
    setTextInputValue("comfy-model-base-url-input", settings.comfyUiModelBaseUrl || "");
    setTextInputValue("comfy-image-base-url-input", settings.comfyUiImageBaseUrl || "");
    setTextInputValue("comfy-audio-base-url-input", settings.comfyUiAudioBaseUrl || "");
    setTextInputValue("comfy-music-base-url-input", settings.comfyUiMusicBaseUrl || "");
    setTextInputValue("comfy-video-base-url-input", settings.comfyUiVideoBaseUrl || "");
    setTextInputValue("comfy-input-dir-input", settings.comfyUiInputDir || "");
    setTextInputValue("comfy-model-workflow-path-input", settings.comfyUiModelWorkflowPath || "");
    setTextInputValue("comfy-image-workflow-path-input", settings.comfyUiImageWorkflowPath || "");
    setTextInputValue("comfy-image-edit-workflow-path-input", settings.comfyUiImageEditWorkflowPath || "");
    setTextInputValue("comfy-image-layered-workflow-path-input", settings.comfyUiImageLayeredWorkflowPath || "");
    setTextInputValue("comfy-audio-workflow-path-input", settings.comfyUiAudioWorkflowPath || "");
    setTextInputValue("comfy-music-workflow-path-input", settings.comfyUiMusicWorkflowPath || "");
    setTextInputValue("comfy-video-workflow-path-input", settings.comfyUiVideoWorkflowPath || "");
    setTextInputValue("messenger-runtime-shared-path-input", settings.messengerSharedSecretsPath || "");
    const selectedMessenger = normalizeMessenger(state.selectedMessenger);
    setElementChecked("messenger-runtime-autostart-checkbox", settings[selectedMessenger + "RuntimeAutostart"] === true);
    setElementChecked("settings-discord-runtime-autostart", settings.discordRuntimeAutostart === true);
    setStatusText(
      "settings-messenger-autostart-status",
      settings.discordRuntimeAutostart === true
        ? "Discord is configured to start with the dashboard."
        : "Discord autostart is off. Use Runtime Control when you want the bot online."
    );
    applyQuickComfyPathSettingsToUi(settings);
    applyQuickFfmpegSettingsToUi(settings);
    syncLlmModelSelectionUi();
    syncWorkflowLlmModelSelectionUi(settings);
  }
  async function request(path, body) {
    const response = await fetch(path, { method: body ? "POST" : "GET", cache: "no-store", headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
    const rawPayload = await response.text();
    const normalizedPayload = rawPayload.replace(/^\uFEFF/, "");
    let payload = {};
    if (normalizedPayload.trim()) {
      try {
        payload = JSON.parse(normalizedPayload);
      } catch {
        const snippet = normalizedPayload.slice(0, 240).replace(/\s+/g, " ").trim();
        throw new Error("Invalid JSON from " + path + ": " + snippet);
      }
    }
    if (!response.ok) {
      const detail = typeof payload.error === "string" && payload.error.trim()
        ? payload.error.trim()
        : "Request failed (" + response.status + " " + (response.statusText || "error") + ") for " + path;
      throw new Error(detail);
    }
    return payload;
  }
  async function loadGlobalSettingsFromState() {
    const payload = await request("/api/state");
    state.botSnapshot = payload && payload.bot ? payload.bot : null;
    state.runtimeActions = Array.isArray(payload?.actions) ? payload.actions : [];
    state.moderationEvents = Array.isArray(payload?.moderationEvents) ? payload.moderationEvents : [];
    const settings = payload && payload.settings ? payload.settings : null;
    if (settings) {
      applyGlobalSettingsToUi(settings);
      setLlmConnectionSettingsStatus("Loaded saved LLM connection settings.");
      setLlmConnectionSettingsStatus("Loaded saved Image LLM connection settings.", "image-llm-connection-settings-status");
      setLlmConnectionSettingsStatus("Loaded saved 3D LLM connection settings.", "model3d-llm-connection-settings-status");
      setComfyPathSettingsStatus("Loaded saved Comfy endpoint + path settings.");
      setQuickComfyPathSettingsStatus("Loaded saved workflow paths.");
      setQuickFfmpegSettingsStatus(settings.ffmpegExecutablePath ? "Loaded saved FFmpeg path." : "FFmpeg path is empty. Auto-detect is enabled.");
    } else {
      setLlmConnectionSettingsStatus("No saved LLM connection settings found.");
      setLlmConnectionSettingsStatus("No saved Image LLM connection settings found.", "image-llm-connection-settings-status");
      setLlmConnectionSettingsStatus("No saved 3D LLM connection settings found.", "model3d-llm-connection-settings-status");
      setComfyPathSettingsStatus("No saved Comfy endpoint + path settings found.");
      setQuickComfyPathSettingsStatus("No saved workflow paths found.");
      setQuickFfmpegSettingsStatus("FFmpeg path not loaded yet.");
    }
    renderModerationLog();
    renderMessengerDashboardView();
    return settings;
  }
  function readLlmConnectionSettingsFromUi() {
    const lmStudioContextLengthValue = readTextInputValue("lmstudio-context-length-input");
    return {
      llmProvider: normalizeLlmProvider(document.getElementById("llm-provider-select")?.value),
      ollamaUrl: readTextInputValue("ollama-url-input"),
      lmStudioBaseUrl: readTextInputValue("lmstudio-base-url-input"),
      lmStudioApiKey: readTextInputValue("lmstudio-api-key-input"),
      lmStudioContextLength: lmStudioContextLengthValue ? Math.max(0, Number.parseInt(lmStudioContextLengthValue, 10) || 0) : 0,
      lmStudioTextModelReasoningEnabled: document.getElementById("lmstudio-text-reasoning-enabled")?.checked !== false
    };
  }
  async function saveLlmConnectionSettingsFromUi() {
    const payload = readLlmConnectionSettingsFromUi();
    if (payload.llmProvider === "ollama" && !payload.ollamaUrl) {
      throw new Error("Fill Ollama URL before saving.");
    }
    if (payload.llmProvider !== "ollama" && !payload.lmStudioBaseUrl) {
      throw new Error("Fill the OpenAI-compatible Base URL before saving.");
    }
    const requestPayload = {
      llmProvider: payload.llmProvider,
      lmStudioContextLength: payload.lmStudioContextLength,
      lmStudioTextModelReasoningEnabled: payload.lmStudioTextModelReasoningEnabled
    };
    if (payload.lmStudioApiKey) {
      requestPayload.lmStudioApiKey = payload.lmStudioApiKey;
    }
    if (payload.ollamaUrl) {
      requestPayload.ollamaUrl = payload.ollamaUrl;
    }
    if (payload.lmStudioBaseUrl) {
      requestPayload.lmStudioBaseUrl = payload.lmStudioBaseUrl;
    }
    const saved = await request("/api/settings", requestPayload);
    applyGlobalSettingsToUi(saved);
    setLlmConnectionSettingsStatus("Saved LLM connection settings.");
    return saved;
  }
  function readImageLlmConnectionSettingsFromUi() {
    return {
      imageLlmProvider: normalizeLlmProvider(document.getElementById("image-llm-provider-select")?.value),
      imageOllamaUrl: readTextInputValue("image-ollama-url-input"),
      imageLmStudioBaseUrl: readTextInputValue("image-lmstudio-base-url-input"),
      imageLmStudioApiKey: readTextInputValue("image-lmstudio-api-key-input"),
      imageLlmTextModel: document.getElementById("image-llm-text-model-select")?.value || "",
      imageLlmVisionModel: document.getElementById("image-llm-vision-model-select")?.value || ""
    };
  }
  async function saveImageLlmConnectionSettingsFromUi() {
    const payload = readImageLlmConnectionSettingsFromUi();
    const requestPayload = {...payload};
    if (!requestPayload.imageLmStudioApiKey) {
      delete requestPayload.imageLmStudioApiKey;
    }
    const saved = await request("/api/settings", requestPayload);
    applyGlobalSettingsToUi(saved);
    setLlmConnectionSettingsStatus("Saved Image LLM connection settings.", "image-llm-connection-settings-status");
    return saved;
  }
  function readModel3dLlmConnectionSettingsFromUi() {
    return {
      model3dLlmProvider: normalizeLlmProvider(document.getElementById("model3d-llm-provider-select")?.value),
      model3dOllamaUrl: readTextInputValue("model3d-ollama-url-input"),
      model3dLmStudioBaseUrl: readTextInputValue("model3d-lmstudio-base-url-input"),
      model3dLmStudioApiKey: readTextInputValue("model3d-lmstudio-api-key-input"),
      model3dLlmTextModel: document.getElementById("model3d-llm-text-model-select")?.value || "",
      model3dLlmVisionModel: document.getElementById("model3d-llm-vision-model-select")?.value || ""
    };
  }
  async function saveModel3dLlmConnectionSettingsFromUi() {
    const payload = readModel3dLlmConnectionSettingsFromUi();
    const requestPayload = {...payload};
    if (!requestPayload.model3dLmStudioApiKey) {
      delete requestPayload.model3dLmStudioApiKey;
    }
    const saved = await request("/api/settings", requestPayload);
    applyGlobalSettingsToUi(saved);
    setLlmConnectionSettingsStatus("Saved 3D LLM connection settings.", "model3d-llm-connection-settings-status");
    return saved;
  }
  function readComfyPathSettingsFromUi() {
    return {
      comfyUiBaseUrl: readTextInputValue("comfy-base-url-input"),
      comfyUiModelBaseUrl: readTextInputValue("comfy-model-base-url-input"),
      comfyUiImageBaseUrl: readTextInputValue("comfy-image-base-url-input"),
      comfyUiAudioBaseUrl: readTextInputValue("comfy-audio-base-url-input"),
      comfyUiMusicBaseUrl: readTextInputValue("comfy-music-base-url-input"),
      comfyUiVideoBaseUrl: readTextInputValue("comfy-video-base-url-input"),
      comfyUiInputDir: readTextInputValue("comfy-input-dir-input"),
      comfyUiModelWorkflowPath: readTextInputValue("comfy-model-workflow-path-input"),
      comfyUiImageWorkflowPath: readTextInputValue("comfy-image-workflow-path-input"),
      comfyUiImageEditWorkflowPath: readTextInputValue("comfy-image-edit-workflow-path-input"),
      comfyUiImageLayeredWorkflowPath: readTextInputValue("comfy-image-layered-workflow-path-input"),
      comfyUiAudioWorkflowPath: readTextInputValue("comfy-audio-workflow-path-input"),
      comfyUiMusicWorkflowPath: readTextInputValue("comfy-music-workflow-path-input"),
      comfyUiVideoWorkflowPath: readTextInputValue("comfy-video-workflow-path-input")
    };
  }
  function readQuickComfyPathSettingsFromUi() {
    return {
      comfyUiInputDir: readTextInputValue("quick-comfy-input-dir-input"),
      comfyUiModelWorkflowPath: readTextInputValue("quick-comfy-model-workflow-path-input"),
      comfyUiImageWorkflowPath: readTextInputValue("quick-comfy-image-workflow-path-input"),
      comfyUiImageEditWorkflowPath: readTextInputValue("quick-comfy-image-edit-workflow-path-input"),
      comfyUiImageLayeredWorkflowPath: readTextInputValue("quick-comfy-image-layered-workflow-path-input"),
      comfyUiAudioWorkflowPath: readTextInputValue("quick-comfy-audio-workflow-path-input"),
      comfyUiMusicWorkflowPath: readTextInputValue("quick-comfy-music-workflow-path-input"),
      comfyUiVideoWorkflowPath: readTextInputValue("quick-comfy-video-workflow-path-input")
    };
  }
  function readQuickFfmpegSettingsFromUi() {
    return {
      ffmpegExecutablePath: readTextInputValue("quick-ffmpeg-executable-path-input")
    };
  }
  async function saveComfyPathSettingsFromUi(runtimeInput) {
    const payload = readComfyPathSettingsFromUi();
    const requiredFields = Array.isArray(runtimeInput?.requiredFields) ? runtimeInput.requiredFields : [];
    const fieldLabelByKey = {
      comfyUiBaseUrl: "ComfyUI default base URL",
      comfyUiModelBaseUrl: "3D ComfyUI base URL",
      comfyUiImageBaseUrl: "Image ComfyUI base URL",
      comfyUiAudioBaseUrl: "Audio ComfyUI base URL",
      comfyUiMusicBaseUrl: "Music ComfyUI base URL",
      comfyUiVideoBaseUrl: "Video ComfyUI base URL",
      comfyUiInputDir: "ComfyUI input directory",
      comfyUiModelWorkflowPath: "3D workflow path",
      comfyUiImageWorkflowPath: "Image workflow path",
      comfyUiImageEditWorkflowPath: "Image edit workflow path",
      comfyUiImageUpscaleWorkflowPath: "Image upscale workflow path",
      comfyUiImageLayeredWorkflowPath: "Image layers workflow path",
      comfyUiAudioWorkflowPath: "Audio workflow path",
      comfyUiMusicWorkflowPath: "Music workflow path",
      comfyUiVideoWorkflowPath: "Video workflow path"
    };
    for (const key of requiredFields) {
      if (typeof key !== "string") {
        continue;
      }
      const value = payload[key];
      if (typeof value === "string" && value) {
        continue;
      }
      throw new Error(`Fill ${fieldLabelByKey[key] || key} before saving.`);
    }
    const saved = await request("/api/settings", payload);
    applyGlobalSettingsToUi(saved);
    setComfyPathSettingsStatus(runtimeInput?.statusText || "Saved Comfy endpoint + path settings.", runtimeInput?.statusId);
    return saved;
  }
  async function saveMessagingGlobalSettingsFromUi() {
    const imageStripMetadataNode = document.getElementById("image-strip-metadata-storage");
    const stripMetadataWebUiNode = document.getElementById("strip-metadata-webui");
    const saved = await request("/api/settings", {
      requireConfirmationForLlmSend: readCheckedValue("require-confirmation"),
      stripMetadataWebUiImages: imageStripMetadataNode ? imageStripMetadataNode.checked === true : stripMetadataWebUiNode?.checked === true,
      stripMetadataDiscordImages: readCheckedValue("strip-metadata-discord")
    });
    applyGlobalSettingsToUi(saved);
    return saved;
  }
  async function saveQuickFfmpegSettingsFromUi() {
    const payload = readQuickFfmpegSettingsFromUi();
    const saved = await request("/api/settings", payload);
    applyGlobalSettingsToUi(saved);
    setQuickFfmpegSettingsStatus(payload.ffmpegExecutablePath ? "Saved FFmpeg path." : "Cleared FFmpeg path. Auto-detect is enabled.");
    return saved;
  }
  async function saveMessengerRuntimeSettingsFromUi() {
    const messenger = normalizeMessenger(state.selectedMessenger);
    const saved = await request("/api/settings", {
      messengerSharedSecretsPath: readTextInputValue("messenger-runtime-shared-path-input"),
      [messenger + "RuntimeAutostart"]: readCheckedValue("messenger-runtime-autostart-checkbox")
    });
    applyGlobalSettingsToUi(saved);
    return saved;
  }
  async function saveDiscordRuntimeAutostartFromSettings() {
    const enabled = readCheckedValue("settings-discord-runtime-autostart");
    const saved = await request("/api/settings", {
      discordRuntimeAutostart: enabled
    });
    applyGlobalSettingsToUi(saved);
    setStatusText(
      "settings-messenger-autostart-status",
      enabled
        ? "Discord will start with the dashboard on its next launch."
        : "Discord will remain stopped until you start it from Runtime Control."
    );
    return saved;
  }
  function readMessengerRuntimeLaunchConfigFromUi() {
    return {
      credentialSource: document.getElementById("messenger-runtime-credential-source")?.value || "default",
      safeSecretsPath: readTextInputValue("messenger-runtime-shared-path-input"),
      discordToken: readTextInputValue("messenger-runtime-discord-token-input"),
      telegramBotToken: readTextInputValue("messenger-runtime-telegram-token-input"),
      matrixHomeserverUrl: readTextInputValue("messenger-runtime-matrix-homeserver-input"),
      matrixAccessToken: readTextInputValue("messenger-runtime-matrix-token-input"),
      matrixBotUserId: readTextInputValue("messenger-runtime-matrix-user-id-input"),
      whatsappAccessToken: readTextInputValue("messenger-runtime-whatsapp-token-input"),
      whatsappPhoneNumberId: readTextInputValue("messenger-runtime-whatsapp-phone-id-input"),
      whatsappApiVersion: readTextInputValue("messenger-runtime-whatsapp-api-version-input")
    };
  }
  async function loadMessengerRuntimes() {
    const payload = await request("/api/messenger-runtimes");
    state.messengerRuntimes = Array.isArray(payload.runtimes) ? payload.runtimes : [];
    state.messengerRuntimeEvents = Array.isArray(payload.events) ? payload.events : [];
    renderMessengerRuntimePanel();
    updateMessengerWorkspaceSummary();
    return payload;
  }
  async function controlSelectedMessengerRuntime(action) {
    const messenger = normalizeMessenger(state.selectedMessenger);
    const launchConfig = action === "stop" ? {} : readMessengerRuntimeLaunchConfigFromUi();
    const payload = await request("/api/messenger-runtimes/control", {
      messenger,
      action,
      ...launchConfig
    });
    if (payload && payload.snapshot) {
      state.messengerRuntimes = Array.isArray(payload.snapshot.runtimes) ? payload.snapshot.runtimes : state.messengerRuntimes;
      state.messengerRuntimeEvents = Array.isArray(payload.snapshot.events) ? payload.snapshot.events : state.messengerRuntimeEvents;
    } else if (payload && payload.runtime) {
      const nextRuntime = payload.runtime;
      state.messengerRuntimes = (state.messengerRuntimes || []).filter(entry => entry.messenger !== nextRuntime.messenger);
      state.messengerRuntimes.push(nextRuntime);
    }
    renderMessengerRuntimePanel();
    void loadRuntimeReadiness();
    return payload;
  }
  function formatRuntimeReadinessCheck(key, status) {
    const labelByKey = {
      discord: "Discord",
      remoteWorker: "Remote worker",
      llm: "Active LLM",
      llmModel: "Selected model",
      comfyUi: "ComfyUI"
    };
    return `${labelByKey[key] || key}: ${status}`;
  }
  function formatRemoteWorkerCapacity(capacity) {
    if (!capacity || typeof capacity !== "object" || !capacity.memory || typeof capacity.cpuLogicalCores !== "number") {
      return "";
    }
    const memoryGiB = Math.round((Number(capacity.memory.totalMiB) || 0) / 1024);
    const devices = Array.isArray(capacity.gpu?.devices) ? capacity.gpu.devices : [];
    const gpuSummary = devices.length > 0
      ? devices.map(device => `${String(device.name || "GPU")} ${Math.round((Number(device.freeMemoryMiB) || 0) / 1024)}/${Math.round((Number(device.totalMemoryMiB) || 0) / 1024)} GiB free`).join(", ")
      : "GPU VRAM unavailable";
    return `Worker capacity: ${capacity.cpuLogicalCores} logical CPUs, ${memoryGiB} GiB RAM, ${gpuSummary}`;
  }
  async function loadRuntimeReadiness() {
    const statusNode = document.getElementById("messenger-runtime-readiness-status");
    if (statusNode) {
      statusNode.textContent = "Checking readiness...";
    }
    try {
      const response = await fetch("/ready", {cache: "no-store"});
      const payload = await response.json().catch(() => ({}));
      const checks = payload && typeof payload.checks === "object" && payload.checks ? payload.checks : {};
      const checkSummary = Object.entries(checks)
        .map(([key, status]) => formatRuntimeReadinessCheck(key, String(status || "unknown")))
        .join(" · ");
      if (statusNode) {
        statusNode.textContent = `${payload.ok === true ? "Ready" : "Attention required"}${checkSummary ? ` — ${checkSummary}` : ""}`;
      }
      if (statusNode) {
        const capacitySummary = formatRemoteWorkerCapacity(payload.remoteWorkerCapacity);
        if (capacitySummary && statusNode.dataset.runtimeReadinessFormat === "legacy") {
          statusNode.textContent += ` â€” ${capacitySummary}`;
        }
      }
      if (statusNode && payload.remoteWorkerCapacity) {
        const capacitySummary = formatRemoteWorkerCapacity(payload.remoteWorkerCapacity);
        if (capacitySummary) {
          const readinessSummary = statusNode.textContent.split("Ã¢â‚¬â€")[0].trim();
          statusNode.textContent = [readinessSummary, capacitySummary].filter(Boolean).join(" | ");
        }
      }
      return payload;
    } catch {
      if (statusNode) {
        statusNode.textContent = "Readiness check failed.";
      }
      return null;
    }
  }
  function getInstallerLabel(installerId) {
    if (installerId === "python") return "Python 3.12";
    if (installerId === "ollama") return "Ollama";
    if (installerId === "lmstudio") return "LM Studio";
    if (installerId === "comfyui") return "ComfyUI";
    if (installerId === "blender") return "Blender";
    if (installerId === "ffmpeg") return "FFmpeg";
    return "Installer";
  }
  function describeClientError(error, fallback) {
    if (error instanceof Error && typeof error.message === "string" && error.message.trim()) {
      return error.message.trim();
    }
    const stringified = String(error ?? "").trim();
    return stringified || fallback || "Unknown error";
  }
  async function runInstallerFromUi(installerId, installPath = "", executionMode = "standard", runAsUser = "") {
    const label = getInstallerLabel(installerId);
    const buttons = Array.from(document.querySelectorAll("[data-installer-review-button=\"true\"], #installer-confirm-button"));
    buttons.forEach(button => {
      button.disabled = true;
    });
    setQuickInstallerStatus("Installer status: running " + label + "...");
    try {
      const result = await request("/api/installers/run", { installerId, installPath, executionMode, runAsUser });
      if (result.launchesInteractively) {
        setQuickInstallerStatus("Installer status: " + label + " started in a Windows terminal.");
        setOutput(label + " was started in a Windows terminal. Complete the UAC or Windows credential prompt there.");
        return;
      }
      const exitCodeText = typeof result.exitCode === "number" ? String(result.exitCode) : "0";
      setQuickInstallerStatus("Installer status: " + label + " finished (exit " + exitCodeText + ").");
      if (installerId === "ffmpeg") {
        const output = String(result.stdout || result.stderr || "").trim();
        const match = output.match(/[A-Z]:\\[^\r\n]+ffmpeg\.exe/i);
        if (match && match[0]) {
          setTextInputValue("quick-ffmpeg-executable-path-input", match[0]);
          try {
            await saveQuickFfmpegSettingsFromUi();
          } catch (saveError) {
            setQuickFfmpegSettingsStatus(describeClientError(saveError, "Installed FFmpeg but failed to save the detected path."));
          }
        } else {
          setQuickFfmpegSettingsStatus("FFmpeg installer finished. Save the executable path here if PATH has not refreshed yet.");
        }
      }
      const output = String(result.stdout || result.stderr || "").trim();
      const logPath = String(result.logPath || "").trim();
      setOutput([
        label + " installer completed.",
        logPath ? "Log: " + logPath : "",
        output
      ].filter(Boolean).join("\n\n"));
    } catch (error) {
      const detail = describeClientError(error, label + " installer failed.");
      setQuickInstallerStatus("Installer status: failed for " + label + ". " + detail.slice(0, 280));
      setOutput(detail);
    } finally {
      buttons.forEach(button => {
        button.disabled = false;
      });
    }
  }
  return {
    request,
    describeClientError,
    setRefreshStatus,
    setComfyPathSettingsStatus,
    setQuickComfyPathSettingsStatus,
    setQuickFfmpegSettingsStatus,
    applyQuickComfyPathSettingsToUi,
    applyQuickFfmpegSettingsToUi,
    applyGlobalSettingsToUi,
    renderModerationLog,
    readLlmConnectionSettingsFromUi,
    loadGlobalSettingsFromState,
    saveLlmConnectionSettingsFromUi,
    saveImageLlmConnectionSettingsFromUi,
    saveModel3dLlmConnectionSettingsFromUi,
    saveComfyPathSettingsFromUi,
    saveMessagingGlobalSettingsFromUi,
    saveQuickFfmpegSettingsFromUi,
    readQuickComfyPathSettingsFromUi,
    loadMessengerRuntimes,
    controlSelectedMessengerRuntime,
    loadRuntimeReadiness,
    saveMessengerRuntimeSettingsFromUi,
    saveDiscordRuntimeAutostartFromSettings,
    readMessengerRuntimeLaunchConfigFromUi,
    runInstallerFromUi
  };
}
