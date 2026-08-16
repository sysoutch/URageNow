function loadImageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load image."));
    image.src = url;
  });
}

export async function loadTilesetImagesFromFiles(files) {
  const results = [];
  for (const file of files) {
    const url = URL.createObjectURL(file);
    try {
      const image = await loadImageFromUrl(url);
      results.push({ file, image, url });
    } catch (error) {
      URL.revokeObjectURL(url);
      throw new Error("Could not load " + file.name + ".");
    }
  }
  return results;
}

function drawContainedImage(ctx, image, x, y, size) {
  const safeWidth = Math.max(1, image.width || size);
  const safeHeight = Math.max(1, image.height || size);
  const scale = Math.min(size / safeWidth, size / safeHeight);
  const drawWidth = Math.max(1, Math.round(safeWidth * scale));
  const drawHeight = Math.max(1, Math.round(safeHeight * scale));
  const offsetX = x + Math.floor((size - drawWidth) / 2);
  const offsetY = y + Math.floor((size - drawHeight) / 2);
  ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
}

export async function composeTilesetFromImages(files, tileSize) {
  const uploads = await loadTilesetImagesFromFiles(files);
  const columns = Math.max(1, Math.ceil(Math.sqrt(uploads.length)));
  const rows = Math.max(1, Math.ceil(uploads.length / columns));
  const canvas = document.createElement("canvas");
  canvas.width = columns * tileSize;
  canvas.height = rows * tileSize;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = true;
  uploads.forEach((entry, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    drawContainedImage(ctx, entry.image, col * tileSize, row * tileSize, tileSize);
  });
  uploads.forEach(entry => URL.revokeObjectURL(entry.url));
  const url = canvas.toDataURL("image/png");
  const image = await loadImageFromUrl(url);
  return {
    image,
    url,
    label: files.length === 1 ? files[0].name : "Combined Tileset (" + files.length + " sprites)"
  };
}
