# Texture Map Painter

Paint and preview a compact material texture set containing albedo, height, tangent-space normal, roughness, and smoothness maps.

## Image imports

- **Import Albedo + Maps** always treats the selected image as a complete albedo source and immediately rebuilds height, normal, roughness, and smoothness.
- **Import Source Image** and preview drag/drop replace the albedo source but only rebuild derived maps while **Generate Maps From Image** is enabled.
- Changing Normal Strength regenerates the normal map from the current height data during the next refresh.

The derived-map math lives in `textureMapGeneration.js` so luminance, roughness inversion, and height-to-normal conversion can be tested independently of Three.js and browser rendering.

## Dashboard integration

The tool uses the shared dashboard theme and current-output descriptor. Each visible map is exposed as a PNG resource through the dashboard Send Resource workflow.
