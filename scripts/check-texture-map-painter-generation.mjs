import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {
  populateHeightFromAlbedo,
  populateNormalFromHeight,
  populateRoughnessFromAlbedo
} from "../tools/art/texture_map_painter/textureMapGeneration.js";

const size = 3;
const albedo = new Uint8ClampedArray(size * size * 4);
for (let y = 0; y < size; y += 1) {
  for (let x = 0; x < size; x += 1) {
    const index = (y * size + x) * 4;
    const value = x === 0 ? 0 : 255;
    albedo[index] = value;
    albedo[index + 1] = value;
    albedo[index + 2] = value;
    albedo[index + 3] = 255;
  }
}

const height = new Uint8ClampedArray(size * size);
const roughness = new Uint8ClampedArray(size * size);
const normal = new Uint8ClampedArray(size * size * 4);
populateHeightFromAlbedo(albedo, height);
populateRoughnessFromAlbedo(albedo, roughness);
populateNormalFromHeight(height, normal, size, 3);

assert.equal(height[0], 0);
assert.equal(height[1], 255);
assert.equal(roughness[0], 255);
assert.equal(roughness[1], 0);
assert.notEqual(normal[(1 * size + 1) * 4], 128, "An albedo height edge must produce a non-flat normal.");
assert.equal(normal[(1 * size + 1) * 4 + 3], 255);

const toolHtml = await readFile(
  new URL("../tools/art/texture_map_painter/index.html", import.meta.url),
  "utf8"
);
assert.match(toolHtml, /function generateDerivedMapsFromAlbedo\(\)\s*\{[\s\S]*generateHeightFromAlbedo\(\);[\s\S]*generateNormal\(\);/);
assert.match(toolHtml, /alwaysGenerateDerivedMaps:\s*true/);
assert.match(toolHtml, /applyImportedAlbedoImageData\(ctx\.getImageData/);

console.log("Texture Map Painter derived-map generation validation passed.");
