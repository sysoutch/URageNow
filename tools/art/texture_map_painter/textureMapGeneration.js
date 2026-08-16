export function populateHeightFromAlbedo(albedoRGBA, heightMap) {
  const pixelCount = Math.min(heightMap.length, Math.floor(albedoRGBA.length / 4));
  for (let index = 0; index < pixelCount; index += 1) {
    const rgbaIndex = index * 4;
    const luminance = (
      0.299 * albedoRGBA[rgbaIndex]
      + 0.587 * albedoRGBA[rgbaIndex + 1]
      + 0.114 * albedoRGBA[rgbaIndex + 2]
    );
    heightMap[index] = Math.round(luminance);
  }
}

export function populateRoughnessFromAlbedo(albedoRGBA, roughness) {
  const pixelCount = Math.min(roughness.length, Math.floor(albedoRGBA.length / 4));
  for (let index = 0; index < pixelCount; index += 1) {
    const rgbaIndex = index * 4;
    const luminance = (
      0.299 * albedoRGBA[rgbaIndex]
      + 0.587 * albedoRGBA[rgbaIndex + 1]
      + 0.114 * albedoRGBA[rgbaIndex + 2]
    );
    roughness[index] = Math.round(255 - luminance);
  }
}

export function populateNormalFromHeight(heightMap, normalRGBA, size, strength) {
  const safeSize = Math.max(1, Math.floor(Number(size) || 1));
  const safeStrength = Number.isFinite(Number(strength)) ? Number(strength) : 1;
  const indexOf = (x, y) => y * safeSize + x;
  for (let y = 0; y < safeSize; y += 1) {
    for (let x = 0; x < safeSize; x += 1) {
      const xm = Math.max(0, x - 1);
      const xp = Math.min(safeSize - 1, x + 1);
      const ym = Math.max(0, y - 1);
      const yp = Math.min(safeSize - 1, y + 1);
      const dx = (heightMap[indexOf(xp, y)] - heightMap[indexOf(xm, y)]) / 255 * safeStrength;
      const dy = (heightMap[indexOf(x, yp)] - heightMap[indexOf(x, ym)]) / 255 * safeStrength;
      let nx = -dx;
      let ny = -dy;
      let nz = 1;
      const length = Math.hypot(nx, ny, nz) || 1;
      nx /= length;
      ny /= length;
      nz /= length;
      const rgbaIndex = indexOf(x, y) * 4;
      normalRGBA[rgbaIndex] = Math.round((nx * 0.5 + 0.5) * 255);
      normalRGBA[rgbaIndex + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      normalRGBA[rgbaIndex + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      normalRGBA[rgbaIndex + 3] = 255;
    }
  }
}
