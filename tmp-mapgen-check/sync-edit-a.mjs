import fs from "node:fs";

// Applies LF-authored replacements to a file while preserving its actual line endings.
export function editFile(path, pairs) {
  const raw = fs.readFileSync(path, "latin1");
  const crlfCount = (raw.match(/\r\n/g) || []).length;
  const lfTotal = raw.split("\n").length - 1;
  const eol = crlfCount > Math.floor(lfTotal / 2) ? "\r\n" : "\n";
  let text = fs.readFileSync(path, "utf8");
  if (eol === "\n") text = text.replace(/\r\n/g, "\n"); // normalize stray CRLF
  for (const [oldLF, newLF, label] of pairs) {
    const oldText = oldLF.replace(/\r?\n/g, eol);
    const newText = newLF.replace(/\r?\n/g, eol);
    const count = text.split(oldText).length - 1;
    if (count !== 1) throw new Error(`${label}: expected exactly 1 match, found ${count}`);
    text = text.replace(oldText, newText);
    console.log("ok:", label);
  }
  fs.writeFileSync(path, text);
}

editFile("c:/Files/URageNow/tools/dev/map-generator/2d/js/app/cross-view-sync.js", [
  [
    `(function () {
  var publishing = false;
  function clone(grid) {`,
    `(function () {
  // =========================================================
  // CROSS-VIEW MAP SYNC (2D SIDE)
  // =========================================================
  // Keeps the 2D and 3D tabs sharing one generated map: every completed generation publishes
  // grid + sprites to the shell, which relays it into the other view. When the 3D tab publishes
  // its own blockout, this canvas is redrawn from that data using the normal topdown pipeline.

  function clone(grid) {`
  ],
  [
    `  function spriteSources() {
    return (window.spriteTypes || []).map(function (type) { var image = document.getElementById(type.imageId); return { id: type.id, src: image && image.src || "" }; }).filter(function (sprite) { return sprite.src; });
  }`,
    `  // Embed a self-contained copy of each sprite so the 3D view can always load it - even when
  // cross-origin rules (e.g. file://) would taint its WebGL canvas. Returns null when the image
  // cannot be read, in which case receivers fall back to the plain URL.
  function imageData(image) {
    try {
      var width = image && (image.naturalWidth || image.width);
      var height = image && (image.naturalHeight || image.height);
      if (!image || !image.src || !width || !height) return null;
      var scratch = document.createElement("canvas");
      scratch.width = width;
      scratch.height = height;
      var context = scratch.getContext("2d", { willReadFrequently: true });
      context.drawImage(image, 0, 0);
      return scratch.toDataURL("image/png");
    } catch (error) {
      return null;
    }
  }

  function spriteSources() {
    var sources = [];
    (window.spriteTypes || []).forEach(function (type) {
      var image = document.getElementById(type.imageId);
      if (!image || !image.src) return;
      sources.push({ id: type.id, src: image.src, dataUrl: imageData(image) });
    });
    return sources;
  }

  function playerSpriteSources() {
    var marker = window.playerMarkerConfig;
    if (!marker || !Array.isArray(marker.variantImageIds)) return [];
    return marker.variantImageIds.map(function (imageId) {
      var image = document.getElementById(imageId);
      return { src: (image && image.src) || "", dataUrl: imageData(image) };
    }).filter(function (sprite) { return sprite.src; });
  }`
  ],
  [
    `  function snapshot() {
    return { version: 1, mode: window.generatorMode || "topdown", seed: window.lastGenerationSeedLabel || "random", map: clone(window.currentMap), items: clone(window.currentItems), players: (window.currentPlayers || []).map(function (player) { return { col: player.col, row: player.row, variantIndex: player.variantIndex || 0 }; }), sprites: spriteSources(), playerSprite: (window.playerMarkerConfig && document.getElementById(window.playerMarkerConfig.imageId) || {}).src || "" };
  }
  function publish() { window.parent.postMessage({ type: "urage-map-generator-snapshot", source: "2d", snapshot: snapshot() }, "*"); }`,
    `  function snapshot() {
    return { version: 2, mode: window.generatorMode || "topdown", seed: window.lastGenerationSeedLabel || "random", map: clone(window.currentMap), items: clone(window.currentItems), players: (window.currentPlayers || []).map(function (player) { return { col: player.col, row: player.row, variantIndex: player.variantIndex || 0 }; }), sprites: spriteSources(), playerSprites: playerSpriteSources(), playerSprite: (window.playerMarkerConfig && document.getElementById(window.playerMarkerConfig.imageId) || {}).src || "" };
  }

  var publishTimer = null;
  function publish() { window.parent.postMessage({ type: "urage-map-generator-snapshot", source: "2d", snapshot: snapshot() }, "*"); }
  // Debounced so the auto-generate loop does not flood the shell with snapshots.
  function schedulePublish() { if (publishTimer) clearTimeout(publishTimer); publishTimer = setTimeout(function () { publishTimer = null; publish(); }, 120); }`
  ]
]);

console.log("cross-view-sync.js: header/sprites/publish updated");
