function createDashboardMediaArtifactHelpers(input) {
  function getModel3dFileUrl(modelId, fileName) {
    return "/api/model3d-file?modelId=" + encodeURIComponent(modelId) + "&file=" + encodeURIComponent(fileName);
  }
  function getGeneratedImageFileUrl(imageId, fileName) {
    return "/api/generated-image-file?imageId=" + encodeURIComponent(imageId) + "&file=" + encodeURIComponent(fileName);
  }
  function getGeneratedAudioFileUrl(audioId, fileName) {
    return "/api/generated-audio-file?audioId=" + encodeURIComponent(audioId) + "&file=" + encodeURIComponent(fileName);
  }
  function getGeneratedVideoFileUrl(videoId, fileName) {
    return "/api/generated-video-file?videoId=" + encodeURIComponent(videoId) + "&file=" + encodeURIComponent(fileName);
  }
  function buildAbsoluteDashboardUrl(value) {
    const source = String(value || "").trim();
    if (!source) {
      return "";
    }
    try {
      return new URL(source, window.location.origin).toString();
    } catch {
      return source;
    }
  }
  function downloadModel3dArtifact(modelId, fileName, label) {
    if (!fileName) {
      return;
    }
    const downloadUrl = getModel3dFileUrl(modelId, fileName);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = fileName || ("model-" + modelId + ".glb");
    document.body.appendChild(link);
    link.click();
    link.remove();
    const noun = String(label || "model file");
    input.setModel3dStatus("Downloading " + fileName + "...");
    input.setOutput("Downloading " + noun + " " + fileName + ".");
  }
  return {
    getModel3dFileUrl,
    getGeneratedImageFileUrl,
    getGeneratedAudioFileUrl,
    getGeneratedVideoFileUrl,
    buildAbsoluteDashboardUrl,
    downloadModel3dArtifact
  };
}
