export const PAINT_SOURCE_MODES = ["stamp", "random", "forward", "reverse", "pingpong", "noise"];

export function normalizePaintSourceMode(mode) {
  return PAINT_SOURCE_MODES.includes(mode) ? mode : "stamp";
}

function collectUniqueTile(unique, tile) {
  if (Number.isFinite(tile) && tile >= 0 && !unique.includes(tile)) unique.push(tile);
}

export function selectedPaintTiles(brush, fallbackTile = 0) {
  const unique = [];
  const rows = Array.isArray(brush) ? brush : [];
  rows.forEach(row => {
    if (Array.isArray(row)) {
      row.forEach(tile => collectUniqueTile(unique, tile));
      return;
    }
    collectUniqueTile(unique, row);
  });
  collectUniqueTile(unique, fallbackTile);
  return unique;
}

function hashCell(x, y) {
  let hash = ((x + 4099) * 73856093) ^ ((y + 131) * 19349663);
  hash ^= hash >>> 13;
  return Math.abs(hash);
}

function sequenceIndex(mode, index, count) {
  if (mode === "reverse") return count - 1 - (index % count);
  if (mode === "pingpong") {
    if (count <= 1) return 0;
    const span = count * 2 - 2;
    const step = index % span;
    return step < count ? step : span - step;
  }
  return index % count;
}

export function pickPaintTile(options) {
  const tiles = selectedPaintTiles(options.tiles, options.fallbackTile);
  const count = tiles.length;
  const mode = normalizePaintSourceMode(options.mode);
  const sequence = Math.max(0, Number(options.sequenceIndex) || 0);
  if (!count) return { tile: -1, sequenceIndex: sequence };
  if (mode === "random") return { tile: tiles[Math.floor(Math.random() * count)], sequenceIndex: sequence + 1 };
  if (mode === "noise") return { tile: tiles[hashCell(options.x || 0, options.y || 0) % count], sequenceIndex: sequence };
  if (mode === "forward" || mode === "reverse" || mode === "pingpong") return { tile: tiles[sequenceIndex(mode, sequence, count)], sequenceIndex: sequence + 1 };
  return { tile: tiles[0], sequenceIndex: sequence };
}

export function paintOptionsLabel(mode) {
  const labels = {
    stamp: "stamp",
    random: "random",
    forward: "forward",
    reverse: "reverse",
    pingpong: "ping-pong",
    noise: "cell noise"
  };
  return labels[normalizePaintSourceMode(mode)];
}
