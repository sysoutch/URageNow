# Normal Map Generator

Browser-based tool for creating tangent-space normal maps from image textures, sprites, height maps, alpha masks, or batches of source images.

## Features

- Load one or more image textures.
- Generate each source separately or blend sources into one normal map.
- Choose height source from luminance, alpha, red, green, blue, max RGB, or min RGB.
- Tune strength, Z depth, blur, Sobel/Scharr/central gradient kernels, tiling, and X/Y inversion.
- Preview generated normals in the browser and export production PNG output.

## Workflow

1. Upload source textures.
2. Pick height source and normal-generation settings.
3. Preview the result and adjust strength, blur, and inversion.
4. Export the normal map PNG for a material, sprite, or 3D workflow.

## Notes

The tool runs client-side and follows dashboard theme tokens when launched inside the dashboard tool workspace.
