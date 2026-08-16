function createDashboardImageQuickActionModalExecution(dependencies) {
  const {
    closeModal,
    getActionKey,
    readOptionalNumberInput,
    runDelightInBlender,
    runDelightInTool,
    runImageAction,
    runModel3dAction,
    runRotate360Action,
    runVideoAction
  } = dependencies;

  function readVideoOptions() {
    return {
      prompt: document.getElementById("image-quick-action-prompt")?.value.trim() || "",
      frames: readOptionalNumberInput("image-quick-action-length", { min: 1, max: 512 }),
      fps: readOptionalNumberInput("image-quick-action-fps", { min: 1, max: 60 }),
      steps: readOptionalNumberInput("image-quick-action-steps", { min: 1, max: 250 }),
      width: readOptionalNumberInput("image-quick-action-width", { min: 64, max: 4096 }),
      height: readOptionalNumberInput("image-quick-action-height", { min: 64, max: 4096 }),
      seed: readOptionalNumberInput("image-quick-action-seed", { min: 0, max: Number.MAX_SAFE_INTEGER }),
      generate: true,
      focusStudio: false,
      replacePrompt: true
    };
  }

  function readLayeredOptions() {
    return {
      prompt: document.getElementById("image-quick-action-prompt")?.value.trim() || "",
      steps: readOptionalNumberInput("image-quick-action-steps", { min: 1, max: 250 }),
      cfg: readOptionalNumberInput("image-quick-action-cfg", { min: 0, max: 30, integer: false }),
      layers: readOptionalNumberInput("image-quick-action-layers", { min: 1, max: 16 }),
      seed: readOptionalNumberInput("image-quick-action-seed", { min: 0, max: Number.MAX_SAFE_INTEGER })
    };
  }

  function readModelOptions() {
    return {
      useLlmModelFileName: document.getElementById("image-quick-action-model-filename")?.checked === true,
      useLlmModelDescription: document.getElementById("image-quick-action-model-description")?.checked === true,
      askLlmForRealWorldHeightAndScale: document.getElementById("image-quick-action-model-scale")?.checked === true,
      createLowPolyAfterGeneration: document.getElementById("image-quick-action-model-lowpoly")?.checked === true,
      focusStudio: false
    };
  }

  async function execute() {
    const actionKey = getActionKey();
    if (!actionKey) {
      return;
    }
    if (actionKey === "model3d") {
      await runModel3dAction(readModelOptions());
    } else if (actionKey === "layered") {
      await runImageAction("layered", readLayeredOptions());
    } else if (actionKey === "delight") {
      const mode = String(document.getElementById("image-quick-action-mode")?.value || "comfyui").trim() || "comfyui";
      if (mode === "blender") {
        await runDelightInBlender();
      } else if (mode === "tool") {
        await runDelightInTool();
      } else {
        await runImageAction("delight");
      }
    } else {
      const options = readVideoOptions();
      await (actionKey === "rotate360" ? runRotate360Action(options) : runVideoAction(options));
    }
    closeModal();
  }

  return {
    execute,
    readLayeredOptions,
    readModelOptions,
    readVideoOptions
  };
}
