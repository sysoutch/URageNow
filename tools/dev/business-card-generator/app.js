(function startBusinessCardDesigner() {
  "use strict";

  const canvas = new fabric.Canvas("card", {
    preserveObjectStacking: true,
    selection: true
  });
  const cardSides = {front: null, back: null};
  let currentSide = "front";

  canvas.setDimensions({width: 1000, height: 650});
  canvas.backgroundColor = "#ffffff";
  canvas.renderAll();

  function saveCurrentSide() {
    cardSides[currentSide] = JSON.stringify(canvas.toJSON());
  }

  function finishSideLoad() {
    canvas.renderAll();
    saveCurrentSide();
  }

  function loadSide(side) {
    if (side === currentSide) return;
    saveCurrentSide();
    currentSide = side;
    document.getElementById("sideTitle").textContent = side === "front" ? "Front Side" : "Back Side";
    canvas.clear();
    if (!cardSides[side]) {
      canvas.backgroundColor = "#ffffff";
      finishSideLoad();
      return;
    }
    canvas.loadFromJSON(cardSides[side], finishSideLoad);
  }

  function addText() {
    const text = new fabric.Textbox("Your Name", {
      left: 100,
      top: 100,
      width: 400,
      fontSize: 60,
      fill: "#000000",
      fontFamily: "Arial"
    });
    canvas.add(text);
    canvas.setActiveObject(text);
    canvas.renderAll();
  }

  function addUploadedImage(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.addEventListener("load", event => {
      fabric.Image.fromURL(event.target.result, image => {
        image.scaleToWidth(250);
        image.set({left: 100, top: 250});
        canvas.add(image);
        canvas.setActiveObject(image);
        canvas.renderAll();
      });
    });
    reader.readAsDataURL(file);
  }

  function addQrCode() {
    const holder = document.createElement("div");
    new QRCode(holder, {
      text: "https://example.com",
      width: 200,
      height: 200
    });
    window.setTimeout(() => {
      const qrOutput = holder.querySelector("img, canvas");
      const source = qrOutput?.src || qrOutput?.toDataURL?.("image/png");
      if (!source) return;
      fabric.Image.fromURL(source, qr => {
        qr.set({left: 700, top: 350, scaleX: 0.5, scaleY: 0.5});
        canvas.add(qr);
        canvas.setActiveObject(qr);
        canvas.renderAll();
      });
    }, 0);
  }

  function deleteSelectedObject() {
    const activeObjects = canvas.getActiveObjects();
    activeObjects.forEach(object => canvas.remove(object));
    canvas.discardActiveObject();
    canvas.renderAll();
  }

  function clearCard() {
    canvas.clear();
    canvas.backgroundColor = "#ffffff";
    canvas.renderAll();
    saveCurrentSide();
  }

  function createBackground(type, color1, color2) {
    if (type === "solid") return color1;
    const isRadial = type === "radial";
    return new fabric.Gradient({
      type: isRadial ? "radial" : "linear",
      coords: isRadial
        ? {x1: canvas.width / 2, y1: canvas.height / 2, r1: 0, x2: canvas.width / 2, y2: canvas.height / 2, r2: canvas.width}
        : {x1: 0, y1: 0, x2: canvas.width, y2: canvas.height},
      colorStops: [
        {offset: 0, color: color1},
        {offset: 1, color: color2}
      ]
    });
  }

  function applyBackground() {
    const type = document.getElementById("bgType").value;
    const color1 = document.getElementById("bgColor1").value;
    const color2 = document.getElementById("bgColor2").value;
    canvas.backgroundColor = createBackground(type, color1, color2);
    canvas.renderAll();
    saveCurrentSide();
  }

  function exportPng() {
    saveCurrentSide();
    const link = document.createElement("a");
    link.download = `business-card-${currentSide}.png`;
    link.href = canvas.toDataURL({format: "png", multiplier: 2});
    link.click();
  }

  document.getElementById("show-front-button").addEventListener("click", () => loadSide("front"));
  document.getElementById("show-back-button").addEventListener("click", () => loadSide("back"));
  document.getElementById("add-text-button").addEventListener("click", addText);
  document.getElementById("add-logo-button").addEventListener("click", () => document.getElementById("upload").click());
  document.getElementById("upload").addEventListener("change", event => {
    addUploadedImage(event.target.files?.[0]);
    event.target.value = "";
  });
  document.getElementById("add-qr-button").addEventListener("click", addQrCode);
  document.getElementById("delete-object-button").addEventListener("click", deleteSelectedObject);
  document.getElementById("clear-card-button").addEventListener("click", clearCard);
  document.getElementById("apply-background-button").addEventListener("click", applyBackground);
  document.getElementById("export-png-button").addEventListener("click", exportPng);
  saveCurrentSide();
}());
