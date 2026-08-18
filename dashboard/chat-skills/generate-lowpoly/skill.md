---
outputKind: model
inputMode: model-only
supportsMultiple: true
allowedFollowUps: generate-autorig,regenerate-model-filename
routerHint: Use only when uploaded 3D model files already exist and the user wants low poly, decimation, simplification, or optimization.
---

# Generate Lowpoly

Create a low poly version from an uploaded 3D model file.

## Inputs
- At least one uploaded 3D model from chat 3D model uploads.
- Optional target face count in the user prompt.

## Behavior
- Process all uploaded model files as input, one by one.
- If target faces are specified, use that value.
- Otherwise, allow automatic target face selection.
- Invoke Blender's installed LowPolyUV addon to generate the clustered palette and snap UV faces before export.

## Output
- Return a short completion summary for each generated low poly model including source file name, output file name, target face count, and model id.
- If no source model is uploaded, return a clear instruction to upload one.
