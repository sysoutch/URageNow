function createDashboardAutomationTextSourceHelpers(input) {
  function fillPresetSelect(id, items, emptyText) {
    const select = document.getElementById(id);
    input.clearChildren(select);
    if (items.length === 0) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = emptyText;
      select.appendChild(option);
      return;
    }
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = emptyText;
    select.appendChild(placeholder);
    for (const item of items) {
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = item.name;
      select.appendChild(option);
    }
    select.value = "";
  }

  function setMultiSelectValues(id, values) {
    const select = document.getElementById(id);
    const selected = new Set((values || []).map(String));
    [...select.options].forEach(option => {
      option.selected = selected.has(option.value);
    });
  }

  function getMultiSelectValues(id) {
    const select = document.getElementById(id);
    return [...select.selectedOptions].map(option => option.value);
  }

  function addMultiSelectValues(id, values) {
    const select = document.getElementById(id);
    const selected = new Set(getMultiSelectValues(id));
    for (const value of values || []) {
      if (value) {
        selected.add(String(value));
      }
    }
    [...select.options].forEach(option => {
      option.selected = selected.has(option.value);
    });
  }

  function fillAutomationTextSourceSelects() {
    for (const id of ["scheduled-text-files", "join-text-files"]) {
      const select = document.getElementById(id);
      if (!select) {
        continue;
      }
      const selectedBefore = new Set(getMultiSelectValues(id));
      input.clearChildren(select);
      for (const file of input.state.automationTextSources) {
        const option = document.createElement("option");
        option.value = file.fileName;
        option.textContent = file.fileName + " | " + file.lineCount + " lines";
        option.selected = selectedBefore.has(file.fileName);
        select.appendChild(option);
      }
    }
    for (const entry of [
      { id: "imagegen-prompt-text-file", emptyLabel: "No prompt text file selected" },
      { id: "scheduled-prompt-text-file", emptyLabel: "No prompt text file selected" },
      { id: "join-prompt-text-file", emptyLabel: "No prompt text file selected" }
    ]) {
      const select = document.getElementById(entry.id);
      if (!select) {
        continue;
      }
      const previous = typeof select.value === "string" ? select.value : "";
      input.clearChildren(select);
      const emptyOption = document.createElement("option");
      emptyOption.value = "";
      emptyOption.textContent = entry.emptyLabel;
      select.appendChild(emptyOption);
      for (const file of input.state.automationTextSources) {
        const option = document.createElement("option");
        option.value = file.fileName;
        option.textContent = file.fileName + " | " + file.lineCount + " lines";
        select.appendChild(option);
      }
      select.value = input.state.automationTextSources.some(file => file.fileName === previous) ? previous : "";
    }
    document.querySelectorAll("select[data-text-source-select='single']").forEach(select => {
      const previous = typeof select.value === "string" ? select.value : "";
      const emptyLabel = select.getAttribute("data-text-source-empty-label") || "No text source selected";
      input.clearChildren(select);
      const emptyOption = document.createElement("option");
      emptyOption.value = "";
      emptyOption.textContent = emptyLabel;
      select.appendChild(emptyOption);
      for (const file of input.state.automationTextSources) {
        const option = document.createElement("option");
        option.value = file.fileName;
        option.textContent = file.fileName + " | " + file.lineCount + " lines";
        select.appendChild(option);
      }
      select.value = input.state.automationTextSources.some(file => file.fileName === previous) ? previous : "";
    });
    document.querySelectorAll("select[data-text-source-select='multi']").forEach(select => {
      const selectedBefore = new Set([...select.selectedOptions].map(option => option.value));
      input.clearChildren(select);
      for (const file of input.state.automationTextSources) {
        const option = document.createElement("option");
        option.value = file.fileName;
        option.textContent = file.fileName + " | " + file.lineCount + " lines";
        option.selected = selectedBefore.has(file.fileName);
        select.appendChild(option);
      }
    });
  }

  function prefillAutomationTextSource(fileName) {
    if (typeof input.closeResourcesOverlay === "function") {
      input.closeResourcesOverlay();
    }
    if (typeof input.switchView === "function") {
      input.switchView("automation");
    }
    input.switchAutomationPanel("scheduled");
    document.getElementById("automation-text-file-name").value = fileName;
    document.getElementById("automation-text-mode").value = "append";
    document.getElementById("automation-text-quick-type").value = "custom";
    const fold = document.getElementById("automation-text-generator-fold");
    if (fold) {
      fold.open = true;
      fold.scrollIntoView({ block: "center", behavior: "smooth" });
    }
    const promptField = document.getElementById("automation-text-prompt");
    if (promptField) {
      promptField.focus();
    }
  }

  function prefillResourceTextSource(fileName) {
    if (typeof input.openResourcesOverlay === "function") {
      input.openResourcesOverlay({ tab: "text-sources" });
    }
    const fileNameInput = document.getElementById("resources-text-file-name");
    const modeInput = document.getElementById("resources-text-mode");
    const quickTypeInput = document.getElementById("resources-text-quick-type");
    if (fileNameInput) {
      fileNameInput.value = fileName;
    }
    if (modeInput) {
      modeInput.value = "append";
    }
    if (quickTypeInput) {
      quickTypeInput.value = "custom";
    }
    const contentInput = document.getElementById("resources-text-content");
    if (contentInput && typeof contentInput.focus === "function") {
      contentInput.focus();
    }
    void loadResourceTextSourcePreviewToOutput(fileName);
  }

  function renderAutomationTextSources() {
    const container = document.getElementById("automation-text-source-list");
    if (!container) {
      return;
    }
    input.clearChildren(container);
    if (input.state.automationTextSources.length === 0) {
      const empty = document.createElement("div");
      empty.className = "item";
      empty.textContent = "No text source files yet.";
      container.appendChild(empty);
      return;
    }
    for (const file of input.state.automationTextSources) {
      const item = document.createElement("div");
      item.className = "item automation-source-item";
      const info = document.createElement("div");
      info.className = "automation-source-copy";
      info.innerHTML = "<strong>" + input.escapeHtml(file.fileName) + "</strong><div class='item-meta'>" + file.lineCount + " lines | updated " + input.escapeHtml(input.formatDateTime(file.updatedAt)) + "</div>";
      const preview = document.createElement("pre");
      preview.className = "resources-text-source-preview";
      const actions = document.createElement("div");
      actions.className = "row automation-source-actions";
      const useScheduledButton = document.createElement("button");
      useScheduledButton.className = "secondary mini-button";
      useScheduledButton.type = "button";
      useScheduledButton.textContent = "Use In Schedule";
      useScheduledButton.addEventListener("click", () => {
        input.switchAutomationPanel("scheduled");
        const sourceSelect = document.getElementById("scheduled-source");
        if (sourceSelect) {
          sourceSelect.value = "jokes-file";
          sourceSelect.dispatchEvent(new Event("change", { bubbles: true }));
        }
        addMultiSelectValues("scheduled-text-files", [file.fileName]);
        const scheduledFiles = document.getElementById("scheduled-text-files");
        if (scheduledFiles && typeof scheduledFiles.scrollIntoView === "function") {
          scheduledFiles.scrollIntoView({ block: "center", behavior: "smooth" });
        }
        input.setOutput("Added " + file.fileName + " to scheduled source files.");
      });
      const useJoinButton = document.createElement("button");
      useJoinButton.className = "secondary mini-button";
      useJoinButton.type = "button";
      useJoinButton.textContent = "Use In Join";
      useJoinButton.addEventListener("click", () => {
        input.switchAutomationPanel("join");
        const sourceSelect = document.getElementById("join-source");
        if (sourceSelect) {
          sourceSelect.value = "jokes-file";
          sourceSelect.dispatchEvent(new Event("change", { bubbles: true }));
        }
        addMultiSelectValues("join-text-files", [file.fileName]);
        const joinFiles = document.getElementById("join-text-files");
        if (joinFiles && typeof joinFiles.scrollIntoView === "function") {
          joinFiles.scrollIntoView({ block: "center", behavior: "smooth" });
        }
        input.setOutput("Added " + file.fileName + " to join source files.");
      });
      const extendButton = document.createElement("button");
      extendButton.className = "mini-button";
      extendButton.type = "button";
      extendButton.textContent = "Extend";
      extendButton.addEventListener("click", () => {
        prefillAutomationTextSource(file.fileName);
        input.setOutput("Ready to append more lines to " + file.fileName + ".");
      });
      actions.appendChild(useScheduledButton);
      actions.appendChild(useJoinButton);
      actions.appendChild(extendButton);
      item.appendChild(info);
      item.appendChild(actions);
      container.appendChild(item);
    }
  }

  function openAutomationTextSourceManager() {
    if (typeof input.switchView === "function") {
      input.switchView("automation");
    }
    input.switchAutomationPanel("scheduled");
    const fold = document.getElementById("automation-text-generator-fold");
    if (fold) {
      fold.open = true;
      fold.scrollIntoView({ block: "center", behavior: "smooth" });
    }
    const fileNameInput = document.getElementById("automation-text-file-name");
    if (fileNameInput) {
      fileNameInput.focus();
    }
    input.setOutput("Opened shared text source manager.");
  }

  function openTextSourceManager() {
    if (typeof input.openResourcesOverlay === "function") {
      input.openResourcesOverlay({ tab: "text-sources" });
      input.setOutput("Opened Resources text source manager.");
      return;
    }
    openAutomationTextSourceManager();
  }

  function selectTextSourceForStudio(fileName) {
    const normalized = String(fileName || "").trim();
    if (!normalized) {
      return;
    }
    const selects = Array.from(document.querySelectorAll("select[data-text-source-select='single']"));
    for (const select of selects) {
      if (!Array.from(select.options).some(option => option.value === normalized)) {
        continue;
      }
      select.value = normalized;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
    input.setOutput("Selected " + normalized + " in Studio text source selectors.");
  }

  function formatTextSourcePreview(payload) {
    if (!payload || typeof payload.content !== "string") {
      return "Preview unavailable.";
    }
    const content = payload.content.trim() || "File has no non-empty lines.";
    if (payload.truncated === true) {
      return content + "\n\n... more lines not shown.";
    }
    return content;
  }

  async function loadTextSourcePreview(fileName, maxLines) {
    const query = "?fileName=" + encodeURIComponent(fileName) + "&maxLines=" + encodeURIComponent(String(maxLines || 12));
    return input.request("/api/automation-text-sources/content" + query);
  }

  async function renderTextSourcePreview(fileName, node) {
    if (!node) {
      return;
    }
    node.textContent = "Loading preview...";
    try {
      const payload = await loadTextSourcePreview(fileName, 8);
      node.textContent = formatTextSourcePreview(payload);
    } catch (error) {
      node.textContent = "Preview failed: " + ((error && error.message) || "Unknown error");
    }
  }

  function createResourcePreviewFoldout(fileName) {
    const foldout = document.createElement("details");
    foldout.className = "resources-preview-foldout";
    const summary = document.createElement("summary");
    summary.textContent = "Preview";
    const preview = document.createElement("pre");
    preview.className = "resources-text-source-preview";
    foldout.appendChild(summary);
    foldout.appendChild(preview);
    foldout.addEventListener("toggle", () => {
      if (foldout.open && preview.dataset.loaded !== "true") {
        preview.dataset.loaded = "true";
        void renderTextSourcePreview(fileName, preview);
      }
    });
    return foldout;
  }

  async function loadResourceTextSourcePreviewToOutput(fileName) {
    const output = document.getElementById("resources-text-output");
    if (!output || !fileName) {
      return;
    }
    output.textContent = "Loading current file preview...";
    try {
      const payload = await loadTextSourcePreview(fileName, 40);
      output.textContent = formatTextSourcePreview(payload);
    } catch (error) {
      output.textContent = "Preview failed: " + ((error && error.message) || "Unknown error");
    }
  }

  function renderStudioTextSources() {
    const container = document.getElementById("studio-text-source-list");
    if (!container) {
      return;
    }
    input.clearChildren(container);
    if (input.state.automationTextSources.length === 0) {
      const empty = document.createElement("div");
      empty.className = "item";
      empty.textContent = "No shared text source files yet.";
      container.appendChild(empty);
      return;
    }
    for (const file of input.state.automationTextSources) {
      const item = document.createElement("div");
      item.className = "item automation-source-item";
      const info = document.createElement("div");
      info.className = "automation-source-copy";
      info.innerHTML = "<strong>" + input.escapeHtml(file.fileName) + "</strong><div class='item-meta'>" + file.lineCount + " lines | updated " + input.escapeHtml(input.formatDateTime(file.updatedAt)) + "</div>";
      const actions = document.createElement("div");
      actions.className = "row automation-source-actions";
      const useButton = document.createElement("button");
      useButton.className = "secondary mini-button";
      useButton.type = "button";
      useButton.textContent = "Use";
      useButton.addEventListener("click", () => {
        selectTextSourceForStudio(file.fileName);
      });
      const extendButton = document.createElement("button");
      extendButton.className = "mini-button";
      extendButton.type = "button";
      extendButton.textContent = "Edit";
      extendButton.addEventListener("click", () => {
        prefillResourceTextSource(file.fileName);
        input.setOutput("Opened shared text source manager for " + file.fileName + ".");
      });
      actions.appendChild(useButton);
      actions.appendChild(extendButton);
      item.appendChild(info);
      item.appendChild(actions);
      container.appendChild(item);
    }
  }

  function renderResourceTextSources() {
    const container = document.getElementById("resources-text-source-list");
    if (!container) {
      return;
    }
    input.clearChildren(container);
    if (input.state.automationTextSources.length === 0) {
      const empty = document.createElement("div");
      empty.className = "item";
      empty.textContent = "No shared text source files yet.";
      container.appendChild(empty);
      return;
    }
    for (const file of input.state.automationTextSources) {
      const item = document.createElement("div");
      item.className = "item automation-source-item resources-foldout";
      const info = document.createElement("div");
      info.className = "automation-source-copy";
      info.innerHTML = "<strong>" + input.escapeHtml(file.fileName) + "</strong><div class='item-meta'>" + file.lineCount + " lines | updated " + input.escapeHtml(input.formatDateTime(file.updatedAt)) + "</div>";
      const preview = createResourcePreviewFoldout(file.fileName);
      const actions = document.createElement("div");
      actions.className = "row automation-source-actions";
      const useButton = document.createElement("button");
      useButton.className = "secondary mini-button";
      useButton.type = "button";
      useButton.textContent = "Use";
      useButton.addEventListener("click", () => {
        selectTextSourceForStudio(file.fileName);
      });
      const appendButton = document.createElement("button");
      appendButton.className = "mini-button";
      appendButton.type = "button";
      appendButton.textContent = "Append";
      appendButton.addEventListener("click", () => {
        prefillResourceTextSource(file.fileName);
        input.setOutput("Ready to append lines to " + file.fileName + ".");
      });
      const automationButton = document.createElement("button");
      automationButton.className = "secondary mini-button";
      automationButton.type = "button";
      automationButton.textContent = "Automation";
      automationButton.addEventListener("click", () => {
        prefillAutomationTextSource(file.fileName);
      });
      actions.appendChild(useButton);
      actions.appendChild(appendButton);
      actions.appendChild(automationButton);
      item.appendChild(info);
      item.appendChild(preview);
      item.appendChild(actions);
      container.appendChild(item);
    }
  }

  async function loadAutomationTextSources() {
    input.state.automationTextSources = await input.request("/api/automation-text-sources");
    fillAutomationTextSourceSelects();
    renderAutomationTextSources();
    renderStudioTextSources();
    renderResourceTextSources();
  }

  function getTextSourcePromptPreset(type) {
    const presetMap = {
      jokes: {
        fileName: "jokes.txt",
        prompt: "Generate 25 short clean jokes for a Discord community. Return only one joke per line with no numbering."
      },
      questions: {
        fileName: "questions.txt",
        prompt: "Generate 25 friendly conversation starter questions for a Discord server. Return only one question per line with no numbering."
      },
      tips: {
        fileName: "tips.txt",
        prompt: "Generate 25 short helpful tips for a Discord server community. Return only one tip per line with no numbering."
      },
      icebreakers: {
        fileName: "icebreakers.txt",
        prompt: "Generate 25 short icebreaker prompts for a Discord server. Return only one prompt per line with no numbering."
      }
    };
    return presetMap[type] || null;
  }

  function applyTextSourcePromptPreset(type, fileNameInputId, promptInputId) {
    if (type === "custom") {
      return;
    }
    const preset = getTextSourcePromptPreset(type);
    if (!preset) {
      return;
    }
    const fileNameInput = document.getElementById(fileNameInputId);
    const promptInput = document.getElementById(promptInputId);
    if (!fileNameInput || !promptInput) {
      return;
    }
    if (!fileNameInput.value.trim()) {
      fileNameInput.value = preset.fileName;
    }
    promptInput.value = preset.prompt;
  }

  function updateAutomationTextPromptPreset() {
    const type = document.getElementById("automation-text-quick-type")?.value || "custom";
    applyTextSourcePromptPreset(type, "automation-text-file-name", "automation-text-prompt");
  }

  function updateResourcesTextPromptPreset() {
    const type = document.getElementById("resources-text-quick-type")?.value || "custom";
    applyTextSourcePromptPreset(type, "resources-text-file-name", "resources-text-prompt");
  }

  async function refreshTextSourcesFromUi(statusId, message) {
    if (typeof input.refreshAutomationTextSources === "function") {
      await input.refreshAutomationTextSources();
    } else {
      await loadAutomationTextSources();
    }
    const status = document.getElementById(statusId);
    if (status) {
      status.textContent = message;
    }
    input.setOutput(message);
  }

  async function saveTextSourceFromUi(config) {
    const fileName = document.getElementById(config.fileNameId)?.value.trim() || "";
    const content = document.getElementById(config.contentId)?.value.trim() || "";
    const mode = document.getElementById(config.modeId)?.value === "replace" ? "replace" : "append";
    const output = document.getElementById(config.outputId);
    if (!fileName || !content) {
      return void input.setOutput("File name and source lines are required.");
    }
    if (output) {
      output.textContent = "Saving text source...";
    }
    const payload = await input.request("/api/automation-text-sources", { fileName, content, mode });
    if (output) {
      output.textContent = content;
    }
    await loadAutomationTextSources();
    if (config.prefillAutomation === true) {
      addMultiSelectValues("scheduled-text-files", [payload.summary.fileName]);
      prefillAutomationTextSource(payload.summary.fileName);
    }
    input.setOutput("Saved " + payload.summary.fileName + " (" + payload.summary.lineCount + " lines).");
  }

  async function generateTextSourceFromUi(config) {
    const fileName = document.getElementById(config.fileNameId)?.value.trim() || "";
    const prompt = document.getElementById(config.promptId)?.value.trim() || "";
    const mode = document.getElementById(config.modeId)?.value === "replace" ? "replace" : "append";
    const output = document.getElementById(config.outputId);
    if (!fileName || !prompt) {
      return void input.setOutput("File name and LazyDev prompt are required for text generation.");
    }
    if (output) {
      output.textContent = "Rod is generating lines...";
    }
    const payload = await input.request("/api/automation-text-sources/generate", { fileName, prompt, mode });
    if (output) {
      output.textContent = payload.content;
    }
    await loadAutomationTextSources();
    if (config.prefillAutomation === true) {
      addMultiSelectValues("scheduled-text-files", [payload.summary.fileName]);
      prefillAutomationTextSource(payload.summary.fileName);
    } else {
      prefillResourceTextSource(payload.summary.fileName);
    }
    input.setOutput("Saved generated lines to " + payload.summary.fileName + ".");
  }

  function bindEvents() {
    const bindClick = (id, handler) => {
      const button = document.getElementById(id);
      if (button) {
        button.addEventListener("click", handler);
      }
    };
    const bindChange = (id, handler) => {
      const node = document.getElementById(id);
      if (node) {
        node.addEventListener("change", handler);
      }
    };
    bindClick("refresh-automation-text-sources-button", async () => {
      await refreshTextSourcesFromUi("automation-text-sources-refresh-status", "Text source files refreshed.");
    });
    bindClick("refresh-studio-text-sources-button", async () => {
      await refreshTextSourcesFromUi("automation-text-sources-refresh-status", "Shared Studio text sources refreshed.");
    });
    bindClick("resources-refresh-text-sources-button", async () => {
      await refreshTextSourcesFromUi("resources-text-sources-refresh-status", "Resources text sources refreshed.");
    });
    bindClick("studio-manage-text-sources-button", openTextSourceManager);
    bindClick("resources-open-automation-text-manager-button", openAutomationTextSourceManager);
    bindChange("automation-text-quick-type", updateAutomationTextPromptPreset);
    bindChange("resources-text-quick-type", updateResourcesTextPromptPreset);
    bindClick("generate-automation-text-button", async () => {
      await generateTextSourceFromUi({
        fileNameId: "automation-text-file-name",
        promptId: "automation-text-prompt",
        modeId: "automation-text-mode",
        outputId: "automation-text-output",
        prefillAutomation: true
      });
    });
    bindClick("resources-save-text-button", async () => {
      await saveTextSourceFromUi({
        fileNameId: "resources-text-file-name",
        contentId: "resources-text-content",
        modeId: "resources-text-mode",
        outputId: "resources-text-output"
      });
    });
    bindClick("resources-generate-text-button", async () => {
      await generateTextSourceFromUi({
        fileNameId: "resources-text-file-name",
        promptId: "resources-text-prompt",
        modeId: "resources-text-mode",
        outputId: "resources-text-output"
      });
    });
  }

  return {
    fillPresetSelect,
    setMultiSelectValues,
    getMultiSelectValues,
    addMultiSelectValues,
    prefillAutomationTextSource,
    loadAutomationTextSources,
    updateAutomationTextPromptPreset,
    bindEvents
  };
}

if (typeof window !== "undefined") {
  window.createDashboardAutomationTextSourceHelpers = createDashboardAutomationTextSourceHelpers;
}
