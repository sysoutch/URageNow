function createDashboardAutomationViewHelpers(input) {
  function bindElementEvent(id, eventName, handler) {
    const node = document.getElementById(id);
    if (!node) {
      return;
    }
    node.addEventListener(eventName, handler);
  }

  function normalizeTelegramChatId(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
    return String(value || "").trim();
  }

  function normalizeMatrixRoomId(value) {
    return String(value || "").trim();
  }

  function normalizeScheduledTargetMessenger(value) {
    return value === "telegram" || value === "matrix" ? value : "discord";
  }

  function resolveChannelLabel(channelId, fallback, messenger) {
    if (messenger === "telegram") {
      const normalizedId = normalizeTelegramChatId(channelId);
      if (!normalizedId) {
        return fallback || "No Telegram chat selected";
      }
      const chat = Array.isArray(input.state.telegramChats)
        ? input.state.telegramChats.find(entry => normalizeTelegramChatId(entry && entry.chatId) === normalizedId)
        : null;
      if (chat) {
        const title = String(chat.title || "").trim() || `Chat ${normalizedId}`;
        return `Telegram ${title} | ${normalizedId}`;
      }
      return `Telegram chat ${normalizedId}`;
    }
    if (messenger === "matrix") {
      const normalizedId = normalizeMatrixRoomId(channelId);
      if (!normalizedId) {
        return fallback || "No Matrix room selected";
      }
      return `Matrix room ${normalizedId}`;
    }
    const channel = input.state.channels.find(item => item.id === channelId);
    if (channel) {
      return (channel.isVoice ? "Voice " : "#") + channel.name;
    }
    return fallback || channelId || "No channel selected";
  }

  function updateScheduledTargetModeUi() {
    const targetMessenger = normalizeScheduledTargetMessenger(input.state.scheduledTargetMessenger);
    input.state.scheduledTargetMessenger = targetMessenger;
    const scheduledTargetMessengerSelect = document.getElementById("scheduled-target-messenger-select");
    if (scheduledTargetMessengerSelect && typeof scheduledTargetMessengerSelect.value === "string") {
      scheduledTargetMessengerSelect.value = targetMessenger;
    }
    const isTelegram = targetMessenger === "telegram";
    const isMatrix = targetMessenger === "matrix";
    const isExternalMessenger = isTelegram || isMatrix;
    const discordField = document.getElementById("scheduled-target-discord-field");
    if (discordField) {
      discordField.classList.toggle("hidden", isExternalMessenger);
    }
    const discordActions = document.getElementById("scheduled-target-discord-actions");
    if (discordActions) {
      discordActions.classList.toggle("hidden", isExternalMessenger);
    }
    const telegramField = document.getElementById("scheduled-target-telegram-field");
    if (telegramField) {
      telegramField.classList.toggle("hidden", !isTelegram);
    }
    const telegramActions = document.getElementById("scheduled-target-telegram-actions");
    if (telegramActions) {
      telegramActions.classList.toggle("hidden", !isTelegram);
    }
    const telegramChatInput = document.getElementById("scheduled-target-telegram-chat-id");
    if (telegramChatInput && typeof telegramChatInput.value === "string") {
      telegramChatInput.value = isTelegram ? (input.state.scheduledTargetChannelId || "") : "";
    }
    const matrixField = document.getElementById("scheduled-target-matrix-field");
    if (matrixField) {
      matrixField.classList.toggle("hidden", !isMatrix);
    }
    const matrixActions = document.getElementById("scheduled-target-matrix-actions");
    if (matrixActions) {
      matrixActions.classList.toggle("hidden", !isMatrix);
    }
    const matrixRoomInput = document.getElementById("scheduled-target-matrix-room-id");
    if (matrixRoomInput && typeof matrixRoomInput.value === "string") {
      matrixRoomInput.value = isMatrix ? (input.state.scheduledTargetChannelId || "") : "";
    }
    const sourceSelect = document.getElementById("scheduled-source");
    if (sourceSelect && sourceSelect.options) {
      const modelOption = Array.from(sourceSelect.options).find(option => option.value === "model-3d");
      if (modelOption) {
        modelOption.disabled = isExternalMessenger;
      }
      if (isExternalMessenger && sourceSelect.value === "model-3d") {
        sourceSelect.value = "template";
      }
    }
  }

  function buildCronFromBasicSchedule() {
    const pattern = document.getElementById("scheduled-basic-pattern").value;
    const time = document.getElementById("scheduled-basic-time").value || "09:00";
    const parts = time.split(":");
    const hour = Number.parseInt(parts[0], 10);
    const minute = Number.parseInt(parts[1], 10);
    const safeHour = Number.isFinite(hour) ? Math.min(23, Math.max(0, hour)) : 9;
    const safeMinute = Number.isFinite(minute) ? Math.min(59, Math.max(0, minute)) : 0;
    const weekday = document.getElementById("scheduled-basic-weekday").value || "1";
    const monthDay = Math.min(31, Math.max(1, Number.parseInt(document.getElementById("scheduled-basic-monthday").value, 10) || 1));

    if (pattern === "weekdays") {
      return safeMinute + " " + safeHour + " * * 1-5";
    }
    if (pattern === "weekly") {
      return safeMinute + " " + safeHour + " * * " + weekday;
    }
    if (pattern === "monthly") {
      return safeMinute + " " + safeHour + " " + monthDay + " * *";
    }
    return safeMinute + " " + safeHour + " * * *";
  }

  function parseCronToBasic(cron) {
    const parts = String(cron || "").trim().split(/\s+/);
    if (parts.length !== 5) {
      return null;
    }
    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
    if (month !== "*") {
      return null;
    }
    if (!/^\d+$/.test(minute) || !/^\d+$/.test(hour)) {
      return null;
    }
    const hh = String(Math.min(23, Math.max(0, Number.parseInt(hour, 10)))).padStart(2, "0");
    const mm = String(Math.min(59, Math.max(0, Number.parseInt(minute, 10)))).padStart(2, "0");
    const time = hh + ":" + mm;
    if (dayOfMonth === "*" && dayOfWeek === "*") {
      return { pattern: "daily", time, weekday: "1", monthDay: "1" };
    }
    if (dayOfMonth === "*" && dayOfWeek === "1-5") {
      return { pattern: "weekdays", time, weekday: "1", monthDay: "1" };
    }
    if (dayOfMonth === "*" && /^[0-6]$/.test(dayOfWeek)) {
      return { pattern: "weekly", time, weekday: dayOfWeek, monthDay: "1" };
    }
    if (/^\d+$/.test(dayOfMonth) && dayOfWeek === "*") {
      return { pattern: "monthly", time, weekday: "1", monthDay: dayOfMonth };
    }
    return null;
  }

  function updateScheduledTimingUi() {
    const intervalValue = Math.max(1, Number.parseInt(document.getElementById("scheduled-interval-value").value, 10) || 1);
    const intervalUnit = document.getElementById("scheduled-interval-unit").value || "days";
    document.getElementById("scheduled-interval-preview").textContent =
      "Runs every " + intervalValue + " " + intervalUnit.replace(/s$/, "") + (intervalValue === 1 ? "." : "s.");
    const pattern = document.getElementById("scheduled-basic-pattern").value;
    document.getElementById("scheduled-weekday-field").classList.toggle("hidden", pattern !== "weekly");
    document.getElementById("scheduled-monthday-field").classList.toggle("hidden", pattern !== "monthly");
    const cron = input.state.scheduleMode === "basic"
      ? buildCronFromBasicSchedule()
      : (document.getElementById("scheduled-cron").value.trim() || "0 9 * * *");
    document.getElementById("scheduled-cron").value = cron;
    document.getElementById("scheduled-cron-preview").textContent = cron;
  }

  function switchScheduledTriggerMode(mode) {
    input.state.scheduledTriggerMode = mode === "interval" ? "interval" : "cron";
    document.querySelectorAll("[data-scheduled-trigger-mode]").forEach(button => {
      button.classList.toggle("active", button.getAttribute("data-scheduled-trigger-mode") === input.state.scheduledTriggerMode);
    });
    document.getElementById("scheduled-cron-panels").classList.toggle("hidden", input.state.scheduledTriggerMode !== "cron");
    document.getElementById("scheduled-interval-panel").classList.toggle("hidden", input.state.scheduledTriggerMode !== "interval");
    updateScheduledTimingUi();
  }

  function switchScheduleMode(mode) {
    input.state.scheduleMode = mode === "advanced" ? "advanced" : "basic";
    document.querySelectorAll("[data-schedule-mode]").forEach(button => {
      button.classList.toggle("active", button.getAttribute("data-schedule-mode") === input.state.scheduleMode);
    });
    document.getElementById("scheduled-basic-panel").classList.toggle("hidden", input.state.scheduleMode !== "basic");
    document.getElementById("scheduled-advanced-panel").classList.toggle("hidden", input.state.scheduleMode !== "advanced");
    updateScheduledTimingUi();
  }

  function switchAutomationPanel(panel) {
    input.state.automationPanel = panel === "join" && input.state.selectedMessenger === "discord" ? "join" : "scheduled";
    document.querySelectorAll("[data-automation-panel]").forEach(button => {
      button.classList.toggle("active", button.getAttribute("data-automation-panel") === input.state.automationPanel);
    });
    document.getElementById("automation-panel-scheduled").classList.toggle("active", input.state.automationPanel === "scheduled");
    document.getElementById("automation-panel-join").classList.toggle("active", input.state.automationPanel === "join");
  }

  function switchChannelSettingsTab(tab) {
    input.state.channelSettingsTab = tab === "quick" ? "quick" : "discord";
    document.querySelectorAll("[data-channel-settings-tab]").forEach(button => {
      button.classList.toggle("active", button.getAttribute("data-channel-settings-tab") === input.state.channelSettingsTab);
    });
    const discordPanel = document.getElementById("channel-settings-panel-discord");
    const quickPanel = document.getElementById("channel-settings-panel-quick");
    if (discordPanel) {
      discordPanel.classList.toggle("hidden", input.state.channelSettingsTab !== "discord");
    }
    if (quickPanel) {
      quickPanel.classList.toggle("hidden", input.state.channelSettingsTab !== "quick");
    }
  }

  function updateAutomationTargetChips() {
    const scheduledChip = document.getElementById("scheduled-target-channel-chip");
    if (scheduledChip) {
      scheduledChip.textContent = input.state.scheduledTargetChannelId
        ? resolveChannelLabel(
          input.state.scheduledTargetChannelId,
          "Stored scheduled target",
          input.state.scheduledTargetMessenger
        )
        : (input.state.scheduledTargetMessenger === "telegram"
          ? "Choose a Telegram chat, then use it here."
          : input.state.scheduledTargetMessenger === "matrix"
            ? "Enter a Matrix room ID, then use it here."
            : "Choose a channel in the sidebar, then use it here.");
    }
    const joinChip = document.getElementById("join-target-channel-chip");
    if (joinChip) {
      joinChip.textContent = input.state.joinTargetChannelId
        ? resolveChannelLabel(input.state.joinTargetChannelId, "Stored join target")
        : "Choose a channel in the sidebar, then use it here.";
    }
  }

  function updateScheduledSourceFields() {
    updateScheduledTargetModeUi();
    const source = document.getElementById("scheduled-source").value;
    const usesTextSource = source === "jokes-file" || source === "image" || source === "model-3d";
    document.getElementById("scheduled-jokes-file-field").classList.toggle("hidden", source !== "jokes-file");
    document.getElementById("scheduled-prompt-field").classList.toggle("hidden", source !== "ollama" && source !== "image" && source !== "model-3d");
    document.getElementById("scheduled-prompt-text-file-field").classList.toggle("hidden", source !== "image" && source !== "model-3d");
    document.getElementById("scheduled-text-source-selection-field").classList.toggle("hidden", !usesTextSource);
    document.getElementById("scheduled-image-auto-prompt-toggle").classList.toggle("hidden", source !== "image");
    document.getElementById("scheduled-image-auto-filename-toggle").classList.toggle("hidden", source !== "image");
    document.getElementById("scheduled-image-auto-description-toggle").classList.toggle("hidden", source !== "image");
    document.getElementById("scheduled-image-candidates-field").classList.toggle("hidden", source !== "image");
    document.getElementById("scheduled-image-video-followup-field").classList.toggle("hidden", source !== "image");
    document.getElementById("scheduled-image-post-processing-field").classList.toggle("hidden", source !== "image");
    document.getElementById("scheduled-template-field").classList.toggle("hidden", source !== "template");
    document.getElementById("scheduled-model-image-field").classList.toggle("hidden", source !== "model-3d");
    updateScheduledImagePostOptionsUi();
    updateScheduledImageCandidateUi();
    if (source === "model-3d") {
      updateScheduledModelPostOptionsUi();
    }
  }

  function updateScheduledImageCandidateUi() {
    const enabled = document.getElementById("scheduled-image-candidate-selection-enabled")?.checked === true;
    const options = document.getElementById("scheduled-image-candidate-options");
    if (options) {
      options.classList.toggle("hidden", !enabled);
    }
  }

  function updateScheduledImagePostOptionsUi() {
    const module = input.getScheduledModelPostOptionsModule();
    if (!module || typeof module.updateImageUi !== "function") {
      return;
    }
    module.updateImageUi(document.getElementById("scheduled-source").value);
  }

  function updateScheduledModelPostOptionsUi() {
    const module = input.getScheduledModelPostOptionsModule();
    if (!module) {
      return;
    }
    module.updateUi(document.getElementById("scheduled-source").value);
  }

  function applyScheduledLowPolyPreset() {
    const module = input.getScheduledModelPostOptionsModule();
    if (!module || typeof module.applyLowPolyPresetToFaceCount !== "function") {
      return;
    }
    module.applyLowPolyPresetToFaceCount();
  }

  function syncScheduledLowPolyPreset() {
    const module = input.getScheduledModelPostOptionsModule();
    if (!module || typeof module.syncLowPolyPresetFromFaceCount !== "function") {
      return;
    }
    module.syncLowPolyPresetFromFaceCount();
  }

  function updateJoinSourceFields() {
    const source = document.getElementById("join-source").value;
    const usesTextSource = source === "jokes-file" || source === "image" || source === "model-3d";
    document.getElementById("join-jokes-file-field").classList.toggle("hidden", source !== "jokes-file");
    document.getElementById("join-prompt-field").classList.toggle("hidden", source !== "ollama" && source !== "model-3d");
    document.getElementById("join-prompt-text-file-field").classList.toggle("hidden", source !== "model-3d" && source !== "image");
    document.getElementById("join-text-source-selection-field").classList.toggle("hidden", !usesTextSource);
    document.getElementById("join-template-field").classList.toggle("hidden", source !== "template");
    document.getElementById("join-model-image-field").classList.toggle("hidden", source !== "model-3d");
  }

  function bindCoreEvents() {
    document.querySelectorAll("[data-automation-panel]").forEach(button => {
      button.addEventListener("click", event => {
        switchAutomationPanel(event.currentTarget.getAttribute("data-automation-panel"));
      });
    });
    document.querySelectorAll("[data-schedule-mode]").forEach(button => {
      button.addEventListener("click", event => {
        switchScheduleMode(event.currentTarget.getAttribute("data-schedule-mode"));
      });
    });
    document.querySelectorAll("[data-scheduled-trigger-mode]").forEach(button => {
      button.addEventListener("click", event => {
        switchScheduledTriggerMode(event.currentTarget.getAttribute("data-scheduled-trigger-mode"));
      });
    });
    bindElementEvent("scheduled-basic-pattern", "change", updateScheduledTimingUi);
    bindElementEvent("scheduled-basic-time", "input", updateScheduledTimingUi);
    bindElementEvent("scheduled-basic-weekday", "change", updateScheduledTimingUi);
    bindElementEvent("scheduled-basic-monthday", "input", updateScheduledTimingUi);
    bindElementEvent("scheduled-cron", "input", updateScheduledTimingUi);
    bindElementEvent("scheduled-interval-value", "input", updateScheduledTimingUi);
    bindElementEvent("scheduled-interval-unit", "change", updateScheduledTimingUi);
    bindElementEvent("scheduled-target-messenger-select", "change", event => {
      const nextMessenger = normalizeScheduledTargetMessenger(event.currentTarget && typeof event.currentTarget.value === "string"
        ? event.currentTarget.value
        : "discord");
      input.state.scheduledTargetMessenger = nextMessenger;
      if (nextMessenger === "discord" && !input.state.scheduledTargetChannelId) {
        input.state.scheduledTargetChannelId = input.state.selectedChannelId || "";
      }
      if (nextMessenger === "telegram" && !input.state.scheduledTargetChannelId) {
        input.state.scheduledTargetChannelId = normalizeTelegramChatId(input.state.selectedTelegramChatId);
      }
      if (nextMessenger === "matrix" && !input.state.scheduledTargetChannelId) {
        input.state.scheduledTargetChannelId = normalizeMatrixRoomId(input.state.selectedMatrixRoomId);
      }
      updateScheduledSourceFields();
      updateAutomationTargetChips();
    });
    bindElementEvent("scheduled-target-telegram-chat-id", "input", event => {
      if (input.state.scheduledTargetMessenger !== "telegram") {
        return;
      }
      const nextChatId = normalizeTelegramChatId(event.currentTarget && typeof event.currentTarget.value === "string"
        ? event.currentTarget.value
        : "");
      input.state.scheduledTargetChannelId = nextChatId;
      updateAutomationTargetChips();
    });
    bindElementEvent("scheduled-target-matrix-room-id", "input", event => {
      if (input.state.scheduledTargetMessenger !== "matrix") {
        return;
      }
      const nextRoomId = normalizeMatrixRoomId(event.currentTarget && typeof event.currentTarget.value === "string"
        ? event.currentTarget.value
        : "");
      input.state.scheduledTargetChannelId = nextRoomId;
      updateAutomationTargetChips();
    });
    bindElementEvent("scheduled-source", "change", updateScheduledSourceFields);
    bindElementEvent("scheduled-image-candidate-selection-enabled", "change", updateScheduledImageCandidateUi);
    bindElementEvent("scheduled-image-post-target-mode", "change", updateScheduledImagePostOptionsUi);
    bindElementEvent("scheduled-image-thread-name-mode", "change", updateScheduledImagePostOptionsUi);
    bindElementEvent("scheduled-image-send-initial", "change", updateScheduledImagePostOptionsUi);
    bindElementEvent("scheduled-image-selected-channel-image-mode", "change", updateScheduledImagePostOptionsUi);
    bindElementEvent("scheduled-image-variant-remove-background", "change", updateScheduledImagePostOptionsUi);
    bindElementEvent("scheduled-image-variant-delight", "change", updateScheduledImagePostOptionsUi);
    bindElementEvent("scheduled-image-variant-pixel-art", "change", updateScheduledImagePostOptionsUi);
    bindElementEvent("scheduled-image-variant-recipes", "input", updateScheduledImagePostOptionsUi);
    bindElementEvent("scheduled-image-add-variant-target-button", "click", () => {
      const module = input.getScheduledModelPostOptionsModule();
      if (module && typeof module.addImageVariantTargetRoute === "function") {
        module.addImageVariantTargetRoute();
      }
    });
    bindElementEvent("scheduled-model-post-target-mode", "change", updateScheduledModelPostOptionsUi);
    bindElementEvent("scheduled-model-thread-name-mode", "change", updateScheduledModelPostOptionsUi);
    bindElementEvent("scheduled-model-send-initial", "change", updateScheduledModelPostOptionsUi);
    bindElementEvent("scheduled-model-include-model", "change", updateScheduledModelPostOptionsUi);
    bindElementEvent("scheduled-model-upload-textures", "change", updateScheduledModelPostOptionsUi);
    bindElementEvent("scheduled-model-generate-lowpoly", "change", updateScheduledModelPostOptionsUi);
    bindElementEvent("scheduled-model-lowpoly-use-llm-target-faces", "change", updateScheduledModelPostOptionsUi);
    bindElementEvent("scheduled-model-lowpoly-target-face-preset", "change", applyScheduledLowPolyPreset);
    bindElementEvent("scheduled-model-lowpoly-target-face-count", "input", syncScheduledLowPolyPreset);
    bindElementEvent("join-source", "change", updateJoinSourceFields);
  }

  return {
    resolveChannelLabel,
    updateAutomationTargetChips,
    updateScheduledTargetModeUi,
    buildCronFromBasicSchedule,
    parseCronToBasic,
    updateScheduledTimingUi,
    switchScheduledTriggerMode,
    switchScheduleMode,
    switchAutomationPanel,
    switchChannelSettingsTab,
    updateScheduledSourceFields,
    updateScheduledModelPostOptionsUi,
    updateJoinSourceFields,
    bindCoreEvents
  };
}

if (typeof window !== "undefined") {
  window.createDashboardAutomationViewHelpers = createDashboardAutomationViewHelpers;
}
