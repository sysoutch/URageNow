---
outputKind: image
inputMode: image-only
supportsMultiple: true
allowedFollowUps: regenerate-image-filename
routerHint: Use for uploaded-image requests to convert one or more images into pixel art. In the dashboard chat UI this skill runs through the local Pixel Art Converter bridge instead of suggesting the tool manually.
---

# Create Pixel Art

Convert uploaded image inputs into pixel art.

## Inputs
- One or more uploaded images from chat image uploads.
- Optional prompt notes about the desired pixel-art look.

## Behavior
- Convert each uploaded image into its own pixel-art output.
- Reuse the local Pixel Art Converter workflow instead of only suggesting the tool.
- Keep the response concise and list the generated pixel-art file names.

## Output
- Return generated pixel-art image file names and image ids.
