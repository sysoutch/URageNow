import fs from "node:fs";

const ROOT = "c:/Files/URageNow/tools/dev/map-generator";

function editFile(path, pairs) {
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
    console.log("ok:", label || "(unnamed)");
  }
  fs.writeFileSync(path, text);
}

editFile(`${ROOT}/3d/js/renderer.js`, [
  [
`  if (config.showSprites !== false && (config.spriteLayers || []).length) {
    (config.spriteLayers || []).forEach(layer => { const sprite = createSpriteBillboard(layer, config); if (sprite) root.add(sprite); });
  }`,
`  let spriteBillboards = 0;
  if (config.showSprites !== false && (config.spriteLayers || []).length) {
    (config.spriteLayers || []).forEach(layer => { const sprite = createSpriteBillboard(layer, config); if (sprite) { root.add(sprite); spriteBillboards++; } });
  }
  // Expose live counts so tooling can verify what the scene actually contains.
  root.userData.spriteCount = spriteBillboards;`,
    "renderer: count actual billboards in mapRoot"
  ],
  [
`export function setupScrollZoom(canvas) {`,
`// Live contents of the current map scene (used by debug/verification tooling).
export function getSceneStats() {
  const root = rendererState.mapRoot;
  return root ? { sprites: root.userData.spriteCount || 0, nodes: root.children.length } : null;
}

export function setupScrollZoom(canvas) {`,
    "renderer: export getSceneStats"
  ]
]);

editFile(`${ROOT}/3d/js/app.js`, [
  [
`import { exportRendererPng, renderMap, setupScrollZoom } from "./renderer.js";`,
`import { exportRendererPng, getSceneStats, renderMap, setupScrollZoom } from "./renderer.js";`,
    "app: import getSceneStats"
  ],
  [
`// Debug/verification accessor (used by automated checks).
window.__urageDebugScene = () => ({
  tiles: (state.map || []).flat().filter(Boolean).length,
  spriteLayers: (state.spriteLayers || []).length,
  mode: state.mode,
  showSprites: state.showSprites !== false
});`,
`// Debug/verification accessor (used by automated checks). Reports what the live scene
// actually contains when available, falling back to pending state before first render.
window.__urageDebugScene = () => {
  const scene = getSceneStats();
  return { tiles: (state.map || []).flat().filter(Boolean).length, spriteLayers: scene ? scene.sprites : (state.spriteLayers || []).length, mode: state.mode, showSprites: state.showSprites !== false };
};`,
    "app: debug accessor now reports live scene"
  ]
]);

console.log("scene-stats edits applied");
