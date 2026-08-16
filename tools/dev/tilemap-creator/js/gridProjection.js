export const GRID_MODES = ["orthogonal", "isometric"];

export function normalizeGridMode(mode) {
  return GRID_MODES.includes(mode) ? mode : "orthogonal";
}

export function gridModeLabel(mode) {
  return normalizeGridMode(mode) === "isometric" ? "isometric" : "orthogonal";
}

function isoMetrics(width, height, tileSize) {
  const halfWidth = tileSize / 2;
  const halfHeight = Math.max(1, tileSize / 4);
  return {
    halfWidth,
    halfHeight,
    footprintHeight: halfHeight * 2,
    originX: Math.max(0, height - 1) * halfWidth,
    originY: tileSize / 2
  };
}

export function mapPixelSize(width, height, tileSize, mode) {
  if (normalizeGridMode(mode) !== "isometric") return { width: width * tileSize, height: height * tileSize };
  const metrics = isoMetrics(width, height, tileSize);
  return {
    width: Math.max(tileSize, (width + height) * metrics.halfWidth),
    height: Math.max(tileSize, metrics.originY + (width + height) * metrics.halfHeight)
  };
}

export function tileDrawRect(cellX, cellY, mapWidth, mapHeight, tileSize, sourceSize, mode) {
  if (normalizeGridMode(mode) !== "isometric") {
    return { x: cellX * tileSize, y: cellY * tileSize, width: sourceSize, height: sourceSize };
  }
  const metrics = isoMetrics(mapWidth, mapHeight, tileSize);
  const span = Math.max(1, sourceSize / Math.max(1, tileSize));
  const footprintWidth = tileSize * span;
  const footprintHeight = metrics.footprintHeight * span;
  const x = (cellX - cellY) * metrics.halfWidth + metrics.originX;
  const y = (cellX + cellY) * metrics.halfHeight + metrics.originY;
  return {
    x: x + (footprintWidth - sourceSize) / 2,
    y: y + footprintHeight - sourceSize,
    width: sourceSize,
    height: sourceSize
  };
}

export function cellPolygon(cellX, cellY, mapWidth, mapHeight, tileSize, mode) {
  if (normalizeGridMode(mode) !== "isometric") {
    const x = cellX * tileSize;
    const y = cellY * tileSize;
    return [
      { x, y },
      { x: x + tileSize, y },
      { x: x + tileSize, y: y + tileSize },
      { x, y: y + tileSize }
    ];
  }
  const metrics = isoMetrics(mapWidth, mapHeight, tileSize);
  const x = (cellX - cellY) * metrics.halfWidth + metrics.originX;
  const y = (cellX + cellY) * metrics.halfHeight + metrics.originY;
  return [
    { x: x + metrics.halfWidth, y },
    { x: x + tileSize, y: y + metrics.halfHeight },
    { x: x + metrics.halfWidth, y: y + metrics.footprintHeight },
    { x, y: y + metrics.halfHeight }
  ];
}

export function gridNodePoint(nodeX, nodeY, mapWidth, mapHeight, tileSize, mode) {
  if (normalizeGridMode(mode) !== "isometric") return { x: nodeX * tileSize, y: nodeY * tileSize };
  const metrics = isoMetrics(mapWidth, mapHeight, tileSize);
  return {
    x: (nodeX - nodeY) * metrics.halfWidth + metrics.originX + metrics.halfWidth,
    y: (nodeX + nodeY) * metrics.halfHeight + metrics.originY
  };
}

export function traceCellPath(ctx, cellX, cellY, mapWidth, mapHeight, tileSize, mode) {
  const points = cellPolygon(cellX, cellY, mapWidth, mapHeight, tileSize, mode);
  ctx.beginPath();
  points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
  ctx.closePath();
}

function pointInIsoCell(point, cellX, cellY, mapWidth, mapHeight, tileSize) {
  const metrics = isoMetrics(mapWidth, mapHeight, tileSize);
  const x = (cellX - cellY) * metrics.halfWidth + metrics.originX;
  const y = (cellX + cellY) * metrics.halfHeight + metrics.originY;
  const centerX = x + metrics.halfWidth;
  const centerY = y + metrics.halfHeight;
  return Math.abs((point.x - centerX) / metrics.halfWidth) + Math.abs((point.y - centerY) / metrics.halfHeight) <= 1;
}

export function pointToCell(point, mapWidth, mapHeight, tileSize, mode) {
  if (normalizeGridMode(mode) !== "isometric") return { x: Math.floor(point.x / tileSize), y: Math.floor(point.y / tileSize) };
  const metrics = isoMetrics(mapWidth, mapHeight, tileSize);
  const projectedX = (point.x - metrics.originX - metrics.halfWidth) / metrics.halfWidth;
  const projectedY = (point.y - metrics.originY - metrics.halfHeight) / metrics.halfHeight;
  const baseX = Math.floor((projectedX + projectedY) / 2);
  const baseY = Math.floor((projectedY - projectedX) / 2);
  const candidates = [];
  for (let y = baseY - 2; y <= baseY + 2; y++) {
    for (let x = baseX - 2; x <= baseX + 2; x++) {
      if (x < 0 || y < 0 || x >= mapWidth || y >= mapHeight) continue;
      if (pointInIsoCell(point, x, y, mapWidth, mapHeight, tileSize)) candidates.push({ x, y });
    }
  }
  if (!candidates.length) return { x: baseX, y: baseY };
  candidates.sort((a, b) => (a.x + a.y) - (b.x + b.y));
  return candidates[candidates.length - 1];
}

export function drawOrderCells(width, height, mode) {
  const cells = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) cells.push({ x, y });
  }
  if (normalizeGridMode(mode) !== "isometric") return cells;
  return cells.sort((a, b) => (a.x + a.y) - (b.x + b.y) || a.y - b.y || a.x - b.x);
}
