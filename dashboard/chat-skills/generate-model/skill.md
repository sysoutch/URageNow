---
outputKind: model
inputMode: image-or-text
supportsMultiple: true
allowedFollowUps: generate-autorig,generate-lowpoly,regenerate-model-filename
routerHint: Use for direct 3D model generation from uploaded image inputs, or for single text-to-3D requests. For text-only requests asking for multiple separate models, prefer generate-image first and chain into this skill as a follow-up.
---

# Generate Model

Generate a 3D model from an uploaded source image or from a text prompt.

## Inputs
- Optional uploaded image(s) from chat image uploads.
- Optional user prompt for the subject, style, and detail.

## Behavior
- If uploaded image(s) are provided, generate one 3D model per image, one by one.
- If no image is uploaded and the user provides a text prompt, first let the LLM author a clean source-image prompt, then generate the source image, then use that image to create the 3D model.
- If the user asks for multiple separate 3D models from a text-only prompt, generate multiple separate source images first, then create one 3D model per source image.
- For text-only multi-model requests, never place multiple animals, characters, or objects into one shared source image just because they were requested together.
- Each generated source image for model creation should contain exactly one clear centered main subject on a simple neutral background so the 3D model pipeline can process it cleanly.
- If no prompt is supplied with an uploaded image, allow automatic prompt generation.
- Prioritize clean metadata and a usable model file name.

## Output
- Return a short completion summary including model file name, model id, and description.
- If neither an uploaded image nor a text prompt is available, ask for either a source image or a prompt.
