(function () {
  const state = {
    recorder: null,
    stream: null,
    sourceStreams: [],
    chunks: [],
    result: null
  };
  const els = {
    source: document.getElementById("audio-source-select"),
    device: document.getElementById("audio-device-select"),
    refresh: document.getElementById("refresh-devices-button"),
    start: document.getElementById("start-recording-button"),
    stop: document.getElementById("stop-recording-button"),
    status: document.getElementById("status-output"),
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
    const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
    if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") return "";
    return candidates.find(type => MediaRecorder.isTypeSupported(type)) || "";
  }

  function extensionFromMimeType(mimeType) {
    const normalized = String(mimeType || "").toLowerCase();
    if (normalized.includes("ogg")) return "ogg";
    if (normalized.includes("mp4")) return "m4a";
    return "webm";
  }

  function stopStream() {
    if (state.stream) state.stream.getTracks().forEach(track => track.stop());
    state.sourceStreams.forEach(stream => stream.getTracks().forEach(track => track.stop()));
    state.stream = null;
    state.sourceStreams = [];
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
      reader.onerror = () => reject(reader.error || new Error("Could not read recording."));
      reader.readAsDataURL(blob);
    });
  }

  async function refreshDevices() {
    els.device.innerHTML = "";
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.enumerateDevices !== "function") {
      els.device.append(new Option("Device listing unavailable", ""));
      els.device.disabled = true;
      return;
    }
    const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
    const microphones = devices.filter(device => device.kind === "audioinput");
    if (microphones.length === 0) {
      els.device.append(new Option("Default microphone", ""));
      return;
    }
    microphones.forEach((device, index) => {
      els.device.append(new Option(device.label || "Microphone " + (index + 1), device.deviceId || ""));
    });
  }

  async function getMicrophoneStream() {
    const deviceId = String(els.device.value || "").trim();
    return navigator.mediaDevices.getUserMedia({
      audio: deviceId ? { deviceId: { exact: deviceId } } : true,
      video: false
    });
  }

  async function getSystemAudioStream() {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    stream.getVideoTracks().forEach(track => track.stop());
    if (stream.getAudioTracks().length === 0) {
      stream.getTracks().forEach(track => track.stop());
      throw new Error("No system/tab audio track was shared.");
    }
    return new MediaStream(stream.getAudioTracks());
  }

  async function mixStreams(micStream, systemStream) {
    const audioContext = new AudioContext();
    const destination = audioContext.createMediaStreamDestination();
    audioContext.createMediaStreamSource(micStream).connect(destination);
    audioContext.createMediaStreamSource(systemStream).connect(destination);
    const mixed = destination.stream;
    mixed.addEventListener("inactive", () => audioContext.close().catch(() => {}), { once: true });
    return mixed;
  }

  async function createRecordingStream() {
    const source = els.source.value;
    if (source === "system") return getSystemAudioStream();
    if (source === "mixed") {
      const mic = await getMicrophoneStream();
      const system = await getSystemAudioStream();
      const mixed = await mixStreams(mic, system);
      state.sourceStreams = [mic, system];
      return mixed;
    }
    return getMicrophoneStream();
  }

  async function startRecording() {
    if (!navigator.mediaDevices || typeof MediaRecorder === "undefined") {
      setStatus("Recording is not supported in this browser.");
      return;
    }
    if (state.recorder) {
      setStatus("Stop the current recording first.");
      return;
    }
    try {
      const stream = await createRecordingStream();
      const mimeType = getPreferredMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      state.stream = stream;
      state.recorder = recorder;
      state.chunks = [];
      recorder.addEventListener("dataavailable", event => {
        if (event.data && event.data.size > 0) state.chunks.push(event.data);
      });
      recorder.addEventListener("stop", finishRecording, { once: true });
      recorder.start();
      setRecording(true);
      setStatus("Recording...");
    } catch (error) {
      stopStream();
      state.recorder = null;
      setRecording(false);
      setStatus(error && error.message ? error.message : "Recording failed.");
    }
  }

  async function finishRecording() {
    const mimeType = state.recorder?.mimeType || getPreferredMimeType() || "audio/webm";
    const blob = new Blob(state.chunks, { type: mimeType });
    const extension = extensionFromMimeType(mimeType);
    const fileName = "audio-recording-" + new Date().toISOString().replace(/[:.]/g, "-") + "." + extension;
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
      kind: "audio",
      resourceKind: "audio",
      fileName: state.result.fileName,
      mimeType: state.result.mimeType,
      dataUrl: state.result.dataUrl,
      previewUrl: state.result.dataUrl,
      title: "Audio Recorder output"
    }];
  };

  els.refresh.addEventListener("click", () => void refreshDevices());
  els.start.addEventListener("click", () => void startRecording());
  els.stop.addEventListener("click", stopRecording);
  setRecording(false);
  void refreshDevices();
})();
