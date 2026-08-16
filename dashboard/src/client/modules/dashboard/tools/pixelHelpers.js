function createDashboardToolsPixelHelpers() {
  const state = {
    imageName: "pixel-art",
    sourceLoaded: false
  };
  function clampValue(value, min, max, fallback) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      return fallback;
    }
    return Math.min(max, Math.max(min, Math.round(numericValue)));
  }
  function setStatus(text) {
    const node = document.getElementById("tools-pixel-status");
    if (node) {
      node.textContent = text;
    }
  }
  function updateSliderReadouts() {
    const pixelSlider = document.getElementById("tools-pixel-size-slider");
    const colorStepsSlider = document.getElementById("tools-pixel-color-steps-slider");
    const pixelValue = clampValue(pixelSlider ? pixelSlider.value : 10, 2, 64, 10);
    const colorStepsValue = clampValue(colorStepsSlider ? colorStepsSlider.value : 12, 2, 64, 12);
    if (pixelSlider) {
      pixelSlider.value = String(pixelValue);
    }
    if (colorStepsSlider) {
      colorStepsSlider.value = String(colorStepsValue);
    }
    const pixelValueNode = document.getElementById("tools-pixel-size-value");
    if (pixelValueNode) {
      pixelValueNode.textContent = String(pixelValue);
    }
    const colorStepsValueNode = document.getElementById("tools-pixel-color-steps-value");
    if (colorStepsValueNode) {
      colorStepsValueNode.textContent = String(colorStepsValue);
    }
    return { pixelSize: pixelValue, colorSteps: colorStepsValue };
  }
  function getCanvases() {
    const sourceCanvas = document.getElementById("tools-pixel-source-canvas");
    const resultCanvas = document.getElementById("tools-pixel-result-canvas");
    return { sourceCanvas, resultCanvas };
  }
  function shouldAutoConvert() {
    const autoConvertToggle = document.getElementById("tools-pixel-auto-convert-toggle");
    return !autoConvertToggle || autoConvertToggle.checked;
  }
  function render() {
    const { sourceCanvas, resultCanvas } = getCanvases();
    if (!sourceCanvas || !resultCanvas) {
      return;
    }
    if (!state.sourceLoaded || sourceCanvas.width < 1 || sourceCanvas.height < 1) {
      setStatus("Load a source image to begin.");
      return;
    }
    const { pixelSize, colorSteps } = updateSliderReadouts();
    const preserveAlphaToggle = document.getElementById("tools-pixel-preserve-alpha-toggle");
    const preserveAlpha = !!(preserveAlphaToggle && preserveAlphaToggle.checked);
    const sampleWidth = Math.max(1, Math.round(sourceCanvas.width / pixelSize));
    const sampleHeight = Math.max(1, Math.round(sourceCanvas.height / pixelSize));
    const sampleCanvas = document.createElement("canvas");
    sampleCanvas.width = sampleWidth;
    sampleCanvas.height = sampleHeight;
    const sampleContext = sampleCanvas.getContext("2d");
    const sourceContext = sourceCanvas.getContext("2d");
    if (!sampleContext || !sourceContext) {
      setStatus("Unable to initialize the pixel converter canvas context.");
      return;
    }
    sampleContext.clearRect(0, 0, sampleWidth, sampleHeight);
    sampleContext.imageSmoothingEnabled = true;
    sampleContext.drawImage(sourceCanvas, 0, 0, sampleWidth, sampleHeight);
    const imageData = sampleContext.getImageData(0, 0, sampleWidth, sampleHeight);
    const channelStep = 255 / Math.max(1, colorSteps - 1);
    for (let index = 0; index < imageData.data.length; index += 4) {
      imageData.data[index] = Math.round(imageData.data[index] / channelStep) * channelStep;
      imageData.data[index + 1] = Math.round(imageData.data[index + 1] / channelStep) * channelStep;
      imageData.data[index + 2] = Math.round(imageData.data[index + 2] / channelStep) * channelStep;
      if (!preserveAlpha) {
        imageData.data[index + 3] = 255;
      }
    }
    sampleContext.putImageData(imageData, 0, 0);
    resultCanvas.width = sampleWidth * pixelSize;
    resultCanvas.height = sampleHeight * pixelSize;
    const resultContext = resultCanvas.getContext("2d");
    if (!resultContext) {
      setStatus("Unable to initialize the output canvas context.");
      return;
    }
    resultContext.clearRect(0, 0, resultCanvas.width, resultCanvas.height);
    resultContext.imageSmoothingEnabled = false;
    resultContext.drawImage(sampleCanvas, 0, 0, sampleWidth, sampleHeight, 0, 0, resultCanvas.width, resultCanvas.height);
    setStatus(
      "Converted " + sourceCanvas.width + "x" + sourceCanvas.height + " to " + resultCanvas.width + "x" + resultCanvas.height
      + " using " + pixelSize + "px blocks and " + colorSteps + " color steps."
    );
  }
  function maybeAutoConvert() {
    if (shouldAutoConvert() && state.sourceLoaded) {
      render();
    }
  }
  async function loadSourceFile(file) {
    const { sourceCanvas, resultCanvas } = getCanvases();
    if (!sourceCanvas || !resultCanvas) {
      return;
    }
    if (!file) {
      setStatus("Load a source image to begin.");
      return;
    }
    const fileName = String(file.name || "pixel-art").trim() || "pixel-art";
    state.imageName = fileName.replace(/\.[^.]+$/, "") || "pixel-art";
    const objectUrl = URL.createObjectURL(file);
    const image = await new Promise((resolve, reject) => {
      const imageNode = new Image();
      imageNode.onload = () => resolve(imageNode);
      imageNode.onerror = () => reject(new Error("Failed to load selected image."));
      imageNode.src = objectUrl;
    }).finally(() => {
      URL.revokeObjectURL(objectUrl);
    });
    const naturalWidth = Math.max(1, Number(image.naturalWidth) || 1);
    const naturalHeight = Math.max(1, Number(image.naturalHeight) || 1);
    const maxSide = 1600;
    const scale = Math.min(1, maxSide / Math.max(naturalWidth, naturalHeight));
    const targetWidth = Math.max(1, Math.round(naturalWidth * scale));
    const targetHeight = Math.max(1, Math.round(naturalHeight * scale));
    sourceCanvas.width = targetWidth;
    sourceCanvas.height = targetHeight;
    const sourceContext = sourceCanvas.getContext("2d");
    if (!sourceContext) {
      throw new Error("Unable to initialize source canvas context.");
    }
    sourceContext.clearRect(0, 0, targetWidth, targetHeight);
    sourceContext.imageSmoothingEnabled = true;
    sourceContext.drawImage(image, 0, 0, targetWidth, targetHeight);
    resultCanvas.width = 0;
    resultCanvas.height = 0;
    state.sourceLoaded = true;
    setStatus("Loaded source image " + targetWidth + "x" + targetHeight + ". Adjust settings and convert.");
    if (shouldAutoConvert()) {
      render();
    }
  }
  function downloadResult() {
    const resultCanvas = document.getElementById("tools-pixel-result-canvas");
    if (!resultCanvas || resultCanvas.width < 1 || resultCanvas.height < 1) {
      setStatus("Convert an image before downloading.");
      return;
    }
    resultCanvas.toBlob(blob => {
      if (!blob) {
        setStatus("Failed to build PNG export.");
        return;
      }
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = state.imageName + "-pixel.png";
      link.click();
      setTimeout(() => {
        URL.revokeObjectURL(downloadUrl);
      }, 250);
      setStatus("Downloaded " + link.download + ".");
    }, "image/png");
  }
  function reset() {
    const { sourceCanvas, resultCanvas } = getCanvases();
    if (sourceCanvas) {
      sourceCanvas.width = 0;
      sourceCanvas.height = 0;
    }
    if (resultCanvas) {
      resultCanvas.width = 0;
      resultCanvas.height = 0;
    }
    const fileInput = document.getElementById("tools-pixel-file-input");
    if (fileInput) {
      fileInput.value = "";
    }
    const pixelSlider = document.getElementById("tools-pixel-size-slider");
    if (pixelSlider) {
      pixelSlider.value = "10";
    }
    const colorStepsSlider = document.getElementById("tools-pixel-color-steps-slider");
    if (colorStepsSlider) {
      colorStepsSlider.value = "12";
    }
    state.imageName = "pixel-art";
    state.sourceLoaded = false;
    updateSliderReadouts();
    setStatus("Tool reset. Load a source image to begin.");
  }
  return {
    updateSliderReadouts,
    render,
    maybeAutoConvert,
    loadSourceFile,
    downloadResult,
    reset
  };
}
