export async function imageToDataUrl(image) {
  if (!image || !image.width || !image.height) return "";
  try {
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = image.width;
    exportCanvas.height = image.height;
    const exportCtx = exportCanvas.getContext("2d");
    exportCtx.imageSmoothingEnabled = false;
    exportCtx.drawImage(image, 0, 0);
    return exportCanvas.toDataURL("image/png");
  } catch {
    return "";
  }
}

export function loadImageFromSource(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (/^https?:/i.test(source)) {
      image.crossOrigin = "anonymous";
    }
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image load failed."));
    image.src = source;
  });
}

export async function serializeTilesetsForExport(tilesets) {
  const serialized = [];
  for (const tileset of tilesets) {
    const sourceDataUrl = tileset.sourceDataUrl || await imageToDataUrl(tileset.image);
    serialized.push({
      name: tileset.label,
      tileSize: tileset.tileSize,
      columns: tileset.columns,
      rows: tileset.rows,
      tileCount: tileset.tileCount,
      firstTile: tileset.firstTile,
      image: tileset.label,
      sourceUrl: tileset.url || tileset.image.src || "",
      sourceDataUrl
    });
  }
  return serialized;
}

export function getTilesetEntriesFromPayload(payload) {
  if (!payload || typeof payload !== "object") return [];
  if (Array.isArray(payload.tilesets) && payload.tilesets.length) {
    return payload.tilesets.map(entry => ({
      name: String(entry && (entry.name || entry.image) || "Tileset").trim() || "Tileset",
      tileSize: Number(entry && (entry.tileSize || entry.tilewidth || entry.tileheight)) || 0,
      sourceUrl: String(entry && (entry.sourceUrl || entry.image || entry.url) || "").trim(),
      sourceDataUrl: String(entry && entry.sourceDataUrl || "").trim()
    })).filter(entry => entry.sourceDataUrl || entry.sourceUrl);
  }
  return [];
}

export async function restoreTilesetsFromPayload(entries, tileSize) {
  const restored = [];
  if (!Array.isArray(entries) || !entries.length) {
    return restored;
  }
  for (const entry of entries) {
    const source = String(entry && (entry.sourceDataUrl || entry.sourceUrl || entry.url || entry.image) || "").trim();
    if (!source) continue;
    try {
      const image = await loadImageFromSource(source);
      const sourceTileSize = Math.max(1, Math.round(Number(entry && (entry.tileSize || entry.tilewidth || entry.tileheight)) || tileSize));
      const columns = Math.max(1, Math.floor(image.width / sourceTileSize));
      const rows = Math.max(1, Math.floor(image.height / sourceTileSize));
      restored.push({
        image,
        label: String(entry && (entry.name || entry.image) || "Tileset").trim() || "Tileset",
        url: String(entry && (entry.sourceUrl || source) || source).trim(),
        sourceDataUrl: String(entry && entry.sourceDataUrl || "").trim(),
        tileSize: sourceTileSize,
        columns,
        rows,
        tileCount: columns * rows,
        firstTile: 0
      });
    } catch {}
  }
  return restored;
}
