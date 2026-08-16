function createDashboardImageTransferHelpers(input) {
  const filesToAiImages = typeof input?.filesToAiImages === "function" ? input.filesToAiImages : async () => [];
  const parseImageTextInputs = typeof input?.parseImageTextInputs === "function" ? input.parseImageTextInputs : () => [];
  const setOutput = typeof input?.setOutput === "function" ? input.setOutput : function setOutputFallback() {};

  async function collectPastedImages(event, mergeImages, successLabel) {
    const files = [];
    const clipboardItems = Array.from((event.clipboardData && event.clipboardData.items) || []);
    for (const item of clipboardItems) {
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file && (file.type || "").startsWith("image/")) {
          files.push(file);
        }
      }
    }
    if (files.length > 0) {
      event.preventDefault();
      mergeImages(await filesToAiImages(files));
      setOutput(successLabel + " attached " + files.length + " pasted image" + (files.length === 1 ? "." : "s."));
      return true;
    }
    const text = event.clipboardData ? event.clipboardData.getData("text/plain") : "";
    const parsedTextEntries = parseImageTextInputs(text);
    if (parsedTextEntries.length > 0) {
      event.preventDefault();
      mergeImages(parsedTextEntries);
      setOutput(successLabel + " attached " + parsedTextEntries.length + " image reference" + (parsedTextEntries.length === 1 ? "." : "s."));
      return true;
    }
    return false;
  }

  async function collectDroppedImages(event, zoneId, mergeImages, successLabel) {
    event.preventDefault();
    const zone = document.getElementById(zoneId);
    if (zone) {
      zone.classList.remove("dragging");
    }
    const files = Array.from((event.dataTransfer && event.dataTransfer.files) || []).filter(file => (file.type || "").startsWith("image/"));
    if (files.length > 0) {
      mergeImages(await filesToAiImages(files));
      setOutput(successLabel + " attached " + files.length + " dropped image" + (files.length === 1 ? "." : "s."));
    }
    const text = event.dataTransfer ? (event.dataTransfer.getData("text/plain") || event.dataTransfer.getData("text/uri-list")) : "";
    const parsedTextEntries = parseImageTextInputs(text);
    if (parsedTextEntries.length > 0) {
      mergeImages(parsedTextEntries);
      setOutput(successLabel + " attached " + parsedTextEntries.length + " dropped image reference" + (parsedTextEntries.length === 1 ? "." : "s."));
    }
  }

  return {
    collectPastedImages,
    collectDroppedImages
  };
}
