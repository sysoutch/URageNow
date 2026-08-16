---
outputKind: model
inputMode: model-only
supportsMultiple: true
routerHint: Use when generated 3D model artifacts already exist and the user wants Rigify autorigging, skeleton creation, bones, armature binding, or animation-ready rigs.
---

# Generate AutoRig

Create a Rigify-rigged version from a generated 3D model artifact.

## Inputs
- At least one generated 3D model artifact with a model id.

## Behavior
- Process all generated model artifacts as input, one by one.
- Let AutoRig classify the model and choose the supported Rigify profile automatically.
- Bind the mesh to the generated Rigify armature and return the rigged model artifact.

## Output
- Return a short completion summary for each generated rigged model including source file name, output file name, and model id.
- If no generated source model is available, return a clear instruction to generate or select a model first.
