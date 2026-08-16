function createDashboardImagePromptTransformation(input) {
  const changePromptState = { targetIndices: [] };
  const translatePromptState = { targetIndices: [] };

  function setPromptValue(prompt) {
    const promptNode = document.getElementById("imagegen-prompt");
    if (!promptNode || typeof promptNode.value !== "string") return;
    promptNode.value = String(prompt || "").trim();
    promptNode.dispatchEvent(new Event("input", { bubbles: true }));
    promptNode.dispatchEvent(new Event("change", { bubbles: true }));
    promptNode.focus();
    promptNode.setSelectionRange(promptNode.value.length, promptNode.value.length);
    const autoPromptToggle = document.getElementById("imagegen-auto-prompt");
    if (autoPromptToggle && typeof autoPromptToggle.checked === "boolean") autoPromptToggle.checked = false;
    const promptTextFileSelect = document.getElementById("imagegen-prompt-text-file");
    if (promptTextFileSelect && typeof promptTextFileSelect.value === "string") promptTextFileSelect.value = "";
  }

  function getSelectedTargets() {
    input.syncActivePromptFromField();
    const promptState = input.objectPromptState;
    if (promptState.items.length === 0) {
      const prompt = document.getElementById("imagegen-prompt")?.value.trim() || "";
      return prompt ? [{ index: -1, name: "Image Prompt", prompt }] : [];
    }
    const selectedIndices = Array.from(promptState.selectedIndices)
      .filter(index => promptState.items[index])
      .sort((left, right) => left - right);
    const indices = selectedIndices.length > 0 ? selectedIndices : [promptState.activeIndex];
    return indices.map(index => ({
      index,
      name: promptState.items[index]?.name || "Prompt " + (index + 1),
      prompt: String(promptState.items[index]?.prompt || "").trim()
    })).filter(target => target.prompt);
  }

  function applyTargetResults(results) {
    const standalone = results.find(result => result.index === -1);
    if (standalone) {
      setPromptValue(standalone.prompt);
      return;
    }
    const promptState = input.objectPromptState;
    results.forEach(result => {
      if (promptState.items[result.index]) promptState.items[result.index].prompt = result.prompt;
    });
    input.renderObjectPrompts();
    input.setObjectPromptActiveIndex(promptState.activeIndex, { saveCurrent: false });
  }

  function readProcessingOptions() {
    const modeValue = document.getElementById("image-prompt-processing-mode")?.value;
    const mode = modeValue === "all" || modeValue === "batch" ? modeValue : "sequential";
    const batchNode = document.getElementById("image-prompt-processing-batch-size");
    const parsedBatchSize = Number.parseInt(String(batchNode?.value || "3"), 10);
    const batchSize = Number.isFinite(parsedBatchSize) ? Math.max(1, Math.min(20, parsedBatchSize)) : 3;
    if (batchNode && String(batchNode.value) !== String(batchSize)) batchNode.value = String(batchSize);
    return { mode, batchSize };
  }

  function syncProcessingControls() {
    const options = readProcessingOptions();
    const identifyEnabled = document.getElementById("image-identify-objects-toggle")?.checked === true;
    const hasMultiplePrompts = input.objectPromptState.items.length > 1;
    input.setElementVisible(document.getElementById("image-prompt-processing-controls"), identifyEnabled || hasMultiplePrompts);
    input.setElementVisible(document.getElementById("image-prompt-processing-batch-field"), options.mode === "batch");
  }

  async function processTasks(targets, worker, actionLabel) {
    const options = readProcessingOptions();
    const runTarget = async (target, index) => {
      input.setGenerationStatus(actionLabel + " prompt " + (index + 1) + " of " + targets.length + "...");
      return worker(target, index);
    };
    if (options.mode === "all") return Promise.all(targets.map(runTarget));
    if (options.mode === "batch") {
      const results = [];
      for (let start = 0; start < targets.length; start += options.batchSize) {
        const batch = targets.slice(start, start + options.batchSize);
        results.push(...await Promise.all(batch.map((target, index) => runTarget(target, start + index))));
      }
      return results;
    }
    const results = [];
    for (let index = 0; index < targets.length; index += 1) {
      results.push(await runTarget(targets[index], index));
    }
    return results;
  }

  async function requestRewrittenPrompt(target, requestBody) {
    const response = await input.request("/api/image-rewrite-prompt", {
      currentPrompt: target.prompt,
      ...requestBody
    });
    const rewrittenPrompt = String(response?.prompt || "").trim();
    if (!rewrittenPrompt) throw new Error("LazyDev returned an empty prompt for " + target.name + ".");
    return { ...target, prompt: rewrittenPrompt };
  }

  async function improveFromUi() {
    const targets = getSelectedTargets();
    const negativePrompt = document.getElementById("imagegen-negative-prompt")?.value.trim() || "";
    if (targets.length === 0) return void input.setOutput("Write or select at least one image prompt before improving it.");
    const results = await processTasks(
      targets,
      target => requestRewrittenPrompt(target, { negativePrompt, mode: "improve" }),
      "Improving"
    );
    applyTargetResults(results);
    input.setGenerationStatus("Improved " + targets.length + " image prompt" + (targets.length === 1 ? "" : "s") + ".");
    input.setOutput("Improved " + targets.length + " selected image prompt" + (targets.length === 1 ? "" : "s") + ".");
  }

  function setChangeMode(mode) {
    const normalizedMode = mode === "replace" ? "replace" : "add";
    document.querySelectorAll("[data-image-change-prompt-mode]").forEach(button => {
      const active = button.getAttribute("data-image-change-prompt-mode") === normalizedMode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });
    const hint = document.getElementById("image-change-prompt-hint");
    if (hint) {
      hint.textContent = normalizedMode === "replace"
        ? "Replace only the parts described below and preserve unrelated prompt details."
        : "Add the requested details while preserving the existing subject and visual direction.";
    }
  }

  function getChangeMode() {
    return document.querySelector("[data-image-change-prompt-mode].active")?.getAttribute("data-image-change-prompt-mode") === "replace"
      ? "replace"
      : "add";
  }

  function openChangeModal() {
    const targets = getSelectedTargets();
    if (targets.length === 0) return void input.setOutput("Write or select at least one image prompt before changing it.");
    const modal = document.getElementById("image-change-prompt-modal");
    if (!modal) return;
    changePromptState.targetIndices = targets.map(target => target.index);
    input.setInputValue("image-change-prompt-current", targets.map(target => target.name + ":\n" + target.prompt).join("\n\n"));
    const currentLabel = document.getElementById("image-change-prompt-current-label");
    if (currentLabel) currentLabel.textContent = targets.length === 1 ? "Current Prompt" : "Current Prompts (" + targets.length + ")";
    input.setInputValue("image-change-prompt-instructions", "");
    setChangeMode("add");
    modal.classList.remove("hidden");
    document.body.classList.add("image-quick-action-modal-open");
    window.setTimeout(() => document.getElementById("image-change-prompt-instructions")?.focus(), 0);
  }

  function closeChangeModal() {
    document.getElementById("image-change-prompt-modal")?.classList.add("hidden");
    document.body.classList.remove("image-quick-action-modal-open");
    changePromptState.targetIndices = [];
  }

  function syncTranslateLanguageField() {
    const select = document.getElementById("image-translate-prompt-language-select");
    input.setElementVisible(document.getElementById("image-translate-prompt-custom-language-field"), select?.value === "custom");
  }

  function getTranslateLanguage() {
    const selectValue = String(document.getElementById("image-translate-prompt-language-select")?.value || "").trim();
    if (selectValue && selectValue !== "custom") return selectValue;
    return String(document.getElementById("image-translate-prompt-custom-language")?.value || "").trim();
  }

  function getTranslateSourceLanguage() {
    return String(document.getElementById("image-translate-prompt-source-language-select")?.value || "").trim();
  }

  function openTranslateModal() {
    const targets = getSelectedTargets();
    if (targets.length === 0) return void input.setOutput("Write or select at least one image prompt before translating it.");
    const modal = document.getElementById("image-translate-prompt-modal");
    if (!modal) return;
    translatePromptState.targetIndices = targets.map(target => target.index);
    input.setInputValue("image-translate-prompt-current", targets.map(target => target.name + ":\n" + target.prompt).join("\n\n"));
    const currentLabel = document.getElementById("image-translate-prompt-current-label");
    if (currentLabel) currentLabel.textContent = targets.length === 1 ? "Current Prompt" : "Current Prompts (" + targets.length + ")";
    input.setInputValue("image-translate-prompt-source-language-select", "");
    input.setInputValue("image-translate-prompt-language-select", "English");
    input.setInputValue("image-translate-prompt-custom-language", "");
    syncTranslateLanguageField();
    modal.classList.remove("hidden");
    document.body.classList.add("image-quick-action-modal-open");
    window.setTimeout(() => document.getElementById("image-translate-prompt-language-select")?.focus(), 0);
  }

  function closeTranslateModal() {
    document.getElementById("image-translate-prompt-modal")?.classList.add("hidden");
    document.body.classList.remove("image-quick-action-modal-open");
    translatePromptState.targetIndices = [];
  }

  async function applyChangesFromUi() {
    const targetSet = new Set(changePromptState.targetIndices);
    const targets = getSelectedTargets().filter(target => targetSet.has(target.index));
    const negativePrompt = document.getElementById("imagegen-negative-prompt")?.value.trim() || "";
    const instructions = document.getElementById("image-change-prompt-instructions")?.value.trim() || "";
    const mode = getChangeMode();
    if (targets.length === 0) throw new Error("The selected image prompts are no longer available.");
    if (!instructions) throw new Error("Describe the changes you want first.");
    const results = await processTasks(
      targets,
      target => requestRewrittenPrompt(target, { negativePrompt, instructions, mode }),
      "Changing"
    );
    applyTargetResults(results);
    closeChangeModal();
    input.setGenerationStatus("Changed " + targets.length + " image prompt" + (targets.length === 1 ? "" : "s") + ".");
    input.setOutput("Changed " + targets.length + " selected image prompt" + (targets.length === 1 ? "" : "s") + ".");
  }

  async function applyTranslationFromUi() {
    const targetSet = new Set(translatePromptState.targetIndices);
    const targets = getSelectedTargets().filter(target => targetSet.has(target.index));
    const negativePrompt = document.getElementById("imagegen-negative-prompt")?.value.trim() || "";
    const sourceLanguage = getTranslateSourceLanguage();
    const targetLanguage = getTranslateLanguage();
    if (targets.length === 0) throw new Error("The selected image prompts are no longer available.");
    if (!targetLanguage) throw new Error("Choose a target language first.");
    const results = await processTasks(
      targets,
      target => requestRewrittenPrompt(target, { negativePrompt, mode: "translate", targetLanguage, sourceLanguage }),
      "Translating"
    );
    applyTargetResults(results);
    closeTranslateModal();
    input.setGenerationStatus("Translated " + targets.length + " image prompt" + (targets.length === 1 ? "" : "s") + " to " + targetLanguage + ".");
    input.setOutput("Translated " + targets.length + " selected image prompt" + (targets.length === 1 ? "" : "s") + " to " + targetLanguage + ".");
  }

  return {
    applyChangesFromUi,
    applyTranslationFromUi,
    closeChangeModal,
    closeTranslateModal,
    improveFromUi,
    openChangeModal,
    openTranslateModal,
    processTasks,
    readProcessingOptions,
    setChangeMode,
    syncProcessingControls,
    syncTranslateLanguageField
  };
}
