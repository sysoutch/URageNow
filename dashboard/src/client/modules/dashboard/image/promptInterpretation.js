function createDashboardImagePromptInterpretation(input) {
  const sourceState = {
    value: "",
    previewUrl: "",
    fileName: "",
    detailMode: "normal"
  };

  function getSource() {
    return sourceState;
  }

  function renderSource() {
    const hasSource = Boolean(sourceState.value);
    const preview = document.getElementById("image-prompt-interpret-preview-image");
    const empty = document.getElementById("image-prompt-interpret-preview-empty");
    const name = document.getElementById("image-prompt-interpret-preview-name");
    const detail = document.getElementById("image-prompt-interpret-preview-detail");
    const clearButton = document.getElementById("image-interpret-source-clear-button");
    const interpretButton = document.getElementById("image-interpret-with-llm-button");
    const aspectButton = document.getElementById("image-interpret-source-aspect-button");
    if (preview) {
      preview.classList.toggle("hidden", !hasSource);
      preview.src = hasSource ? sourceState.previewUrl : "";
    }
    empty?.classList.toggle("hidden", hasSource);
    if (name) name.textContent = hasSource ? (sourceState.fileName || "Uploaded source image") : "Waiting for uploaded image.";
    if (detail) {
      detail.textContent = hasSource
        ? "Ready to replace the prompt field with a vision-generated prompt."
        : "Choose an image from disk, then replace the prompt box with a vision-generated prompt.";
    }
    input.setElementVisible(clearButton, hasSource);
    input.setElementVisible(aspectButton, hasSource);
    if (interpretButton) interpretButton.disabled = !hasSource;
    if (aspectButton) aspectButton.disabled = !hasSource;
  }

  function clearSource() {
    sourceState.value = "";
    sourceState.previewUrl = "";
    sourceState.fileName = "";
    const fileInput = document.getElementById("image-interpret-source-file");
    if (fileInput) fileInput.value = "";
    renderSource();
  }

  async function setSourceFromFile(file) {
    if (!file || !(file.type || "").startsWith("image/")) throw new Error("Please choose an image file.");
    const dataUrl = await input.readFileAsDataUrl(file);
    sourceState.value = dataUrl;
    sourceState.previewUrl = dataUrl;
    sourceState.fileName = file.name || "source-image.png";
    renderSource();
  }

  function loadSourceDimensions() {
    const source = String(sourceState.previewUrl || sourceState.value || "").trim();
    if (!source) return Promise.reject(new Error("Upload a source image first."));
    return new Promise((resolve, reject) => {
      const probe = new Image();
      probe.onload = () => {
        const width = Number(probe.naturalWidth || probe.width || 0);
        const height = Number(probe.naturalHeight || probe.height || 0);
        if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
          reject(new Error("Could not read source image dimensions."));
          return;
        }
        resolve({ width, height });
      };
      probe.onerror = () => reject(new Error("Could not load source image dimensions."));
      probe.src = source;
    });
  }

  function roundDimensionToStep(value) {
    return Math.min(4096, Math.max(64, Math.round(Number(value || 0) / 8) * 8 || 64));
  }

  function fitDimensionsToAspectRatio(sourceWidth, sourceHeight) {
    const current = input.getWorkflowDimensions() || { width: 512, height: 512 };
    const targetPixels = Math.max(64 * 64, Math.min(4096 * 4096, current.width * current.height));
    const ratio = Math.max(0.01, Number(sourceWidth) / Math.max(1, Number(sourceHeight)));
    let width = roundDimensionToStep(Math.sqrt(targetPixels * ratio));
    let height = roundDimensionToStep(width / ratio);
    if (height > 4096) {
      height = 4096;
      width = roundDimensionToStep(height * ratio);
    }
    if (width > 4096) {
      width = 4096;
      height = roundDimensionToStep(width / ratio);
    }
    return { width, height };
  }

  async function applySourceAspectRatio() {
    const dimensions = await loadSourceDimensions();
    const next = fitDimensionsToAspectRatio(dimensions.width, dimensions.height);
    input.setEditorDimensions(next.width, next.height);
    input.setOutput("Matched Image Studio generation size to source aspect ratio: " + next.width + " x " + next.height + ".");
  }

  async function setSourceFromClipboardEvent(event) {
    const files = input.getClipboardImageFiles(event);
    if (files.length === 0) return false;
    await setSourceFromFile(files[0]);
    input.setOutput("Loaded " + (files[0].name || "clipboard image") + " for prompt interpretation.");
    return true;
  }

  async function readClipboardImage() {
    if (!navigator.clipboard || typeof navigator.clipboard.read !== "function") {
      throw new Error("This browser does not expose clipboard image reads. Focus the prompt builder and press Ctrl+V instead.");
    }
    const clipboardItems = await navigator.clipboard.read();
    for (const item of clipboardItems) {
      const imageType = Array.from(item.types || []).find(type => type.startsWith("image/"));
      if (!imageType) continue;
      const blob = await item.getType(imageType);
      const extension = imageType.split("/")[1] || "png";
      const file = new File([blob], "clipboard-image." + extension.replace(/[^a-z0-9]+/gi, ""), { type: imageType });
      await setSourceFromFile(file);
      input.setOutput("Loaded clipboard image for prompt interpretation.");
      return true;
    }
    throw new Error("Clipboard does not contain an image.");
  }

  function setDetailMode(mode) {
    const normalized = mode === "precise" || mode === "vague" ? mode : "normal";
    sourceState.detailMode = normalized;
    document.querySelectorAll("[data-image-interpret-detail]").forEach(button => {
      const active = button.getAttribute("data-image-interpret-detail") === normalized;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });
  }

  async function captureSourceFromWebcam() {
    const result = await input.captureWebcam({
      kicker: "Image Studio",
      title: "Capture Prompt Source",
      message: "Capture one webcam frame and use it as the Image Studio prompt-builder source.",
      fileNamePrefix: "image-prompt-webcam",
      captureLabel: "Use Capture"
    });
    if (!result) return false;
    if (result.error) throw new Error(result.error);
    await setSourceFromFile(result.file);
    input.setOutput("Loaded webcam capture for prompt interpretation.");
    return true;
  }

  async function interpretSource() {
    const imageInput = String(sourceState.value || "").trim();
    if (!imageInput) throw new Error("Upload a source image first.");
    if (document.getElementById("image-identify-objects-toggle")?.checked === true) {
      return input.interpretObjects();
    }
    input.setGenerationStatus("Interpreting source image with LLM...");
    const payload = await input.request("/api/image-interpret-prompt", {
      imageInput,
      imageFileNameHint: sourceState.fileName || undefined,
      detailMode: sourceState.detailMode || "normal",
      direction: String(document.getElementById("image-interpret-direction-input")?.value || "").trim() || undefined
    });
    const prompt = String(payload?.prompt || "").trim();
    if (!prompt) throw new Error("The vision model returned an empty image prompt.");
    const promptNode = document.getElementById("imagegen-prompt");
    if (promptNode && typeof promptNode.value === "string") {
      promptNode.value = prompt;
      promptNode.dispatchEvent(new Event("input", { bubbles: true }));
      promptNode.dispatchEvent(new Event("change", { bubbles: true }));
      promptNode.focus?.();
    }
    const autoPromptToggle = document.getElementById("imagegen-auto-prompt");
    if (autoPromptToggle && typeof autoPromptToggle.checked === "boolean") {
      autoPromptToggle.checked = false;
      autoPromptToggle.dispatchEvent(new Event("change", { bubbles: true }));
    }
    input.setGenerationStatus("Prompt updated from source image.");
    input.setOutput("Image prompt replaced from " + (sourceState.fileName || "source image") + ".");
    return prompt;
  }

  return {
    applySourceAspectRatio,
    captureSourceFromWebcam,
    clearSource,
    fitDimensionsToAspectRatio,
    getSource,
    interpretSource,
    readClipboardImage,
    renderSource,
    setDetailMode,
    setSourceFromClipboardEvent,
    setSourceFromFile
  };
}
