export function createToolState() {
  return {
    sourceBitmap: null,
    sourceFileName: "",
    sourceInfo: null,
    originalCanvas: document.createElement("canvas"),
    originalContext: null,
    processedCanvas: document.createElement("canvas"),
    processedContext: null,
    originalPixels: null,
    maxAlphaInImage: 255,
    renderQueued: false,
    processing: false
  };
}

export function getDomElements() {
  const upload = document.getElementById("upload");
  return {
    upload,
    dropZone: document.getElementById("dropZone") || document.getElementById("transparency-upload-wrapper") || upload?.closest("label"),
    canvas: document.getElementById("canvas"),
    opacityRange: document.getElementById("opacityRange"),
    opacityValue: document.getElementById("opacityValue"),
    alphaThreshold: document.getElementById("alphaThreshold"),
    alphaThresholdValue: document.getElementById("alphaThresholdValue"),
    cleanupMode: document.getElementById("cleanupMode"),
    replacementColor: document.getElementById("replacementColor"),
    replacementColorField: document.getElementById("replacementColorField"),
    imageInfo: document.getElementById("imageInfo"),
    status: document.getElementById("toolStatus"),
    downloadBtn: document.getElementById("download")
  };
}
