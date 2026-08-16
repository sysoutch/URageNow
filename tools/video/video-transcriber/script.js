const els = {
  serverUrl: document.getElementById("serverUrl"),
  outputNodeId: document.getElementById("outputNodeId"),
  audioInputNodeId: document.getElementById("audioInputNodeId"),
  audioInputField: document.getElementById("audioInputField"),
  workflowJson: document.getElementById("workflowJson"),
  dropzone: document.getElementById("dropzone"),
  fileInput: document.getElementById("fileInput"),
  fileLabel: document.getElementById("fileLabel"),
  extractAudioBtn: document.getElementById("extractAudioBtn"),
  transcribeBtn: document.getElementById("transcribeBtn"),
  downloadAudioBtn: document.getElementById("downloadAudioBtn"),
  copyBtn: document.getElementById("copyBtn"),
  downloadTxtBtn: document.getElementById("downloadTxtBtn"),
  progress: document.getElementById("progress"),
  log: document.getElementById("log"),
  transcript: document.getElementById("transcript")
};

let selectedFile = null;
let extractedAudioBlob = null;
let extractedAudioName = "audio.wav";
let extractedAudioObjectUrl = "";
const clientId = crypto.randomUUID();

function log(message, type = "") {
  const prefix = type === "error" ? "[error]" : type === "ok" ? "[ok]" : "[info]";
  els.log.textContent += `\n${prefix} ${message}`;
  els.log.scrollTop = els.log.scrollHeight;
}

function resetLog(message = "Idle.") { els.log.textContent = message; }
function setProgress(value) { els.progress.value = Math.max(0, Math.min(100, value)); }
function normalizeServerUrl() { return els.serverUrl.value.trim().replace(/\/$/, ""); }

function setFile(file) {
  selectedFile = file;
  extractedAudioBlob = null;
  if (extractedAudioObjectUrl) URL.revokeObjectURL(extractedAudioObjectUrl);
  extractedAudioObjectUrl = "";
  els.fileLabel.textContent = file ? `${file.name} (${formatBytes(file.size)})` : "No file selected";
  els.extractAudioBtn.disabled = !file;
  els.transcribeBtn.disabled = !file;
  els.downloadAudioBtn.disabled = true;
  els.copyBtn.disabled = true;
  els.downloadTxtBtn.disabled = true;
  els.transcript.value = "";
  setProgress(0);
  resetLog(file ? `Selected: ${file.name}` : "Idle.");
}

function formatBytes(bytes) {
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit++; }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

async function extractAudio(file) {
  if (extractedAudioBlob) {
    log(`Using already extracted audio: ${extractedAudioName}`, "ok");
    return extractedAudioBlob;
  }

  if (!window.AudioContext && !window.webkitAudioContext) {
    throw new Error("This browser does not support AudioContext. Use a current Chromium, Firefox, or Safari build.");
  }

  setProgress(8);
  log("Tool step: reading MP4 file locally.");
  const arrayBuffer = await file.arrayBuffer();

  setProgress(22);
  log("Tool step: decoding MP4 audio using the browser. No ComfyUI involvement yet.");
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const audioContext = new AudioContextClass();
  const decodedBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
  await audioContext.close();

  setProgress(55);
  log("Tool step: converting decoded audio to mono 16 kHz WAV.");
  const wavBuffer = audioBufferToMonoWav(decodedBuffer, 16000);
  extractedAudioName = safeFileName(file.name || "input.mp4").replace(/\.[^.]+$/, "") + ".wav";
  extractedAudioBlob = new Blob([wavBuffer], { type: "audio/wav" });
  extractedAudioObjectUrl = URL.createObjectURL(extractedAudioBlob);
  els.downloadAudioBtn.disabled = false;

  setProgress(100);
  log(`Audio extracted: ${extractedAudioName} (${formatBytes(extractedAudioBlob.size)})`, "ok");
  return extractedAudioBlob;
}

function audioBufferToMonoWav(audioBuffer, targetSampleRate = 16000) {
  const numberOfChannels = audioBuffer.numberOfChannels;
  const sourceSampleRate = audioBuffer.sampleRate;
  const sourceLength = audioBuffer.length;
  const targetLength = Math.max(1, Math.round(sourceLength * targetSampleRate / sourceSampleRate));
  const mono = new Float32Array(targetLength);

  for (let i = 0; i < targetLength; i++) {
    const sourcePos = i * sourceSampleRate / targetSampleRate;
    const i0 = Math.floor(sourcePos);
    const i1 = Math.min(i0 + 1, sourceLength - 1);
    const frac = sourcePos - i0;
    let sample = 0;

    for (let ch = 0; ch < numberOfChannels; ch++) {
      const data = audioBuffer.getChannelData(ch);
      sample += data[i0] * (1 - frac) + data[i1] * frac;
    }
    mono[i] = sample / numberOfChannels;
  }

  return encodeWavPCM16(mono, targetSampleRate);
}

function encodeWavPCM16(samples, sampleRate) {
  const bytesPerSample = 2;
  const channels = 1;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * bytesPerSample, true);
  view.setUint16(32, channels * bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (const sample of samples) {
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }
  return buffer;
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i));
}

function safeFileName(name) { return name.replace(/[^a-z0-9._-]+/gi, "_"); }

async function uploadAudioToComfy(audioBlob) {
  const server = normalizeServerUrl();
  const form = new FormData();
  form.append("image", audioBlob, extractedAudioName);
  form.append("type", "input");
  form.append("overwrite", "true");

  setProgress(10);
  log("Uploading extracted WAV to ComfyUI /upload/image. The endpoint name is ridiculous, but it is ComfyUI-compatible.");
  const res = await fetch(`${server}/upload/image`, { method: "POST", body: form });
  if (!res.ok) throw new Error(`Upload failed: HTTP ${res.status} ${await res.text()}`);
  const json = await res.json();
  const uploadedName = json.name || extractedAudioName;
  setProgress(35);
  log(`Uploaded to ComfyUI as: ${uploadedName}`, "ok");
  return uploadedName;
}

function buildPrompt(uploadedAudioName) {
  let workflow;
  try { workflow = JSON.parse(els.workflowJson.value); }
  catch (err) { throw new Error(`Workflow JSON is invalid: ${err.message}`); }

  const nodeId = els.audioInputNodeId.value.trim();
  const field = els.audioInputField.value.trim();
  if (!workflow[nodeId]) throw new Error(`Workflow does not contain audio input node ID ${nodeId}.`);
  if (!workflow[nodeId].inputs) workflow[nodeId].inputs = {};
  workflow[nodeId].inputs[field] = uploadedAudioName;

  return JSON.parse(JSON.stringify(workflow).replaceAll("__AUDIO_FILENAME__", uploadedAudioName));
}

async function queuePrompt(prompt) {
  const server = normalizeServerUrl();
  log("Queueing ComfyUI transcription workflow.");
  const res = await fetch(`${server}/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, client_id: clientId })
  });
  if (!res.ok) throw new Error(`Prompt failed: HTTP ${res.status} ${await res.text()}`);
  const json = await res.json();
  if (!json.prompt_id) throw new Error("ComfyUI did not return a prompt_id.");
  setProgress(52);
  log(`Prompt queued: ${json.prompt_id}`, "ok");
  return json.prompt_id;
}

async function pollHistory(promptId) {
  const server = normalizeServerUrl();
  log("Polling ComfyUI history for result.");
  const startedAt = Date.now();
  const timeoutMs = 30 * 60 * 1000;

  while (Date.now() - startedAt < timeoutMs) {
    const res = await fetch(`${server}/history/${promptId}`);
    if (!res.ok) throw new Error(`History poll failed: HTTP ${res.status}`);
    const history = await res.json();
    if (history[promptId]) {
      setProgress(82);
      log("ComfyUI job completed.", "ok");
      return history[promptId];
    }
    await sleep(1500);
  }
  throw new Error("Timed out waiting for ComfyUI result.");
}

async function extractTranscriptFromHistory(item) {
  const outputNodeId = els.outputNodeId.value.trim();
  const outputs = item.outputs || {};
  const output = outputs[outputNodeId];
  if (!output) {
    const available = Object.keys(outputs).join(", ") || "none";
    throw new Error(`No output found for node ${outputNodeId}. Available output nodes: ${available}`);
  }

  const directText = findTextDeep(output);
  if (directText) return directText;

  const fileRef = findTextFileRef(output);
  if (fileRef) return await fetchComfyTextFile(fileRef);

  throw new Error("Could not find transcript text in the selected ComfyUI output node.");
}

function findTextDeep(value) {
  if (typeof value === "string" && value.trim()) return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findTextDeep(item);
      if (found) return found;
    }
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      if (["text", "transcript", "result", "caption", "output"].includes(key.toLowerCase())) {
        const found = findTextDeep(item);
        if (found) return found;
      }
    }
  }
  return "";
}

function findTextFileRef(value) {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findTextFileRef(item);
      if (found) return found;
    }
  }
  if (value && typeof value === "object") {
    const filename = value.filename || value.name;
    if (filename && /\.(txt|json|srt|vtt)$/i.test(filename)) {
      return { filename, subfolder: value.subfolder || "", type: value.type || "output" };
    }
    for (const item of Object.values(value)) {
      const found = findTextFileRef(item);
      if (found) return found;
    }
  }
  return null;
}

async function fetchComfyTextFile(fileRef) {
  const server = normalizeServerUrl();
  const params = new URLSearchParams({
    filename: fileRef.filename,
    subfolder: fileRef.subfolder || "",
    type: fileRef.type || "output"
  });
  const res = await fetch(`${server}/view?${params.toString()}`);
  if (!res.ok) throw new Error(`Could not fetch transcript file: HTTP ${res.status}`);
  return await res.text();
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

els.dropzone.addEventListener("click", () => els.fileInput.click());
els.fileInput.addEventListener("change", event => {
  const file = event.target.files?.[0];
  if (file) validateAndSetFile(file);
});

["dragenter", "dragover"].forEach(name => {
  els.dropzone.addEventListener(name, event => {
    event.preventDefault();
    els.dropzone.classList.add("dragover");
  });
});

["dragleave", "drop"].forEach(name => {
  els.dropzone.addEventListener(name, event => {
    event.preventDefault();
    els.dropzone.classList.remove("dragover");
  });
});

els.dropzone.addEventListener("drop", event => {
  const file = event.dataTransfer.files?.[0];
  if (file) validateAndSetFile(file);
});

function validateAndSetFile(file) {
  if (!file.type.includes("mp4") && !/\.mp4$/i.test(file.name)) {
    resetLog("Please select an MP4 file. This tool is intentionally narrow.");
    return;
  }
  setFile(file);
}

els.extractAudioBtn.addEventListener("click", async () => {
  if (!selectedFile) return;
  els.extractAudioBtn.disabled = true;
  resetLog("Starting audio extraction.");
  setProgress(1);
  try {
    await extractAudio(selectedFile);
    log("Audio is ready. Download button is active.", "ok");
  } catch (err) {
    log(err.message || String(err), "error");
    console.error(err);
  } finally {
    els.extractAudioBtn.disabled = false;
  }
});

els.transcribeBtn.addEventListener("click", async () => {
  if (!selectedFile) return;
  els.extractAudioBtn.disabled = true;
  els.transcribeBtn.disabled = true;
  els.copyBtn.disabled = true;
  els.downloadTxtBtn.disabled = true;
  els.transcript.value = "";
  resetLog("Starting extraction and transcription.");
  setProgress(1);

  try {
    const audio = await extractAudio(selectedFile);
    setProgress(5);
    const uploadedAudioName = await uploadAudioToComfy(audio);
    const prompt = buildPrompt(uploadedAudioName);
    const promptId = await queuePrompt(prompt);
    const historyItem = await pollHistory(promptId);
    const transcript = await extractTranscriptFromHistory(historyItem);

    els.transcript.value = transcript.trim();
    els.copyBtn.disabled = !els.transcript.value;
    els.downloadTxtBtn.disabled = !els.transcript.value;
    setProgress(100);
    log("Transcript ready.", "ok");
  } catch (err) {
    log(err.message || String(err), "error");
    console.error(err);
  } finally {
    els.extractAudioBtn.disabled = false;
    els.transcribeBtn.disabled = false;
  }
});

els.downloadAudioBtn.addEventListener("click", () => {
  if (extractedAudioBlob) downloadBlob(extractedAudioBlob, extractedAudioName);
});

els.copyBtn.addEventListener("click", async () => {
  await navigator.clipboard.writeText(els.transcript.value);
  log("Transcript copied to clipboard.", "ok");
});

els.downloadTxtBtn.addEventListener("click", () => {
  const blob = new Blob([els.transcript.value], { type: "text/plain;charset=utf-8" });
  downloadBlob(blob, "transcript.txt");
});

function describeCurrentAssets() {
  const assets = [];
  if (els.transcript.value.trim()) {
    assets.push({
      kind: "text",
      title: "Video transcript",
      fileName: "transcript.txt",
      mimeType: "text/plain",
      textContent: els.transcript.value.trim(),
      metadata: { sourceTool: "video-transcriber", resourceFormat: "transcript" }
    });
  }
  if (extractedAudioBlob) {
    assets.push({
      kind: "audio",
      title: "Extracted mono audio",
      fileName: extractedAudioName,
      mimeType: "audio/wav",
      sourceUrl: extractedAudioObjectUrl,
      metadata: { sourceTool: "video-transcriber", resourceFormat: "wav-16khz-mono" }
    });
  }
  return assets;
}

window.describeCurrentAssets = describeCurrentAssets;
window.__urageToolDescribeCurrentAssets = describeCurrentAssets;
window.__urageToolDescribeCurrentAsset = () => describeCurrentAssets()[0] || null;
