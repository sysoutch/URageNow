function createDashboardModel3dSendDestinationHelpers(input) {
  const getElementById = typeof input?.getElementById === "function"
    ? input.getElementById
    : id => document.getElementById(id);
  const queryAll = typeof input?.queryAll === "function"
    ? input.queryAll
    : selector => Array.from(document.querySelectorAll(selector));
  const createElement = typeof input?.createElement === "function"
    ? input.createElement
    : tagName => document.createElement(tagName);
  const request = typeof input?.request === "function"
    ? input.request
    : async function requestFallback() {
      throw new Error("Dashboard request helper is unavailable.");
    };
  let activeTab = "tool";
  let applicationsLoaded = false;
  let overlayBackdrop = null;
  let printMode = "send";

  function mountPanelAtOverlayRoot() {
    const panel = getElementById("model3d-send-destination-panel");
    const overlayRoot = input?.overlayRoot
      || (typeof document !== "undefined" ? document.body : null);
    if (!panel || !overlayRoot) return;
    if (!overlayBackdrop) {
      overlayBackdrop = createElement("div");
      overlayBackdrop.id = "model3d-send-destination-backdrop";
      overlayBackdrop.className = "studio-send-destination-backdrop hidden";
      overlayRoot.appendChild(overlayBackdrop);
    }
    if (panel.parentElement !== overlayBackdrop) overlayBackdrop.appendChild(panel);
  }

  function setStatus(message, isError = false) {
    const status = getElementById("model3d-print-send-status");
    if (!status) return;
    status.textContent = message;
    status.classList.toggle("error", isError);
  }

  function setGameEngineStatus(message, isError = false) {
    const status = getElementById("model3d-game-engine-send-status");
    if (!status) return;
    status.textContent = message;
    status.classList.toggle("error", isError);
  }

  function getGameEngineLabel(engine) {
    if (engine === "godot") return "Godot";
    if (engine === "unreal") return "Unreal";
    return "Unity";
  }

  function inferModelMimeType(fileName) {
    const normalized = String(fileName || "").trim().toLowerCase();
    if (normalized.endsWith(".glb")) return "model/gltf-binary";
    if (normalized.endsWith(".gltf")) return "model/gltf+json";
    if (normalized.endsWith(".fbx")) return "model/fbx";
    if (normalized.endsWith(".obj")) return "model/obj";
    if (normalized.endsWith(".stl")) return "model/stl";
    if (normalized.endsWith(".ply")) return "model/ply";
    return "application/octet-stream";
  }

  function setPanelOpen(open) {
    const toggle = getElementById("model3d-send-menu-toggle");
    const panel = getElementById("model3d-send-destination-panel");
    if (!panel) return;
    panel.classList.toggle("hidden", open !== true);
    overlayBackdrop?.classList.toggle("hidden", open !== true);
    toggle?.setAttribute("aria-expanded", open === true ? "true" : "false");
    if (open === true) {
      update();
      getElementById("model3d-send-destination-close")?.focus();
    } else {
      toggle?.focus();
    }
  }

  function selectTab(tab) {
    const nextTab = ["tool", "game-engine", "3d-suite", "3d-print"].includes(tab) ? tab : "tool";
    activeTab = nextTab;
    queryAll("[data-model3d-send-tab]").forEach(button => {
      const selected = button.getAttribute("data-model3d-send-tab") === nextTab;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-selected", selected ? "true" : "false");
    });
    queryAll("[data-model3d-send-pane]").forEach(pane => {
      const selected = pane.getAttribute("data-model3d-send-pane") === nextTab;
      pane.classList.toggle("active", selected);
      pane.classList.toggle("hidden", !selected);
    });
  }

  async function loadPrintApplications() {
    if (applicationsLoaded) return;
    const select = getElementById("model3d-print-application-select");
    const pathField = getElementById("model3d-print-executable-path");
    try {
      const payload = await request("/api/model3d/print-applications");
      const applications = Array.isArray(payload?.applications) ? payload.applications : [];
      if (select) {
        input.clearChildren(select);
        applications.forEach(application => {
          const option = createElement("option");
          option.value = application.id;
          option.textContent = application.label;
          select.appendChild(option);
        });
      }
      const selected = applications.find(application => application.id === select?.value) || applications[0] || null;
      if (pathField) pathField.value = selected?.executablePath || "";
      setStatus(selected?.executableDetected
        ? "BambuLab Studio is ready."
        : "BambuLab Studio was not detected. Configure BAMBU_STUDIO_EXECUTABLE_PATH and restart URage NOW.",
      !selected?.executableDetected);
      applicationsLoaded = true;
      update();
    } catch (error) {
      setStatus(error?.message || "Failed to load 3D print applications.", true);
    }
  }

  function update() {
    const selected = input.getSelectedGeneratedModel();
    const hasModel = Boolean(selected?.id);
    const printButton = getElementById("model3d-send-to-3d-print-button");
    const suiteButton = getElementById("model3d-send-to-3d-suite-button");
    const gameEngineButton = getElementById("model3d-send-to-game-engine-button");
    if (printButton) printButton.disabled = !hasModel;
    if (suiteButton) suiteButton.disabled = !hasModel;
    if (gameEngineButton) gameEngineButton.disabled = !hasModel;
    if (!hasModel) {
      setStatus("Select a generated model to send.");
      setGameEngineStatus("Select a generated model to queue.");
    }
  }

  async function queueSelectedModelForGameEngine() {
    const selected = input.getSelectedGeneratedModel();
    const viewerTarget = selected ? input.getModel3dViewerTarget(selected) : null;
    const fileName = String(viewerTarget?.fileName || selected?.modelFileName || "").trim();
    const engine = String(getElementById("model3d-game-engine-select")?.value || "unity").trim();
    const customTitle = String(getElementById("model3d-game-engine-title")?.value || "").trim();
    if (!selected?.id || !fileName) {
      setGameEngineStatus("Select a generated model with an available model file.", true);
      return;
    }
    if (!["unity", "godot", "unreal"].includes(engine)) {
      setGameEngineStatus("Choose a supported game engine.", true);
      return;
    }
    if (typeof input.getModel3dFileUrl !== "function" || typeof input.buildAbsoluteDashboardUrl !== "function") {
      setGameEngineStatus("The model export service is unavailable.", true);
      return;
    }
    const button = getElementById("model3d-send-to-game-engine-button");
    try {
      if (button) button.disabled = true;
      setGameEngineStatus("Queueing " + fileName + " for " + getGameEngineLabel(engine) + " ...");
      await request("/api/game-engine-export", {
        engine,
        sourceStudio: "model3d",
        resourceKind: "model3d",
        title: customTitle || fileName,
        fileName,
        mimeType: inferModelMimeType(fileName),
        sourceUrl: input.buildAbsoluteDashboardUrl(input.getModel3dFileUrl(selected.id, fileName)),
        metadata: {modelId: selected.id, variant: "current"}
      });
      const message = "Queued " + fileName + " for " + getGameEngineLabel(engine) + ".";
      setGameEngineStatus(message);
      input.setOutput(message);
      setPanelOpen(false);
    } catch (error) {
      const message = error?.message || "Failed to queue the model for game engine export.";
      setGameEngineStatus(message, true);
      input.setOutput(message);
    } finally {
      if (button) button.disabled = false;
      update();
    }
  }

  function setPrintMode(mode) {
    printMode = mode === "print" ? "print" : "send";
    const label = getElementById("model3d-send-to-3d-print-label");
    const toggle = getElementById("model3d-send-to-3d-print-options-button");
    const menu = getElementById("model3d-send-to-3d-print-options");
    if (label) label.textContent = printMode === "print" ? "Send to BambuLab + Print" : "Send to BambuLab";
    if (menu) menu.classList.add("hidden");
    toggle?.setAttribute("aria-expanded", "false");
    queryAll("[data-model3d-print-mode]").forEach(option => {
      option.classList.toggle("active", option.getAttribute("data-model3d-print-mode") === printMode);
    });
    if (printMode === "print") {
      setStatus("Print mode is selected, but no slicer preset or printer transport is configured. Nothing will be printed.", true);
    } else {
      setStatus("Send mode opens the selected model in Bambu Studio.");
    }
  }

  async function sendSelectedModelToPrintApplication() {
    const selected = input.getSelectedGeneratedModel();
    const viewerTarget = selected ? input.getModel3dViewerTarget(selected) : null;
    const fileName = String(viewerTarget?.fileName || selected?.modelFileName || "").trim();
    if (!selected?.id || !fileName) {
      setStatus("Select a generated model with an available model file.", true);
      return;
    }
    if (printMode === "print") {
      setStatus("BambuLab + Print needs a configured slicing preset and printer transport. The current integration only opens Bambu Studio.", true);
      return;
    }
    const applicationId = getElementById("model3d-print-application-select")?.value || "bambu-studio";
    const button = getElementById("model3d-send-to-3d-print-button");
    try {
      if (button) button.disabled = true;
      setStatus("Opening " + fileName + " in BambuLab Studio ...");
      await request("/api/model3d/print-applications/launch", {
        applicationId,
        modelId: selected.id,
        fileName
      });
      setStatus("Opened " + fileName + " in BambuLab Studio.");
      input.setOutput("Opened " + fileName + " in BambuLab Studio.");
      setPanelOpen(false);
    } catch (error) {
      const message = error?.message || "Failed to open the model in BambuLab Studio.";
      setStatus(message, true);
      input.setOutput(message);
    } finally {
      if (button) button.disabled = false;
      update();
    }
  }

  function bind() {
    mountPanelAtOverlayRoot();
    const toggle = getElementById("model3d-send-menu-toggle");
    if (toggle && toggle.dataset.sendDestinationBound !== "true") {
      toggle.dataset.sendDestinationBound = "true";
      toggle.addEventListener("click", event => {
        event.preventDefault();
        const panel = getElementById("model3d-send-destination-panel");
        setPanelOpen(Boolean(panel?.classList.contains("hidden")));
      });
    }
    const closeButton = getElementById("model3d-send-destination-close");
    if (closeButton && closeButton.dataset.sendDestinationBound !== "true") {
      closeButton.dataset.sendDestinationBound = "true";
      closeButton.addEventListener("click", event => {
        event.preventDefault();
        setPanelOpen(false);
      });
    }
    queryAll("[data-model3d-send-tab]").forEach(button => {
      if (button.dataset.sendDestinationBound === "true") return;
      button.dataset.sendDestinationBound = "true";
      button.addEventListener("click", event => {
        event.preventDefault();
        selectTab(String(button.getAttribute("data-model3d-send-tab") || "tool"));
      });
    });
    const gameEngineButton = getElementById("model3d-send-to-game-engine-button");
    if (gameEngineButton && gameEngineButton.dataset.sendDestinationBound !== "true") {
      gameEngineButton.dataset.sendDestinationBound = "true";
      gameEngineButton.addEventListener("click", event => {
        event.preventDefault();
        void queueSelectedModelForGameEngine();
      });
    }
    const suiteButton = getElementById("model3d-send-to-3d-suite-button");
    if (suiteButton && suiteButton.dataset.sendDestinationBound !== "true") {
      suiteButton.dataset.sendDestinationBound = "true";
      suiteButton.addEventListener("click", event => {
        event.preventDefault();
        getElementById("model3d-open-in-blender-button")?.click();
        setPanelOpen(false);
      });
    }
    const printButton = getElementById("model3d-send-to-3d-print-button");
    if (printButton && printButton.dataset.sendDestinationBound !== "true") {
      printButton.dataset.sendDestinationBound = "true";
      printButton.addEventListener("click", event => {
        event.preventDefault();
        void sendSelectedModelToPrintApplication();
      });
    }
    const printOptionsButton = getElementById("model3d-send-to-3d-print-options-button");
    const printOptionsMenu = getElementById("model3d-send-to-3d-print-options");
    if (printOptionsButton && printOptionsMenu && printOptionsButton.dataset.sendDestinationBound !== "true") {
      printOptionsButton.dataset.sendDestinationBound = "true";
      printOptionsButton.addEventListener("click", event => {
        event.preventDefault();
        const open = printOptionsMenu.classList.contains("hidden");
        printOptionsMenu.classList.toggle("hidden", !open);
        printOptionsButton.setAttribute("aria-expanded", open ? "true" : "false");
      });
      queryAll("[data-model3d-print-mode]").forEach(option => {
        option.addEventListener("click", event => {
          event.preventDefault();
          setPrintMode(String(option.getAttribute("data-model3d-print-mode") || "send"));
        });
      });
    }
    if (typeof document !== "undefined" && document.documentElement?.dataset.model3dSendDestinationBound !== "true") {
      document.documentElement.dataset.model3dSendDestinationBound = "true";
      document.addEventListener("keydown", event => {
        if (event.key === "Escape" && !getElementById("model3d-send-destination-panel")?.classList.contains("hidden")) {
          setPanelOpen(false);
        }
      });
      document.addEventListener("pointerdown", event => {
        const panel = getElementById("model3d-send-destination-panel");
        const toggle = getElementById("model3d-send-menu-toggle");
        if (panel?.classList.contains("hidden") || panel?.contains(event.target) || toggle?.contains(event.target)) return;
        setPanelOpen(false);
      });
    }
    selectTab(activeTab);
    setPrintMode(printMode);
    update();
    void loadPrintApplications();
  }

  return {
    bind,
    loadPrintApplications,
    selectTab,
    queueSelectedModelForGameEngine,
    sendSelectedModelToPrintApplication,
    setPanelOpen,
    update
  };
}
