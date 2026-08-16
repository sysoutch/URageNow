document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("qr-input");
  const sizeSlider = document.getElementById("size-slider");
  const fgColor = document.getElementById("fg-color");
  const gradientToggle = document.getElementById("gradient-toggle");
  const gradientStartColor = document.getElementById("gradient-start-color");
  const gradientEndColor = document.getElementById("gradient-end-color");
  const eyeColor = document.getElementById("eye-color");
  const bgColor = document.getElementById("bg-color");
  const borderColor = document.getElementById("border-color");
  const borderSize = document.getElementById("border-size");
  const logoFile = document.getElementById("logo-file");
  const logoSize = document.getElementById("logo-size");
  const logoX = document.getElementById("logo-x");
  const logoY = document.getElementById("logo-y");
  const logoBorderColor = document.getElementById("logo-border-color");
  const logoBorderSize = document.getElementById("logo-border-size");
  const preview = document.getElementById("qr-preview");
  const downloadBtn = document.getElementById("download-btn");
  const displayBySlider = new Map([
    [sizeSlider, document.getElementById("size-display")],
    [borderSize, document.getElementById("border-display")],
    [logoSize, document.getElementById("logo-size-display")],
    [logoX, document.getElementById("logo-x-display")],
    [logoY, document.getElementById("logo-y-display")],
    [logoBorderSize, document.getElementById("logo-border-display")]
  ]);
  let qrInstance = null;
  let uploadedImage = null;
  let uploadedImageName = "";

  function getNumber(node) {
    return Number.parseInt(node.value, 10) || 0;
  }

  function hexToRgb(hex) {
    const value = String(hex || "").replace("#", "");
    return value.length === 6
      ? [Number.parseInt(value.slice(0, 2), 16), Number.parseInt(value.slice(2, 4), 16), Number.parseInt(value.slice(4, 6), 16)]
      : [0, 0, 0];
  }

  function recolorFinderEye(context, x, y, size, background, color) {
    const imageData = context.getImageData(x, y, size, size);
    for (let index = 0; index < imageData.data.length; index += 4) {
      const isBackground = imageData.data[index] === background[0]
        && imageData.data[index + 1] === background[1]
        && imageData.data[index + 2] === background[2];
      if (isBackground) {
        continue;
      }
      imageData.data[index] = color[0];
      imageData.data[index + 1] = color[1];
      imageData.data[index + 2] = color[2];
    }
    context.putImageData(imageData, x, y);
  }

  function applyModuleGradient(context, width, height, background) {
    if (!gradientToggle.checked) return;
    const start = hexToRgb(gradientStartColor.value);
    const end = hexToRgb(gradientEndColor.value);
    const imageData = context.getImageData(0, 0, width, height);
    for (let index = 0; index < imageData.data.length; index += 4) {
      const isBackground = imageData.data[index] === background[0] && imageData.data[index + 1] === background[1] && imageData.data[index + 2] === background[2];
      if (isBackground) continue;
      const pixel = index / 4;
      const ratio = ((pixel % width) / Math.max(1, width - 1) + Math.floor(pixel / width) / Math.max(1, height - 1)) / 2;
      imageData.data[index] = Math.round(start[0] + (end[0] - start[0]) * ratio);
      imageData.data[index + 1] = Math.round(start[1] + (end[1] - start[1]) * ratio);
      imageData.data[index + 2] = Math.round(start[2] + (end[2] - start[2]) * ratio);
    }
    context.putImageData(imageData, 0, 0);
  }

  function drawUploadedImage(context, qrSize, border) {
    if (!uploadedImage) {
      return;
    }
    const frameSize = Math.round(qrSize * getNumber(logoSize) / 100);
    const frameBorder = getNumber(logoBorderSize);
    const maxImageSize = Math.max(1, frameSize - frameBorder * 2);
    const imageScale = Math.min(maxImageSize / uploadedImage.width, maxImageSize / uploadedImage.height);
    const imageWidth = Math.max(1, Math.round(uploadedImage.width * imageScale));
    const imageHeight = Math.max(1, Math.round(uploadedImage.height * imageScale));
    const frameX = border + Math.round((qrSize - frameSize) * getNumber(logoX) / 100);
    const frameY = border + Math.round((qrSize - frameSize) * getNumber(logoY) / 100);
    context.fillStyle = logoBorderColor.value;
    context.fillRect(frameX, frameY, frameSize, frameSize);
    context.drawImage(uploadedImage, frameX + Math.round((frameSize - imageWidth) / 2), frameY + Math.round((frameSize - imageHeight) / 2), imageWidth, imageHeight);
  }

  function composeQrCanvas(qrCanvas) {
    const qrSize = getNumber(sizeSlider);
    const border = getNumber(borderSize);
    const qrLayer = document.createElement("canvas");
    qrLayer.width = qrSize;
    qrLayer.height = qrSize;
    const qrContext = qrLayer.getContext("2d", {willReadFrequently: true});
    qrContext.drawImage(qrCanvas, 0, 0, qrSize, qrSize);
    applyModuleGradient(qrContext, qrSize, qrSize, hexToRgb(bgColor.value));
    const moduleCount = qrInstance?._oQRCode?.getModuleCount?.() || 0;
    if (moduleCount > 0 && eyeColor.value.toLowerCase() !== fgColor.value.toLowerCase()) {
      const eyeSize = Math.ceil(qrSize * 7 / moduleCount);
      const bottomEyeY = Math.round(qrSize * (moduleCount - 7) / moduleCount);
      const background = hexToRgb(bgColor.value);
      const color = hexToRgb(eyeColor.value);
      recolorFinderEye(qrContext, 0, 0, eyeSize, background, color);
      recolorFinderEye(qrContext, Math.round(qrSize * (moduleCount - 7) / moduleCount), 0, eyeSize, background, color);
      recolorFinderEye(qrContext, 0, bottomEyeY, eyeSize, background, color);
    }
    const output = document.createElement("canvas");
    output.width = qrSize + border * 2;
    output.height = qrSize + border * 2;
    const outputContext = output.getContext("2d");
    outputContext.fillStyle = borderColor.value;
    outputContext.fillRect(0, 0, output.width, output.height);
    outputContext.drawImage(qrLayer, border, border);
    drawUploadedImage(outputContext, qrSize, border);
    return output;
  }

  function buildCurrentQrDescriptor() {
    const canvas = preview.querySelector("canvas");
    const encodedText = input.value.trim();
    if (!canvas || !encodedText) {
      return null;
    }
    const dataUrl = canvas.toDataURL("image/png");
    return {
      kind: "image",
      title: "QR Code",
      fileName: "qr-code.png",
      mimeType: "image/png",
      dataUrl,
      width: canvas.width,
      height: canvas.height,
      previewKind: "image",
      previewUrl: dataUrl,
      metadata: {
        inferenceSource: "qr-code-creator",
        encodedText,
        size: getNumber(sizeSlider),
        foregroundColor: fgColor.value,
        eyeColor: eyeColor.value,
        borderColor: borderColor.value,
        borderSize: getNumber(borderSize),
        imageName: uploadedImageName || null,
        imagePosition: uploadedImage ? {x: getNumber(logoX), y: getNumber(logoY)} : null
      }
    };
  }

  function generateQR() {
    const text = input.value.trim();
    if (!text) {
      preview.innerHTML = '<span class="placeholder-text">Enter content to generate QR code</span>';
      downloadBtn.disabled = true;
      qrInstance = null;
      return;
    }
    preview.replaceChildren();
    const staging = document.createElement("div");
    preview.appendChild(staging);
    const size = getNumber(sizeSlider);
    qrInstance = new QRCode(staging, {
      text,
      width: size,
      height: size,
      colorDark: fgColor.value,
      colorLight: bgColor.value,
      correctLevel: QRCode.CorrectLevel.H
    });
    window.requestAnimationFrame(() => {
      const qrCanvas = staging.querySelector("canvas");
      if (!qrCanvas) {
        return;
      }
      preview.replaceChildren(composeQrCanvas(qrCanvas));
      downloadBtn.disabled = false;
    });
  }

  function debounce(fn, delay) {
    let timer = 0;
    return (...args) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => fn(...args), delay);
    };
  }

  async function loadImage(file) {
    if (!file || !file.type.startsWith("image/")) {
      uploadedImage = null;
      uploadedImageName = "";
      generateQR();
      return;
    }
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error("Image file could not be read."));
      reader.readAsDataURL(file);
    });
    const image = new Image();
    image.onload = () => {
      uploadedImage = image;
      uploadedImageName = file.name;
      generateQR();
    };
    image.src = String(dataUrl);
  }

  input.addEventListener("input", debounce(generateQR, 300));
  displayBySlider.forEach((display, slider) => {
    slider.addEventListener("input", () => {
      display.textContent = slider.value;
      generateQR();
    });
  });
  [fgColor, eyeColor, bgColor, borderColor, logoBorderColor, gradientStartColor, gradientEndColor].forEach(node => node.addEventListener("input", generateQR));
  gradientToggle.addEventListener("change", generateQR);
  logoFile.addEventListener("change", () => {
    void loadImage(logoFile.files?.[0] || null);
  });
  document.getElementById("generate-btn").addEventListener("click", () => {
    if (input.value.trim()) {
      generateQR();
      return;
    }
    input.focus();
  });
  downloadBtn.addEventListener("click", () => {
    const canvas = preview.querySelector("canvas");
    if (!canvas) {
      return;
    }
    const link = document.createElement("a");
    link.download = `qrcode_${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  });

  if (typeof window.registerDashboardToolBridge === "function") {
    window.registerDashboardToolBridge({onDescribeCurrentAsset: buildCurrentQrDescriptor});
  } else {
    window.__urageToolDescribeCurrentAsset = buildCurrentQrDescriptor;
  }
});
