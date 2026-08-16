---
outputKind: image
inputMode: optional
supportsMultiple: true
allowedFollowUps: delight-image, remove-background, create-normal-map, create-pixel-art, generate-model, regenerate-image-filename
routerHint: Use for image generation, image editing, delight, background removal, normal-map creation, pixel-art conversion, or when a text-only multi-3D request should first create separate source images before follow-up model generation.
---

# Generate Image

Generate a new image from the user's request.

## Inputs
- User text prompt from chat.
- Optional uploaded image inputs from chat image uploads.

## Behavior
- If the user supplies a text prompt, use it directly.
- If no prompt is supplied, allow automatic prompt generation.
- If an image is uploaded, treat it as optional reference guidance.
- When the router schedules follow-up skills, treat generated images as reusable outputs for the next skill step.
- When the user's prompt includes follow-up transforms such as delight, remove background, normal map, or pixel art, only use the source-image part of the request for this first generation step.
- For multi-step 3D requests, generated images may be passed into `generate-model` one by one as follow-up inputs.
- When preparing source images for `generate-model`, do not reuse the user's raw text blindly. First turn the request into one or more single-subject source-image prompts that are centered, clean, and suitable for 3D model generation.

## Output
- Return a short completion summary including the generated image file name and URL.
- Keep the response concise and actionable.
