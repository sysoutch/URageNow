# Pseudo Albedo Tools

This package contains:

1. `index.html` - a standalone HTML5 browser tool that converts a normal map or height map into a stylized pseudo-albedo PNG.
2. `albedo_from_geometry_addon.py` - a Blender add-on that can generate pseudo-albedo from:
   - a normal map image
   - a height map image
   - a UV-mapped high-poly mesh

## Important limitation

A true albedo map cannot be recovered from a normal map, height map, or mesh alone. Albedo is material color, while normals/heights/geometry describe shape. These tools generate a plausible stylized base-color texture using slope, height, and directional detail. This is useful for quick material blocking, procedural asset work, and texture prototyping, not physically accurate scanning.

## Browser tool

Open `index.html` in any modern browser. No server is needed.

Workflow:
1. Load a normal map or height map.
2. Choose source type.
3. Adjust strength, contrast, softness, and ramp colors.
4. Download the generated PNG.

## Dashboard integration

The browser tool is discovered automatically from `tools/art/albedo-tools/index.html`.

- It inherits the active dashboard colors through `dashboard-theme.js`.
- The controls panel is marked as `Albedo Controls`.
- `dashboard-tool-bridge.js` allows Image Studio and the Tools workspace to inject a source map through the normal file input.
- The generated PNG is exposed through `describeCurrentAssets()` for the dashboard Send Resource flow.
- The shared current-output fallback remains loaded for compatibility.

## Blender add-on install

1. In Blender, go to `Edit > Preferences > Add-ons`.
2. Click `Install...`.
3. Select `albedo_from_geometry_addon.py`.
4. Enable `Pseudo Albedo From Maps or Highpoly`.
5. Open the 3D View sidebar and use the `Pseudo Albedo` tab.

## High-poly mesh mode

Requirements:
- The active object must be a mesh.
- The mesh must have UVs.
- The add-on rasterizes geometry into UV space and generates color from interpolated normals and height.

For best results, unwrap the high-poly object first. Overlapping UVs will overwrite each other, because pixels are not mind readers.
