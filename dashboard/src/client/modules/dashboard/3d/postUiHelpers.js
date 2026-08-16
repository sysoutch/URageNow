function createDashboardThreeDPostUiHelpers(input) {
  const LOW_POLY_FACE_PRESETS = [500, 1000, 1500, 3000, 5000];
  const state = input && input.state ? input.state : {};
  const request = input && typeof input.request === "function" ? input.request : null;
  const setOutput = input && typeof input.setOutput === "function" ? input.setOutput : null;
  let cachedTelegramOptions = [];
  let cachedWhatsAppOptions = [];

  function readValue(id) {
    const node = document.getElementById(id);
    return node && typeof node.value === "string" ? node.value.trim() : "";
  }

  function readChecked(id) {
    const node = document.getElementById(id);
    return Boolean(node && node.checked);
  }

  function toggleHidden(id, hidden) {
    const node = document.getElementById(id);
    if (!node) {
      return;
    }
    node.classList.toggle("hidden", hidden);
  }

  function normalizeFaceCount(value, fallback) {
    const parsed = Number.parseInt(String(value || ""), 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      return fallback;
    }
    return Math.max(1, Math.round(parsed));
  }

  function resolveLowPolyPresetId(faceCount) {
    const normalized = normalizeFaceCount(faceCount, 1500);
    return LOW_POLY_FACE_PRESETS.includes(normalized) ? String(normalized) : "custom";
  }

  function syncLowPolyPresetFromFaceCount() {
    const presetSelect = document.getElementById("model3d-lowpoly-target-face-preset");
    const faceInput = document.getElementById("model3d-lowpoly-target-face-count");
    if (!presetSelect || !faceInput || typeof presetSelect.value !== "string" || typeof faceInput.value !== "string") {
      return;
    }
    const presetId = resolveLowPolyPresetId(faceInput.value);
    presetSelect.value = presetId;
    if (typeof faceInput.disabled === "boolean") {
      faceInput.disabled = presetId !== "custom";
    }
  }

  function applyLowPolyPresetToFaceCount() {
    const presetSelect = document.getElementById("model3d-lowpoly-target-face-preset");
    const faceInput = document.getElementById("model3d-lowpoly-target-face-count");
    if (!presetSelect || !faceInput || typeof presetSelect.value !== "string" || typeof faceInput.value !== "string") {
      return;
    }
    if (presetSelect.value !== "custom") {
      faceInput.value = String(normalizeFaceCount(presetSelect.value, 1500));
    }
    if (typeof faceInput.disabled === "boolean") {
      faceInput.disabled = presetSelect.value !== "custom";
    }
  }

  function normalizePostMessenger(value) {
    if (value === "discord" || value === "telegram" || value === "matrix" || value === "whatsapp") {
      return value;
    }
    return "none";
  }

  function isForumChannel(channel) {
    return Boolean(channel && String(channel.kind || "").toLowerCase().includes("forum"));
  }

  function isDiscordSendablePostChannel(channel) {
    return Boolean(channel && channel.canSendMessages && !channel.isVoice && !isForumChannel(channel));
  }

  function buildDiscordPostDestinationOptions() {
    const channels = Array.isArray(state.channels) ? state.channels : [];
    return channels
      .filter(isDiscordSendablePostChannel)
      .map(channel => ({
        id: String(channel.id || "").trim(),
        label: "#" + String(channel.name || "channel") + " | " + String(channel.id || "")
      }))
      .filter(entry => entry.id);
  }

  function buildTelegramPostDestinationOptions(chats) {
    if (!Array.isArray(chats)) {
      return [];
    }
    return chats
      .map(chat => {
        const chatId = String(chat && (chat.chatId ?? chat.id ?? "") || "").trim();
        const title = String(chat && (chat.title ?? chat.name ?? "") || "").trim() || ("Chat " + chatId);
        if (!chatId) {
          return null;
        }
        return { id: chatId, label: title + " | " + chatId };
      })
      .filter(Boolean);
  }

  function buildWhatsAppPostDestinationOptions(contacts) {
    if (!Array.isArray(contacts)) {
      return [];
    }
    return contacts
      .map(contact => {
        const destinationId = String(
          contact && (
            contact.to
            || contact.phoneNumber
            || contact.phone
            || contact.e164
            || contact.waId
            || contact.id
            || ""
          ) || ""
        ).trim();
        const label = String(contact && (contact.name || contact.displayName || contact.label || "") || "").trim() || "Contact";
        if (!destinationId) {
          return null;
        }
        return { id: destinationId, label: label + " | " + destinationId };
      })
      .filter(Boolean);
  }

  function appendCustomDestinationOption(selectNode, destinationId) {
    if (!selectNode || !destinationId) {
      return;
    }
    const existing = Array.from(selectNode.options || []).find(option => String(option.value || "").trim() === destinationId);
    if (existing) {
      return;
    }
    const option = document.createElement("option");
    option.value = destinationId;
    option.textContent = "Custom destination | " + destinationId;
    selectNode.appendChild(option);
  }

  function refillPostDestinationSelect(selectNode, options, emptyLabel, selectedValue) {
    if (!selectNode) {
      return;
    }
    const normalizedSelection = String(selectedValue || "").trim();
    while (selectNode.firstChild) {
      selectNode.removeChild(selectNode.firstChild);
    }
    const emptyOption = document.createElement("option");
    emptyOption.value = "";
    emptyOption.textContent = emptyLabel;
    selectNode.appendChild(emptyOption);
    options.forEach(entry => {
      const option = document.createElement("option");
      option.value = entry.id;
      option.textContent = entry.label;
      selectNode.appendChild(option);
    });
    if (!normalizedSelection) {
      selectNode.value = "";
      return;
    }
    if (!options.some(entry => entry.id === normalizedSelection)) {
      appendCustomDestinationOption(selectNode, normalizedSelection);
    }
    selectNode.value = normalizedSelection;
  }

  async function loadModel3dPostDestinationOptions(messenger) {
    if (messenger === "discord") {
      return buildDiscordPostDestinationOptions();
    }
    if (messenger === "telegram") {
      const knownChats = Array.isArray(state.telegramChats) ? state.telegramChats : [];
      if (knownChats.length > 0) {
        cachedTelegramOptions = buildTelegramPostDestinationOptions(knownChats);
        return cachedTelegramOptions;
      }
      if (cachedTelegramOptions.length > 0) {
        return cachedTelegramOptions;
      }
      if (!request) {
        return [];
      }
      const payload = await request("/api/telegram/chats");
      state.telegramChats = Array.isArray(payload.chats) ? payload.chats : [];
      cachedTelegramOptions = buildTelegramPostDestinationOptions(state.telegramChats);
      return cachedTelegramOptions;
    }
    if (messenger === "whatsapp") {
      if (cachedWhatsAppOptions.length > 0) {
        return cachedWhatsAppOptions;
      }
      if (!request) {
        return [];
      }
      const payload = await request("/api/whatsapp/contacts");
      cachedWhatsAppOptions = buildWhatsAppPostDestinationOptions(Array.isArray(payload.contacts) ? payload.contacts : []);
      return cachedWhatsAppOptions;
    }
    return [];
  }

  async function refreshModel3dPostDestinationOptions() {
    const destinationNode = document.getElementById("model3d-post-destination-input");
    const messenger = normalizePostMessenger(readValue("model3d-post-messenger-select"));
    if (!destinationNode || messenger === "none") {
      return;
    }
    if (messenger === "matrix") {
      refillPostDestinationSelect(destinationNode, [], "Matrix posting is not wired yet", "");
      destinationNode.disabled = true;
      return;
    }
    const fallbackDestination = messenger === "discord"
      ? String(state.selectedChannelId || "").trim()
      : messenger === "telegram"
        ? String(state.selectedTelegramChatId || "").trim()
        : "";
    const currentDestination = String(destinationNode.value || "").trim() || fallbackDestination;
    try {
      const options = await loadModel3dPostDestinationOptions(messenger);
      const emptyLabel = messenger === "discord"
        ? "Choose Discord channel"
        : messenger === "telegram"
          ? "Choose Telegram chat"
          : "Choose WhatsApp contact";
      refillPostDestinationSelect(destinationNode, options, emptyLabel, currentDestination);
      destinationNode.disabled = false;
    } catch (error) {
      refillPostDestinationSelect(destinationNode, [], "Failed to load destinations", currentDestination);
      destinationNode.disabled = false;
      if (setOutput) {
        const detail = error && error.message ? error.message : "Unknown error";
        setOutput("Failed to load " + messenger + " destinations: " + detail);
      }
    }
  }

  function readModel3dPostOptions() {
    const lowPolyTargetFaceCount = Number.parseInt(readValue("model3d-lowpoly-target-face-count"), 10);
    const threadNameModeRaw = readValue("model3d-thread-name-mode");
    const threadNameMode = threadNameModeRaw === "increment" || threadNameModeRaw === "model-name" ? threadNameModeRaw : "fixed";
    const postMessenger = normalizePostMessenger(readValue("model3d-post-messenger-select"));
    return {
      postMessenger,
      postDestinationId: readValue("model3d-post-destination-input"),
      postToChannel: postMessenger === "discord",
      postTargetMode: readValue("model3d-post-target-mode") || "channel",
      threadNameMode,
      threadName: readValue("model3d-thread-name"),
      threadNameBase: readValue("model3d-thread-base"),
      modelNameSource: readValue("model3d-model-name-source") === "filename" ? "filename" : "llm",
      forumChannelId: readValue("model3d-forum-channel-id"),
      forumChannelName: readValue("model3d-forum-channel-name"),
      lowPolyForumChannelId: readValue("model3d-lowpoly-forum-channel-id"),
      sendInitialToSelectedChannel: readChecked("model3d-send-initial"),
      initialExtraText: readValue("model3d-initial-extra"),
      destinationExtraText: readValue("model3d-destination-extra"),
      modelUploadTarget: readValue("model3d-model-upload-target") === "target" ? "target" : "selected",
      includeModelFile: readChecked("model3d-include-model"),
      includePreviewMedia: readChecked("model3d-include-preview"),
      includeEmbed: readChecked("model3d-include-embed"),
      includeEmbedInInitial: readChecked("model3d-embed-in-initial"),
      includeButtons: readChecked("model3d-include-buttons"),
      uploadTextureMessages: readChecked("model3d-upload-textures"),
      textureUploadTarget: readValue("model3d-texture-upload-target") === "selected" ? "selected" : "target",
      uploadMultiViewTextures: readChecked("model3d-upload-multiview"),
      uploadUvMapTextures: readChecked("model3d-upload-uv"),
      uploadNormalMapTextures: readChecked("model3d-upload-normal"),
      generateLowPolyVersion: readChecked("model3d-generate-lowpoly"),
      lowPolyUseLlmTargetFaces: readChecked("model3d-lowpoly-use-llm-target-faces"),
      lowPolyLlmDecisionSource: readValue("model3d-lowpoly-llm-decision-source") === "model-render" ? "model-render" : "input-image",
      lowPolyTargetFaceCount: Number.isFinite(lowPolyTargetFaceCount) && lowPolyTargetFaceCount > 0 ? lowPolyTargetFaceCount : 1500
    };
  }

  function validateModel3dPostOptions(options, selectedChannelId) {
    const destinationId = String(options.postDestinationId || "").trim() || String(selectedChannelId || "").trim();
    if (options.postMessenger !== "none" && !destinationId) {
      return "Choose a destination if you want to post the generated model.";
    }
    if (options.postMessenger === "matrix") {
      return "Matrix posting from LazyDev is not wired yet.";
    }
    if (options.postMessenger !== "discord") {
      return "";
    }
    if (options.postTargetMode !== "channel" && options.threadNameMode === "fixed" && !options.threadName) {
      return "Set a post/thread name for fixed naming mode.";
    }
    if (options.postTargetMode !== "channel" && options.threadNameMode === "increment" && !options.threadNameBase) {
      return "Set a base name for increment naming mode.";
    }
    if (options.postTargetMode === "forum-create-and-post" && !options.forumChannelName) {
      if (!options.forumChannelId) {
        return "Select a forum channel or set a forum channel name for forum-create mode.";
      }
    }
    if (options.postTargetMode === "forum-post" && !options.forumChannelId) {
      return "Select the forum channel where model posts should be created.";
    }
    return "";
  }

  function updateModel3dPostOptionsUi() {
    const options = readModel3dPostOptions();
    const postToDiscord = options.postMessenger === "discord";
    const postToTelegram = options.postMessenger === "telegram";
    const postToAny = options.postMessenger !== "none";
    const postDestinationHintNode = document.getElementById("model3d-post-destination-hint");
    const postDestinationNode = document.getElementById("model3d-post-destination-input");
    const useSelectedButton = document.getElementById("model3d-post-use-selected-discord-button");
    if (postDestinationHintNode) {
      if (options.postMessenger === "discord") {
        postDestinationHintNode.textContent = "Choose a Discord channel from the list.";
      } else if (options.postMessenger === "telegram") {
        postDestinationHintNode.textContent = "Choose a Telegram chat from the list.";
      } else if (options.postMessenger === "whatsapp") {
        postDestinationHintNode.textContent = "Choose a WhatsApp contact from the list.";
      } else if (options.postMessenger === "matrix") {
        postDestinationHintNode.textContent = "Matrix posting is not wired yet.";
      } else {
        postDestinationHintNode.textContent = "Pick a messenger and choose a destination.";
      }
    }
    if (postDestinationNode) {
      postDestinationNode.disabled = options.postMessenger === "none" || options.postMessenger === "matrix";
    }
    if (useSelectedButton) {
      useSelectedButton.textContent = postToTelegram ? "Use Selected Telegram Chat" : "Use Selected Discord Channel";
    }
    const createLowPolyAfterGeneration = readChecked("model3d-create-lowpoly-after-generation");
    const isEditTabActive = document.getElementById("model3d-studio-panel-edit")?.classList.contains("active") === true;
    const useThreadNaming = postToDiscord && (options.postTargetMode === "thread" || options.postTargetMode === "forum-post" || options.postTargetMode === "forum-create-and-post");
    const useThreadIncrement = useThreadNaming && options.threadNameMode === "increment";
    const useModelNameMode = useThreadNaming && options.threadNameMode === "model-name";
    const showInitialControls = useThreadNaming && options.sendInitialToSelectedChannel;
    const showModelUploadTarget = useThreadNaming && options.sendInitialToSelectedChannel && options.includeModelFile;
    const showTextureOptions = postToDiscord && options.uploadTextureMessages;
    const showLowPolyOptions = isEditTabActive || createLowPolyAfterGeneration || (postToDiscord && options.generateLowPolyVersion);
    const showLowPolyManualTargetOptions = !options.lowPolyUseLlmTargetFaces;
    const showLowPolyLlmDecisionSource = options.lowPolyUseLlmTargetFaces;
    const showLowPolyForumTarget = postToDiscord && options.generateLowPolyVersion;
    const useForumPost = postToDiscord && options.postTargetMode === "forum-post";
    const useForumCreate = postToDiscord && options.postTargetMode === "forum-create-and-post";
    toggleHidden("model3d-post-destination-input", !postToAny);
    toggleHidden("model3d-post-use-selected-discord-row", !(postToDiscord || postToTelegram));
    toggleHidden("model3d-post-target-field", !postToDiscord);
    toggleHidden("model3d-thread-name-mode-field", !useThreadNaming);
    toggleHidden("model3d-model-name-source-field", !useModelNameMode);
    toggleHidden("model3d-thread-name-field", !useThreadNaming || useThreadIncrement || useModelNameMode);
    toggleHidden("model3d-thread-base-field", !useThreadNaming || !useThreadIncrement);
    toggleHidden("model3d-forum-channel-id-field", !(useForumPost || useForumCreate));
    toggleHidden("model3d-forum-channel-name-field", !useForumCreate);
    toggleHidden("model3d-send-initial-toggle", !useThreadNaming);
    toggleHidden("model3d-initial-extra-field", !showInitialControls);
    toggleHidden("model3d-embed-in-initial-toggle", !showInitialControls);
    toggleHidden("model3d-model-upload-target-field", !showModelUploadTarget);
    toggleHidden("model3d-destination-extra-field", !postToDiscord);
    toggleHidden("model3d-include-model-toggle", !postToDiscord);
    toggleHidden("model3d-include-preview-toggle", !postToDiscord);
    toggleHidden("model3d-include-embed-toggle", !postToDiscord);
    toggleHidden("model3d-include-buttons-toggle", !postToDiscord);
    toggleHidden("model3d-upload-textures-toggle", !postToDiscord);
    toggleHidden("model3d-texture-upload-target-field", !showTextureOptions);
    toggleHidden("model3d-upload-multiview-toggle", !showTextureOptions);
    toggleHidden("model3d-upload-uv-toggle", !showTextureOptions);
    toggleHidden("model3d-upload-normal-toggle", !showTextureOptions);
    toggleHidden("model3d-generate-lowpoly-toggle", !postToDiscord);
    toggleHidden("model3d-lowpoly-shared-controls", !showLowPolyOptions);
    toggleHidden("model3d-lowpoly-use-llm-target-faces-toggle", !showLowPolyOptions);
    toggleHidden("model3d-lowpoly-llm-decision-source-field", !showLowPolyLlmDecisionSource);
    toggleHidden("model3d-lowpoly-target-face-preset-field", !showLowPolyManualTargetOptions);
    toggleHidden("model3d-lowpoly-target-face-count-field", !showLowPolyManualTargetOptions);
    toggleHidden("model3d-lowpoly-max-colors", !showLowPolyOptions);
    toggleHidden("model3d-lowpoly-forum-channel-id-field", !showLowPolyForumTarget);
    syncLowPolyPresetFromFaceCount();
    void refreshModel3dPostDestinationOptions();
  }

  return {
    readModel3dPostOptions,
    validateModel3dPostOptions,
    updateModel3dPostOptionsUi,
    refreshModel3dPostDestinationOptions,
    syncLowPolyPresetFromFaceCount,
    applyLowPolyPresetToFaceCount
  };
}
