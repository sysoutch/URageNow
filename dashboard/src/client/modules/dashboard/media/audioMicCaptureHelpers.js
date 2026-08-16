function createDashboardAudioMicCaptureHelpers(input) {
  const state = {
    activeKey: "",
    activeRecorder: null,
    activeStream: null,
    activeChunks: []
  };
  const setOutput = typeof input?.setOutput === "function" ? input.setOutput : function setOutputFallback() {};
  const clearChildren = typeof input?.clearChildren === "function"
    ? input.clearChildren
    : node => {
      while (node && node.firstChild) node.removeChild(node.firstChild);
    };
  const setFileInputFiles = typeof input?.setFileInputFiles === "function" ? input.setFileInputFiles : function setFileInputFilesFallback() {};
  const onRecordedFile = typeof input?.onRecordedFile === "function" ? input.onRecordedFile : null;
  function setStatus(prefix, text) {
    const node = document.getElementById(prefix + "-mic-status");
    if (node) node.textContent = String(text || "").trim() || "Mic idle.";
  }
  function setButtons(prefix, recording) {
    const recordButton = document.getElementById(prefix + "-record-button");
    const stopButton = document.getElementById(prefix + "-stop-button");
    if (recordButton) recordButton.classList.toggle("hidden", recording === true);
    if (stopButton) stopButton.classList.toggle("hidden", recording !== true);
  }
  function getPreferredMimeType() {
    const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
    if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") return "";
    return candidates.find(type => MediaRecorder.isTypeSupported(type)) || "";
  }
  function getExtension(mimeType) {
    const normalized = String(mimeType || "").toLowerCase();
    if (normalized.includes("ogg")) return "ogg";
    if (normalized.includes("mp4")) return "m4a";
    return "webm";
  }
  function stopActiveStream() {
    if (state.activeStream) {
      state.activeStream.getTracks().forEach(track => track.stop());
    }
    state.activeStream = null;
  }
  function clearRecorder() {
    state.activeKey = "";
    state.activeRecorder = null;
    state.activeChunks = [];
    stopActiveStream();
  }
  async function refreshDevices(prefix) {
    const selectNode = document.getElementById(prefix + "-mic-device");
    if (!selectNode) return;
    const previousValue = String(selectNode.value || "").trim();
    clearChildren(selectNode);
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.enumerateDevices !== "function") {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "Microphone listing unavailable";
      selectNode.appendChild(option);
      selectNode.disabled = true;
      setStatus(prefix, "This browser cannot list microphones.");
      return;
    }
    let devices = [];
    try {
      devices = await navigator.mediaDevices.enumerateDevices();
    } catch {
      devices = [];
    }
    const microphones = devices.filter(device => device && device.kind === "audioinput");
    if (microphones.length === 0) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "No microphones detected";
      selectNode.appendChild(option);
      selectNode.disabled = true;
      setStatus(prefix, "No microphones detected yet. Allow mic permission and refresh.");
      return;
    }
    microphones.forEach((device, index) => {
      const option = document.createElement("option");
      option.value = String(device.deviceId || "");
      option.textContent = String(device.label || "").trim() || ("Microphone " + (index + 1));
      selectNode.appendChild(option);
    });
    selectNode.disabled = false;
    if (previousValue && microphones.some(device => device.deviceId === previousValue)) {
      selectNode.value = previousValue;
    }
    setStatus(prefix, "Ready to record from " + (selectNode.selectedOptions[0]?.textContent || "selected microphone") + ".");
  }
  async function beginRecording(prefix) {
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== "function" || typeof MediaRecorder === "undefined") {
      setOutput("Microphone recording is not supported in this browser.");
      setStatus(prefix, "Browser does not support microphone recording.");
      return;
    }
    if (state.activeRecorder) {
      setOutput("Stop the current microphone recording first.");
      return;
    }
    const selectNode = document.getElementById(prefix + "-mic-device");
    const fileInput = document.getElementById(prefix + "-file");
    const selectedDeviceId = String(selectNode?.value || "").trim();
    const mimeType = getPreferredMimeType();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : true,
        video: false
      });
      await refreshDevices(prefix);
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      state.activeKey = prefix;
      state.activeRecorder = recorder;
      state.activeStream = stream;
      state.activeChunks = [];
      recorder.addEventListener("dataavailable", event => {
        if (event.data && event.data.size > 0) state.activeChunks.push(event.data);
      });
      recorder.addEventListener("stop", () => {
        const blob = new Blob(state.activeChunks, { type: recorder.mimeType || mimeType || "audio/webm" });
        const extension = getExtension(blob.type || recorder.mimeType || mimeType);
        const recordedFile = new File([blob], prefix.replace("speech-", "") + "-mic-recording." + extension, { type: blob.type || "audio/webm" });
        if (fileInput) setFileInputFiles(fileInput, [recordedFile]);
        setStatus(prefix, "Recorded " + recordedFile.name + " from microphone. Saving to disk...");
        if (onRecordedFile) {
          void onRecordedFile({ prefix, file: recordedFile });
        }
        setButtons(prefix, false);
        clearRecorder();
      }, { once: true });
      recorder.start(250);
      setButtons(prefix, true);
      setStatus(prefix, "Recording from microphone...");
    } catch (error) {
      clearRecorder();
      setButtons(prefix, false);
      const detail = error && error.message ? error.message : "Microphone access failed.";
      setStatus(prefix, detail);
      setOutput(detail);
    }
  }
  function stopRecording(prefix) {
    if (!state.activeRecorder || state.activeKey !== prefix) {
      setButtons(prefix, false);
      return;
    }
    setStatus(prefix, "Finishing microphone recording...");
    if (typeof state.activeRecorder.requestData === "function") {
      state.activeRecorder.requestData();
    }
    state.activeRecorder.stop();
  }
  function bind(prefix) {
    const refreshButton = document.getElementById(prefix + "-refresh-mics-button");
    const recordButton = document.getElementById(prefix + "-record-button");
    const stopButton = document.getElementById(prefix + "-stop-button");
    const selectNode = document.getElementById(prefix + "-mic-device");
    refreshButton?.addEventListener("click", () => {
      void refreshDevices(prefix);
    });
    recordButton?.addEventListener("click", () => {
      void beginRecording(prefix);
    });
    stopButton?.addEventListener("click", () => {
      stopRecording(prefix);
    });
    selectNode?.addEventListener("change", () => {
      const label = selectNode.selectedOptions[0]?.textContent || "selected microphone";
      setStatus(prefix, "Ready to record from " + label + ".");
    });
    setButtons(prefix, false);
    void refreshDevices(prefix);
  }
  return {
    bind,
    refreshDevices
  };
}
