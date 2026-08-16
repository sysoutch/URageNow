function createDashboardImageObjectPromptCollection(input) {
  const state = {
    items: [],
    activeIndex: 0,
    selectedIndices: new Set()
  };

  function normalizeObjects(payload, maxObjects) {
    const entries = Array.isArray(payload?.objects) ? payload.objects : [];
    return entries.map(entry => {
      const name = String(entry?.name || "").trim();
      const prompt = String(entry?.prompt || "").trim();
      const resolvedPrompt = prompt || name;
      return resolvedPrompt ? { name: name || resolvedPrompt, prompt: resolvedPrompt } : null;
    }).filter(Boolean).slice(0, maxObjects);
  }

  function readMaxAmount() {
    const node = document.getElementById("image-identify-max-amount");
    const parsed = Number.parseInt(String(node?.value || "5"), 10);
    const amount = Number.isFinite(parsed) ? Math.max(1, Math.min(20, parsed)) : 5;
    if (node && String(node.value) !== String(amount)) node.value = String(amount);
    return amount;
  }

  function syncMaxAmountVisibility() {
    const enabled = document.getElementById("image-identify-objects-toggle")?.checked === true;
    input.setElementVisible(document.getElementById("image-identify-max-amount-field"), enabled);
  }

  function disableIdentificationMode() {
    const toggle = document.getElementById("image-identify-objects-toggle");
    if (!toggle || toggle.checked !== true) return;
    toggle.checked = false;
    toggle.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function syncActivePromptFromField() {
    const entry = state.items[state.activeIndex];
    const promptNode = document.getElementById("imagegen-prompt");
    if (!entry || !promptNode) return;
    entry.prompt = String(promptNode.value || "");
  }

  function setActiveIndex(index, options = {}) {
    if (options.saveCurrent !== false) syncActivePromptFromField();
    const nextIndex = Math.min(Math.max(0, Number(index) || 0), Math.max(0, state.items.length - 1));
    state.activeIndex = nextIndex;
    document.querySelectorAll("[data-image-object-prompt-tab]").forEach(button => {
      const active = Number(button.getAttribute("data-image-object-prompt-tab")) === nextIndex;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
      button.setAttribute("tabindex", active ? "0" : "-1");
    });
    const promptNode = document.getElementById("imagegen-prompt");
    const entry = state.items[nextIndex];
    if (promptNode && entry && options.loadPrompt !== false) {
      promptNode.value = entry.prompt;
      promptNode.dispatchEvent(new Event("input", { bubbles: true }));
      promptNode.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  function render() {
    const editor = document.getElementById("image-object-prompt-editor");
    const tabs = document.getElementById("image-object-prompt-tabs");
    const count = document.getElementById("image-object-prompt-count");
    const deleteButton = document.getElementById("image-object-prompt-delete-button");
    const hasItems = state.items.length > 0;
    input.setElementVisible(editor, true);
    if (count) count.textContent = state.items.length + (state.items.length === 1 ? " prompt" : " prompts");
    if (deleteButton) deleteButton.disabled = state.selectedIndices.size === 0;
    if (!tabs) return;
    tabs.replaceChildren();
    state.items.forEach((entry, index) => {
      const item = document.createElement("div");
      item.className = "image-object-prompt-tab-item";
      const select = document.createElement("input");
      select.type = "checkbox";
      select.checked = state.selectedIndices.has(index);
      select.setAttribute("aria-label", "Select " + (entry.name || "Prompt " + (index + 1)) + " for deletion");
      select.addEventListener("change", () => {
        if (select.checked) state.selectedIndices.add(index);
        else state.selectedIndices.delete(index);
        render();
      });
      const tab = document.createElement("button");
      tab.type = "button";
      tab.textContent = entry.name || "Prompt " + (index + 1);
      tab.setAttribute("data-image-object-prompt-tab", String(index));
      tab.setAttribute("role", "tab");
      tab.addEventListener("click", () => setActiveIndex(index));
      item.append(select, tab);
      tabs.appendChild(item);
    });
    if (hasItems) setActiveIndex(state.activeIndex, { saveCurrent: false });
    syncGenerateButtonLabel();
    input.syncProcessingControls();
  }

  function addPrompt() {
    syncActivePromptFromField();
    const index = state.items.length;
    state.items.push({ name: "Prompt " + (index + 1), prompt: "" });
    state.activeIndex = index;
    render();
    setActiveIndex(index, { saveCurrent: false });
    document.getElementById("imagegen-prompt")?.focus();
  }

  function deleteSelectedPrompts() {
    syncActivePromptFromField();
    if (state.selectedIndices.size === 0) return;
    state.items = state.items.filter((entry, index) => !state.selectedIndices.has(index));
    state.selectedIndices.clear();
    state.activeIndex = Math.min(state.activeIndex, Math.max(0, state.items.length - 1));
    render();
    if (state.items.length > 0) setActiveIndex(state.activeIndex, { saveCurrent: false });
  }

  async function identifyFromUi() {
    const promptSource = input.getPromptSource();
    const imageInput = String(promptSource.value || "").trim();
    if (!imageInput) throw new Error("Upload a source image in the prompt builder first.");
    const direction = String(document.getElementById("image-interpret-direction-input")?.value || "").trim();
    const prompt = String(document.getElementById("imagegen-prompt")?.value || "").trim();
    const maxObjects = readMaxAmount();
    const payload = await input.request("/api/image-identify-objects", {
      imageInput,
      imageFileNameHint: promptSource.fileName || undefined,
      direction: direction || undefined,
      prompt: prompt || undefined,
      maxObjects
    });
    const objects = normalizeObjects(payload, maxObjects);
    if (objects.length === 0) throw new Error("The vision model did not return any standalone objects.");
    return objects;
  }

  async function interpretObjects() {
    input.setGenerationStatus("Identifying objects in source image...");
    state.items = await identifyFromUi();
    state.activeIndex = 0;
    state.selectedIndices.clear();
    render();
    const autoPromptToggle = document.getElementById("imagegen-auto-prompt");
    if (autoPromptToggle && typeof autoPromptToggle.checked === "boolean") {
      autoPromptToggle.checked = false;
      autoPromptToggle.dispatchEvent(new Event("change", { bubbles: true }));
    }
    input.setGenerationStatus("Created " + state.items.length + " object prompts.");
    input.setOutput("Identified " + state.items.length + " object(s): " + state.items.map(entry => entry.name).join(", ") + ".");
    document.getElementById("imagegen-prompt")?.focus();
    return state.items;
  }

  async function generateFromUi() {
    const imageInput = String(input.getPromptSource().value || "").trim();
    syncActivePromptFromField();
    const editedObjects = state.items
      .map(entry => ({ name: entry.name, prompt: String(entry.prompt || "").trim() }))
      .filter(entry => entry.prompt);
    if (editedObjects.length === 0 && !imageInput) {
      return void input.setOutput("Add at least one separate image prompt, or upload a source image for object identification.");
    }
    const objects = editedObjects.length > 0 ? editedObjects : await identifyFromUi();
    if (editedObjects.length === 0) {
      state.items = objects;
      state.activeIndex = 0;
      render();
    }
    input.setOutput("Preparing " + objects.length + " separate image prompt(s): " + objects.map(entry => entry.name).join(", ") + ".");
    for (let index = 0; index < objects.length; index += 1) {
      const entry = objects[index];
      input.setGenerationStatus("Generating object " + (index + 1) + "/" + objects.length + ": " + entry.name + "...");
      await input.generateImage({
        promptOverride: entry.prompt,
        promptTextFileOverride: "",
        autoPromptOverride: false,
        count: 1
      });
    }
    input.setGenerationStatus("Generated " + objects.length + " separate image(s).");
    input.setOutput("Generated " + objects.length + " separate image(s).");
  }

  function syncGenerateButtonLabel() {
    const button = document.getElementById("generate-image-button");
    if (!button) return;
    const separateImages = document.getElementById("image-identify-objects-toggle")?.checked === true;
    const hasMultiplePrompts = state.items.length > 1;
    const label = input.getStudioTab() === "edit"
      ? "Apply Edit"
      : (hasMultiplePrompts ? "Generate Multiple Images" : (separateImages ? "Generate Separate Images" : "Generate Image"));
    const labelNode = button.querySelector("span:not(.button-icon)");
    if (labelNode) {
      labelNode.textContent = label;
      return;
    }
    button.textContent = label;
  }

  return {
    addPrompt,
    deleteSelectedPrompts,
    disableIdentificationMode,
    generateFromUi,
    identifyFromUi,
    interpretObjects,
    readMaxAmount,
    render,
    setActiveIndex,
    state,
    syncActivePromptFromField,
    syncGenerateButtonLabel,
    syncMaxAmountVisibility
  };
}
