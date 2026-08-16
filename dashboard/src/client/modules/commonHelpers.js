function splitLines(value) {
  return String(value || "").split(/\r?\n/).map(entry => entry.trim()).filter(entry => entry.length > 0);
}

function createImageId() {
  return "img-" + Math.random().toString(36).slice(2, 10);
}

function normalizePathLabel(value) {
  const trimmed = String(value || "").trim().replace(/^"(.*)"$/, "$1");
  const parts = trimmed.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] || trimmed || "Local image";
}

function isLikelyImagePath(value) {
  return /\.(png|jpe?g|gif|webp|bmp|tiff?)$/i.test(String(value || "").trim());
}

function parseImageTextInputs(value) {
  const entries = [];
  for (const line of splitLines(value)) {
    if (/^data:image\/[a-z0-9.+-]+;base64,/i.test(line)) {
      entries.push({
        id: createImageId(),
        sourceType: "data-url",
        value: line,
        name: "Pasted image data",
        detail: "Data URL",
        previewUrl: line
      });
      continue;
    }
    if (/^https?:\/\/.+\.(png|jpe?g|gif|webp|bmp|tiff?)(\?.*)?$/i.test(line)) {
      entries.push({
        id: createImageId(),
        sourceType: "url",
        value: line,
        name: normalizePathLabel(line),
        detail: "Image URL",
        previewUrl: line
      });
      continue;
    }
    if (isLikelyImagePath(line) || /^file:\/\//i.test(line)) {
      entries.push({
        id: createImageId(),
        sourceType: "path",
        value: line,
        name: normalizePathLabel(line),
        detail: "Local path",
        previewUrl: ""
      });
    }
  }
  return entries;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error || new Error("Could not read image file."));
    reader.readAsDataURL(file);
  });
}

function readBlobAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error || new Error("Could not read GIF blob."));
    reader.readAsDataURL(blob);
  });
}

function openDashboardChoiceOverlay(options) {
  return new Promise(resolve => {
    const host = document.querySelector(".app-shell") || document.body;
    const overlay = document.createElement("div");
    overlay.className = "runtime-overlay dashboard-choice-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "dashboard-choice-overlay-title");

    const backdrop = document.createElement("button");
    backdrop.className = "runtime-overlay-backdrop dashboard-choice-overlay-backdrop";
    backdrop.type = "button";
    backdrop.setAttribute("aria-label", "Cancel");

    const panel = document.createElement("section");
    panel.className = "runtime-overlay-panel dashboard-choice-overlay-panel";

    const header = document.createElement("header");
    header.className = "runtime-overlay-header";
    const titleWrap = document.createElement("div");
    titleWrap.className = "runtime-overlay-title-wrap";
    const kicker = document.createElement("span");
    kicker.className = "panel-kicker";
    kicker.textContent = options?.kicker || "Choose action";
    const title = document.createElement("h3");
    title.id = "dashboard-choice-overlay-title";
    title.textContent = options?.title || "How should this open?";
    const message = document.createElement("p");
    message.className = "dashboard-choice-overlay-message";
    message.textContent = options?.message || "Pick how the selected items should be handled.";
    titleWrap.append(kicker, title, message);

    const closeButton = document.createElement("button");
    closeButton.className = "secondary mini-button dashboard-choice-overlay-close";
    closeButton.type = "button";
    closeButton.textContent = options?.cancelLabel || "Cancel";
    header.append(titleWrap, closeButton);

    const body = document.createElement("div");
    body.className = "dashboard-choice-overlay-body";
    if (options?.detail) {
      const detail = document.createElement("p");
      detail.className = "dashboard-choice-overlay-detail";
      detail.textContent = options.detail;
      body.appendChild(detail);
    }

    const actions = document.createElement("div");
    actions.className = "dashboard-choice-overlay-actions";
    const oneButton = document.createElement("button");
    oneButton.className = "primary dashboard-choice-overlay-action";
    oneButton.type = "button";
    oneButton.textContent = options?.oneLabel || "One scene";
    const separateButton = document.createElement("button");
    separateButton.className = "secondary dashboard-choice-overlay-action";
    separateButton.type = "button";
    separateButton.textContent = options?.separateLabel || "Separate windows";
    actions.append(oneButton, separateButton);
    panel.append(header, body, actions);
    overlay.append(backdrop, panel);

    const previousFocus = document.activeElement;
    let settled = false;
    const cleanup = value => {
      if (settled) {
        return;
      }
      settled = true;
      document.removeEventListener("keydown", onKeyDown);
      overlay.remove();
      document.body.classList.remove("runtime-overlay-open");
      if (previousFocus && typeof previousFocus.focus === "function") {
        previousFocus.focus();
      }
      resolve(value);
    };
    const onKeyDown = event => {
      if (event.key === "Escape") {
        event.preventDefault();
        cleanup(null);
      }
    };
    oneButton.addEventListener("click", () => cleanup("one"));
    separateButton.addEventListener("click", () => cleanup("separate"));
    closeButton.addEventListener("click", () => cleanup(null));
    backdrop.addEventListener("click", () => cleanup(null));
    document.addEventListener("keydown", onKeyDown);
    document.body.classList.add("runtime-overlay-open");
    host.appendChild(overlay);
    window.setTimeout(() => oneButton.focus(), 0);
  });
}

function createDashboardWebcamCaptureFileName(prefix) {
  const safePrefix = String(prefix || "webcam-capture").trim().replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "") || "webcam-capture";
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return safePrefix + "-" + stamp + ".png";
}

function canvasToPngBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) {
        resolve(blob);
        return;
      }
      reject(new Error("Failed to capture webcam frame."));
    }, "image/png");
  });
}

async function openDashboardWebcamCaptureOverlay(options) {
  if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== "function") {
    throw new Error("Webcam capture is not available in this browser.");
  }
  let stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
  return await new Promise(resolve => {
    const host = document.querySelector(".app-shell") || document.body;
    const overlay = document.createElement("div");
    overlay.className = "runtime-overlay dashboard-webcam-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "dashboard-webcam-overlay-title");

    const backdrop = document.createElement("button");
    backdrop.className = "runtime-overlay-backdrop dashboard-webcam-overlay-backdrop";
    backdrop.type = "button";
    backdrop.setAttribute("aria-label", "Cancel webcam capture");

    const panel = document.createElement("section");
    panel.className = "runtime-overlay-panel dashboard-webcam-overlay-panel";

    const header = document.createElement("header");
    header.className = "runtime-overlay-header";
    const titleWrap = document.createElement("div");
    titleWrap.className = "runtime-overlay-title-wrap";
    const kicker = document.createElement("span");
    kicker.className = "panel-kicker";
    kicker.textContent = options?.kicker || "Webcam";
    const title = document.createElement("h3");
    title.id = "dashboard-webcam-overlay-title";
    title.textContent = options?.title || "Capture From Webcam";
    const message = document.createElement("p");
    message.className = "dashboard-webcam-overlay-message";
    message.textContent = options?.message || "Allow camera access, frame the source image, then capture a PNG.";
    titleWrap.append(kicker, title, message);

    const closeButton = document.createElement("button");
    closeButton.className = "secondary mini-button dashboard-webcam-overlay-close";
    closeButton.type = "button";
    closeButton.textContent = "Cancel";
    header.append(titleWrap, closeButton);

    const video = document.createElement("video");
    video.className = "dashboard-webcam-preview";
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;

    const deviceField = document.createElement("label");
    deviceField.className = "dashboard-webcam-device-field";
    const deviceLabel = document.createElement("span");
    deviceLabel.textContent = "Webcam";
    const deviceSelect = document.createElement("select");
    deviceSelect.className = "dashboard-webcam-device-select";
    deviceField.append(deviceLabel, deviceSelect);

    const actions = document.createElement("div");
    actions.className = "dashboard-webcam-overlay-actions";
    const captureButton = document.createElement("button");
    captureButton.className = "primary dashboard-webcam-capture-button";
    captureButton.type = "button";
    captureButton.textContent = options?.captureLabel || "Capture Image";
    const cancelButton = document.createElement("button");
    cancelButton.className = "secondary dashboard-webcam-cancel-button";
    cancelButton.type = "button";
    cancelButton.textContent = "Cancel";
    actions.append(cancelButton, captureButton);
    panel.append(header, deviceField, video, actions);
    overlay.append(backdrop, panel);

    const previousFocus = document.activeElement;
    let settled = false;
    const stopStream = () => {
      stream.getTracks().forEach(track => track.stop());
    };
    const cleanup = value => {
      if (settled) {
        return;
      }
      settled = true;
      document.removeEventListener("keydown", onKeyDown);
      stopStream();
      overlay.remove();
      document.body.classList.remove("runtime-overlay-open");
      if (previousFocus && typeof previousFocus.focus === "function") {
        previousFocus.focus();
      }
      resolve(value);
    };
    const getActiveVideoDeviceId = () => stream.getVideoTracks()[0]?.getSettings?.().deviceId || "";
    const renderDeviceOptions = devices => {
      const activeId = getActiveVideoDeviceId();
      deviceSelect.innerHTML = "";
      const videoDevices = devices.filter(device => device.kind === "videoinput");
      videoDevices.forEach((device, index) => {
        const option = document.createElement("option");
        option.value = device.deviceId;
        option.textContent = device.label || ("Webcam " + (index + 1));
        option.selected = device.deviceId === activeId;
        deviceSelect.appendChild(option);
      });
      deviceSelect.disabled = videoDevices.length <= 1;
      deviceField.classList.toggle("is-disabled", videoDevices.length <= 1);
    };
    const refreshDeviceList = async () => {
      if (typeof navigator.mediaDevices.enumerateDevices !== "function") {
        return;
      }
      try {
        renderDeviceOptions(await navigator.mediaDevices.enumerateDevices());
      } catch {}
    };
    const switchWebcamDevice = async deviceId => {
      const nextDeviceId = String(deviceId || "").trim();
      if (!nextDeviceId || nextDeviceId === getActiveVideoDeviceId()) {
        return;
      }
      const previousStream = stream;
      stream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: nextDeviceId } }, audio: false });
      previousStream.getTracks().forEach(track => track.stop());
      video.srcObject = stream;
      await video.play().catch(() => {});
      await refreshDeviceList();
    };
    const onKeyDown = event => {
      if (event.key === "Escape") {
        event.preventDefault();
        cleanup(null);
      }
    };
    deviceSelect.addEventListener("change", async event => {
      deviceSelect.disabled = true;
      try {
        await switchWebcamDevice(event.currentTarget?.value || "");
      } catch (error) {
        cleanup({
          error: error instanceof Error ? error.message : "Failed to switch webcam."
        });
      } finally {
        if (!settled) {
          deviceSelect.disabled = deviceSelect.options.length <= 1;
        }
      }
    });
    captureButton.addEventListener("click", async () => {
      try {
        const width = video.videoWidth || 1280;
        const height = video.videoHeight || 720;
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) {
          throw new Error("Canvas capture is not available.");
        }
        context.drawImage(video, 0, 0, width, height);
        const blob = await canvasToPngBlob(canvas);
        const fileName = createDashboardWebcamCaptureFileName(options?.fileNamePrefix || "webcam-source");
        cleanup({
          file: new File([blob], fileName, { type: "image/png", lastModified: Date.now() }),
          dataUrl: canvas.toDataURL("image/png"),
          fileName
        });
      } catch (error) {
        cleanup({
          error: error instanceof Error ? error.message : "Failed to capture webcam image."
        });
      }
    });
    [cancelButton, closeButton, backdrop].forEach(node => node.addEventListener("click", () => cleanup(null)));
    document.addEventListener("keydown", onKeyDown);
    document.body.classList.add("runtime-overlay-open");
    host.appendChild(overlay);
    void video.play().catch(() => {});
    void refreshDeviceList();
    window.setTimeout(() => captureButton.focus(), 0);
  });
}

const studioStatusState = {};

function resolveStudioStatusPhase(text) {
  const normalized = String(text || "").trim().toLowerCase();
  if (!normalized || normalized.startsWith("no ") || normalized.startsWith("ready ")) {
    return {
      stateLabel: "Idle",
      stateClass: "is-idle",
      progress: 0
    };
  }
  if (/(fail|failed|error|invalid|unable|timed out|timeout|denied|forbidden|missing)/.test(normalized)) {
    return {
      stateLabel: "Error",
      stateClass: "is-error",
      progress: 100
    };
  }
  if (/(waiting|queued|queue|pending)/.test(normalized)) {
    return {
      stateLabel: "Waiting",
      stateClass: "is-running",
      progress: 78
    };
  }
  if (/(generating|rendering|processing|downloading|uploading|request|requested|loading|unload|starting|running)/.test(normalized)) {
    return {
      stateLabel: "Working",
      stateClass: "is-running",
      progress: 46
    };
  }
  if (/(generated|success|successful|done|complete|completed|finished|saved|loaded|deleted|renamed|updated|exported|posted|ready)/.test(normalized)) {
    return {
      stateLabel: "Done",
      stateClass: "is-success",
      progress: 100
    };
  }
  return {
    stateLabel: "Update",
    stateClass: "is-running",
    progress: 36
  };
}

function getStudioStatusCurrentText(statusKey) {
  const key = String(statusKey || "").trim();
  if (!key) {
    return "";
  }
  return studioStatusState[key]?.currentText || "";
}

function setStudioStatusPanel(input) {
  const key = String(input?.statusKey || "").trim();
  if (!key) {
    return;
  }
  const message = String(input?.text || "").trim() || "No status message.";
  const phase = resolveStudioStatusPhase(message);
  const entry = studioStatusState[key] || {
    currentText: "",
    history: []
  };
  const isNewMessage = entry.currentText !== message;
  entry.currentText = message;
  if (isNewMessage) {
    const timestamp = new Date().toLocaleTimeString();
    entry.history.push(`[${timestamp}] ${message}`);
    if (entry.history.length > 120) {
      entry.history = entry.history.slice(entry.history.length - 120);
    }
  }
  studioStatusState[key] = entry;
  const currentNode = input.currentId ? document.getElementById(input.currentId) : null;
  if (currentNode) {
    currentNode.textContent = message;
  }
  const stateNode = input.stateId ? document.getElementById(input.stateId) : null;
  if (stateNode) {
    stateNode.textContent = phase.stateLabel;
    stateNode.classList.remove("is-idle", "is-running", "is-success", "is-error");
    stateNode.classList.add(phase.stateClass);
  }
  const progressTrackNode = input.progressTrackId ? document.getElementById(input.progressTrackId) : null;
  if (progressTrackNode) {
    progressTrackNode.setAttribute("aria-valuenow", String(phase.progress));
  }
  const progressFillNode = input.progressFillId ? document.getElementById(input.progressFillId) : null;
  if (progressFillNode) {
    progressFillNode.style.width = `${phase.progress}%`;
  }
  const historyNode = input.historyId ? document.getElementById(input.historyId) : null;
  if (historyNode) {
    historyNode.value = entry.history.join("\n");
    historyNode.scrollTop = historyNode.scrollHeight;
  }
}
