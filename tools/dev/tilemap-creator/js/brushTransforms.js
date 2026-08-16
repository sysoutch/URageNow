export function normalizeBrushTiles(tiles, fallbackTile = 0) {
  const rows = Array.isArray(tiles) ? tiles.map(row => Array.isArray(row) ? row.map(tile => Number.isFinite(tile) ? tile : -1) : []) : [];
  return rows.length && rows[0] && rows[0].length ? rows : [[fallbackTile]];
}

export function flipBrushTiles(tiles, axis = "x") {
  const brush = normalizeBrushTiles(tiles);
  if (axis === "y") {
    return brush.slice().reverse().map(row => row.slice());
  }
  return brush.map(row => row.slice().reverse());
}

export function applyBrushMirror(tiles, options = {}) {
  let brush = normalizeBrushTiles(tiles);
  if (options.mirrorX) {
    brush = brush.map(row => row.concat(row.slice().reverse()));
  }
  if (options.mirrorY) {
    brush = brush.concat(brush.slice().reverse().map(row => row.slice()));
  }
  return brush;
}

export function getBrushSize(tiles) {
  const brush = normalizeBrushTiles(tiles);
  return { width: Math.max(1, ...brush.map(row => row.length)), height: Math.max(1, brush.length) };
}
