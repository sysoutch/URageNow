function createDashboardSpeechSourceHelpers(input) {
  const state = input?.state || {};
  const recordedSources = input?.recordedSources instanceof Map ? input.recordedSources : new Map();
  function inferMimeType(file) {
    const typed = String(file?.type || "").trim();
    if (typed) return typed;
    const extension = String(file?.name || "").split(".").pop().toLowerCase();
    if (extension === "mp3") return "audio/mpeg";
    if (extension === "wav") return "audio/wav";
    if (extension === "ogg" || extension === "oga") return "audio/ogg";
    if (extension === "flac") return "audio/flac";
    if (extension === "m4a" || extension === "aac") return "audio/mp4";
    if (extension === "mp4" || extension === "m4v") return "video/mp4";
    if (extension === "mov") return "video/quicktime";
    return "audio/webm";
  }
  async function readSpeechDataUrl(file) {
    const dataUrl = String(await input.readFileAsDataUrl(file) || "").trim();
    const match = dataUrl.match(/^data:([^,]*),(.*)$/i);
    if (!match) throw new Error("A valid audio or video data URL is required.");
    const headerParts = String(match[1] || "").trim().split(";").map(part => part.trim()).filter(Boolean);
    const payload = String(match[2] || "").trim();
    const mimeType = headerParts.find(part => !part.includes("=") && part.toLowerCase() !== "base64") || inferMimeType(file);
    if (!payload) throw new Error("Recorded audio is empty. Try recording again for a little longer.");
    if (headerParts.some(part => part.toLowerCase() === "base64")) return "data:" + mimeType + ";base64," + payload;
    return "data:" + mimeType + ";base64," + btoa(unescape(encodeURIComponent(decodeURIComponent(payload))));
  }
  function getStorageKey(file) {
    return file ? [file.name || "speech-input", file.size || 0, file.lastModified || 0].join("|") : "";
  }
  async function importSourceFile(file, prompt) {
    const key = getStorageKey(file);
    if (key && recordedSources.has(key)) return recordedSources.get(key);
    const savedSource = await input.request("/api/audio-import-source", { audioDataUrl: await readSpeechDataUrl(file), fileName: file.name || "speech-input", prompt: prompt || "Speech source audio" });
    if (key && savedSource?.id) recordedSources.set(key, savedSource);
    return savedSource;
  }
  async function handleRecordedFile(details) {
    const prefix = String(details?.prefix || "").trim();
    const file = details?.file;
    if (!file || !prefix.startsWith("speech-")) return;
    const statusNode = document.getElementById(prefix + "-mic-status");
    try {
      if (statusNode) statusNode.textContent = "Saving " + (file.name || "recording") + " to disk...";
      const savedSource = await importSourceFile(file, prefix === "speech-stt" ? "STT microphone recording" : "Speech microphone recording");
      if (!savedSource?.id) return;
      await input.loadAudioHistory(savedSource.id, state.selectedGeneratedMusicId);
      if (statusNode) statusNode.textContent = "Saved " + savedSource.audioFileName + " to generated audio.";
      input.setOutput("Saved microphone recording to disk: " + savedSource.audioFileName + ".");
    } catch (error) {
      const detail = error?.message || "Unknown error";
      if (statusNode) statusNode.textContent = "Recording save failed: " + detail;
      input.setOutput("Recording save failed: " + detail);
    }
  }
  return { readSpeechDataUrl, importSourceFile, handleRecordedFile };
}
