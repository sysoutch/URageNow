export const palettes = {
  ruins: { ground: "#2f3328", path: "#56513e", block: "#8f7d5a", top: "#c7b98b", accent: "#e0c86b", void: "#11160f" },
  forest: { ground: "#173325", path: "#26583c", block: "#42b883", top: "#91f0b8", accent: "#d7f99a", void: "#07140f" },
  lava: { ground: "#35211e", path: "#59302a", block: "#e1593f", top: "#ffb86b", accent: "#ffe08a", void: "#160908" }
};

export const state = {
  mode: "topdown-flat",
  projection: "orthographic",
  seed: 1337,
  width: 24,
  depth: 18,
  density: 42,
  height: 4,
  pathWidth: 3,
  gap: 3,
  yaw: 38,
  pitch: 42,
  zoom: 82,
  mirrorPattern: "none",
  mirrorRepeatX: 0,
  mirrorRepeatY: 0,
  propDensity: 18,
  palette: "ruins",
  map: []
};

export function readNumber(id, fallback) {
  const node = document.getElementById(id);
  const value = Number(node && node.value);
  return Number.isFinite(value) ? value : fallback;
}

export function syncStateFromControls() {
  state.seed = Math.max(1, Math.floor(readNumber("seedInput", state.seed)));
  state.width = Math.max(6, Math.floor(readNumber("widthInput", state.width)));
  state.depth = Math.max(6, Math.floor(readNumber("depthInput", state.depth)));
  state.density = Math.max(0, Math.min(100, readNumber("densityInput", state.density)));
  state.height = Math.max(1, Math.min(8, readNumber("heightInput", state.height)));
  state.pathWidth = Math.max(1, Math.floor(readNumber("pathWidthInput", state.pathWidth)));
  state.gap = Math.max(1, Math.floor(readNumber("gapInput", state.gap)));
  state.yaw = readNumber("yawInput", state.yaw);
  state.pitch = readNumber("pitchInput", state.pitch);
  state.zoom = readNumber("zoomInput", state.zoom);
  const mirrorPatternNode = document.getElementById("mirrorPatternInput");
  state.mirrorPattern = mirrorPatternNode ? mirrorPatternNode.value : "none";
  state.mirrorRepeatX = Math.max(0, Math.floor(readNumber("mirrorRepeatXInput", state.mirrorRepeatX)));
  state.mirrorRepeatY = Math.max(0, Math.floor(readNumber("mirrorRepeatYInput", state.mirrorRepeatY)));
  state.propDensity = Math.max(0, Math.min(100, readNumber("propDensityInput", state.propDensity)));
}
