function createDashboardDesktopToolDropzoneHelpers(input) {
  const query = typeof input.query === "function"
    ? input.query
    : selector => document.querySelector(selector);

  function useFilePath(filePath, pathInput, hiddenPathMessage) {
    pathInput.value = filePath;
    if (!filePath) return;
    if (!/[\\/]/.test(filePath)) {
      input.setStatus(hiddenPathMessage, "busy");
      return;
    }
    input.pinTool(filePath);
  }

  function bind() {
    const dropzone = query("[data-desktop-tool-dropzone]");
    const fileInput = query("[data-desktop-tool-file-input]");
    const pathInput = query("[data-desktop-tool-path-input]");
    const browseButton = query("[data-desktop-tool-browse]");
    const addPathButton = query("[data-desktop-tool-add-path]");
    if (!dropzone || !fileInput || !pathInput || !browseButton || !addPathButton) return false;

    browseButton.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => {
      useFilePath(
        input.getFilePath(fileInput.files?.[0]),
        pathInput,
        "Browser only exposed the file name. Paste the full path before launching."
      );
    });
    addPathButton.addEventListener("click", () => {
      try {
        input.pinTool(pathInput.value);
      } catch (error) {
        input.setStatus(error.message, "error");
      }
    });
    ["dragenter", "dragover"].forEach(type => {
      dropzone.addEventListener(type, event => {
        event.preventDefault();
        dropzone.classList.add("is-dragging");
      });
    });
    ["dragleave", "drop"].forEach(type => {
      dropzone.addEventListener(type, () => dropzone.classList.remove("is-dragging"));
    });
    dropzone.addEventListener("drop", event => {
      event.preventDefault();
      try {
        useFilePath(
          input.getFilePath(event.dataTransfer?.files?.[0]),
          pathInput,
          "Drop worked, but the browser hid the full path. Paste it into the path field."
        );
      } catch (error) {
        input.setStatus(error.message, "error");
      }
    });
    return true;
  }

  return {bind};
}
