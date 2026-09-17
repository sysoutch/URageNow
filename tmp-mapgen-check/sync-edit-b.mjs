import fs from "node:fs";

const path = "c:/Files/URageNow/tools/dev/map-generator/2d/js/app/cross-view-sync.js";
const raw = fs.readFileSync(path, "latin1");
const crlfCount = (raw.match(/\r\n/g) || []).length;
const lfTotal = raw.split("\n").length - 1;
const eol = crlfCount > Math.floor(lfTotal / 2) ? "\r\n" : "\n";
let text = fs.readFileSync(path, "utf8");
if (eol === "\n") text = text.replace(/\r\n/g, "\n"); // normalize stray CRLF

function apply(oldLF, newLF, label) {
  const oldText = oldLF.replace(/\r?\n/g, eol);
  const newText = newLF.replace(/\r?\n/g, eol);
  const count = text.split(oldText).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly 1 match, found ${count}`);
  text = text.replace(oldText, newText);
  console.log("ok:", label);
}

apply(
`  function renderSnapshot(data) {
    window.currentMap = clone(data.map); window.currentItems = clone(data.items); window.currentPlayers = Array.isArray(data.players) ? data.players.slice() : [];
    var cols = Math.max.apply(Math, [1].concat(window.currentMap.map(function (row) { return row.length; })));
    var rows = Math.max(1, window.currentMap.length);
    var platform = window.getSpriteImage && window.getSpriteImage(window.getSpriteType("platform"));
    var hole = window.getSpriteImage && window.getSpriteImage(window.getSpriteType("hole"));
    if (!window.canvas || !window.ctx || !platform) return;
    var cell = Math.max(16, Math.min(64, Math.floor(760 / Math.max(cols, rows))));
    window.canvas.width = cols * cell; window.canvas.height = rows * cell; window.canvas.style.width = window.canvas.width + "px"; window.canvas.style.height = window.canvas.height + "px";
    window.setCanvasScale(); window.clearAndDrawBackground();
    for (var row = 0; row < rows; row++) for (var col = 0; col < cols; col++) {
      var tile = window.currentMap[row] && window.currentMap[row][col];
      var image = tile === "platform" ? platform : hole;
      if (image) window.ctx.drawImage(image, col * cell, row * cell, cell, cell);
      var itemId = window.currentItems[row] && window.currentItems[row][col];
      var itemType = itemId && window.getSpriteType && window.getSpriteType(itemId);
      var item = itemType && window.getSpriteImage(itemType);
      if (item) window.ctx.drawImage(item, col * cell, row * cell, cell, cell);
    }
    if (typeof window.updatePreviewStats === "function") window.updatePreviewStats();
  }`,
`  function renderSnapshot(data) {
    window.currentMap = clone(data.map);
    window.currentItems = clone(data.items);
    window.currentPlayers = Array.isArray(data.players) ? data.players.map(function (player) { return { col: player.col, row: player.row, variantIndex: player.variantIndex || 0 }; }) : [];
    if (typeof data.seed === "string" && data.seed) window.lastGenerationSeedLabel = data.seed;

    // Redraw through the normal topdown pipeline so both tabs render pixel-identically.
    if (!window.getSpriteType || !window.resizeCanvasForMap || typeof window.drawTopdownMapFromData !== "function") return;
    var cols = Math.max.apply(Math, [1].concat(window.currentMap.map(function (row) { return row.length; })));
    var rows = Math.max(1, window.currentMap.length);
    var platformImg = window.getSpriteImage(window.getSpriteType("platform"));
    if (!platformImg) return;
    var stepX = window.getDrawWidth(platformImg);
    var stepY = window.getDrawHeight(platformImg);
    resizeCanvasForMap(cols, rows, mapStartX, mapStartY, stepX, stepY, mapEndX, mapEndY);
    drawTopdownMapFromData(cols, rows, platformImg, window.getSpriteImage(window.getSpriteType("hole")), stepX, stepY);
    if (typeof window.updatePreviewStats === "function") window.updatePreviewStats();
  }`,
"renderSnapshot rewritten");

apply(
`  document.addEventListener("click", function (event) { if (event.target.closest("#generateMap button, #generateMapButtonDiv button")) publishing = true; }, true);
  var originalGenerate = window.generateMap;
  window.generateMap = function () { var result = originalGenerate.apply(this, arguments); if (publishing) { publishing = false; publish(); } return result; };`,
`  // Publish after every completed generation - manual clicks, the auto-generate loop and option-driven
  // regenerations all funnel through generateMap(), so both tabs stay on the same map.
  var originalGenerate = window.generateMap;
  window.generateMap = function () { var result = originalGenerate.apply(this, arguments); schedulePublish(); return result; };`,
"generateMap wrapper now always publishes");

fs.writeFileSync(path, text);
console.log("cross-view-sync.js: complete");
