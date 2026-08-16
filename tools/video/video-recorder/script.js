(function () {
  const state = {
    recorder: null,
    stream: null,
    chunks: [],
    result: null
  };
  const els = {
    videoDevice: document.getElementById("video-device-select"),
    audioDevice: document.getElementById("audio-device-select"),
    includeAudio: document.getElementById("include-audio-toggle"),
    refresh: document.getElementById("refresh-devices-button"),
    start: document.getElementById("start-recording-button"),
    stop: document.getElementById("stop-recording-button"),
    status: document.getElementById("status-output"),
    live: document.getElementById("live-preview"),
    title: document.getElementById("recording-title"),
    preview: document.getElementById("recording-preview"),
    download: document.getElementById("download-link")
  };

  function setStatus(text) {
    els.status.textContent = text || "Ready.";
  }

  function setRecording(recording) {
    els.start.classList.toggle("hidden", recording);
    els.stop.classList.toggle("hidden", !recording);
  }

  function getPreferredMimeType() {
    const candidates = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
    if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") return "";
    return candidates.find(type => MediaRecorder.isTypeSupported(type)) || "";
  }

  function extensionFromMimeType(mimeType) {
    return String(mimeType || "").toLowerCase().includes("mp4") ? "mp4" : "webm";
  }

  function stopStream() {
    if (state.stream) state.stream.getTracks().forEach(track => track.stop());
    state.stream = null;
    els.live.srcObject = null;
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
      reader.onerror = () => reject(reader.error || new Error("Could not read recording."));
      reader.readAsDataURL(blob);
    });
  }

  function fillSelect(select, devices, fallbackLabel) {
    select.innerHTML = "";
    if (devices.length === 0) {
      select.append(new Option(fallbackLabel, ""));
      return;
    }
    devices.forEach((device, index) => {
      select.append(new Option(device.label || fallbackLabel + " " + (index + 1), device.deviceId || ""));
    });
  }

  async function refreshDevices() {
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.enumerateDevices !== "function") {
      fillSelect(els.videoDevice, [], "Default camera");
      fillSelect(els.audioDevice, [], "Default microphone");
      return;
    }
    const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
    fillSelect(els.videoDevice, devices.filter(device => device.kind === "videoinput"), "Default camera");
    fillSelect(els.audioDevice, devices.filter(device => device.kind === "audioinput"), "Default microphone");
  }

  function buildMediaConstraints() {
    const videoDeviceId = String(els.videoDevice.value || "").trim();
    const audioDeviceId = String(els.audioDevice.value || "").trim();
    return {
      video: videoDeviceId ? { deviceId: { exact: videoDeviceId } } : true,
      audio: els.includeAudio.checked ? (audioDeviceId ? { deviceId: { exact: audioDeviceId } } : true) : false
    };
  }

  async function startRecording() {
    if (!navigator.mediaDevices || typeof MediaRecorder === "undefined") {
      setStatus("Video recording is not supported in this browser.");
      return;
    }
    if (state.recorder) {
      setStatus("Stop the current recording first.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia(buildMediaConstraints());
      const mimeType = getPreferredMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      state.stream = stream;
      state.recorder = recorder;
      state.chunks = [];
      els.live.srcObject = stream;
      recorder.addEventListener("dataavailable", event => {
        if (event.data && event.data.size > 0) state.chunks.push(event.data);
      });
      recorder.addEventListener("stop", finishRecording, { once: true });
      recorder.start();
      setRecording(true);
      setStatus("Recording webcam...");
    } catch (error) {
      stopStream();
      state.recorder = null;
      setRecording(false);
      setStatus(error && error.message ? error.message : "Recording failed.");
    }
  }

  async function finishRecording() {
    const mimeType = state.recorder?.mimeType || getPreferredMimeType() || "video/webm";
    const blob = new Blob(state.chunks, { type: mimeType });
    const extension = extensionFromMimeType(mimeType);
    const fileName = "video-recording-" + new Date().toISOString().replace(/[:.]/g, "-") + "." + extension;
    const dataUrl = await blobToDataUrl(blob);
    const objectUrl = URL.createObjectURL(blob);
    state.result = { fileName, dataUrl, blob, mimeType };
    els.title.textContent = fileName;
    els.preview.src = objectUrl;
    els.download.href = objectUrl;
    els.download.download = fileName;
    els.download.classList.remove("hidden");
    state.recorder = null;
    state.chunks = [];
    stopStream();
    setRecording(false);
    setStatus("Recording ready.");
  }

  function stopRecording() {
    if (!state.recorder) return;
    setStatus("Finishing recording...");
    state.recorder.stop();
  }

  window.describeCurrentAssets = function () {
    if (!state.result) return [];
    return [{
      kind: "video",
      resourceKind: "video",
      fileName: state.result.fileName,
      mimeType: state.result.mimeType,
      dataUrl: state.result.dataUrl,
      previewUrl: state.result.dataUrl,
      title: "Video Recorder output"
    }];
  };

  els.refresh.addEventListener("click", () => void refreshDevices());
  els.start.addEventListener("click", () => void startRecording());
  els.stop.addEventListener("click", stopRecording);
  setRecording(false);
  void refreshDevices();
})();
