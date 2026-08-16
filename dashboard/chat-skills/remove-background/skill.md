# Remove Background

Remove the background from an uploaded image.

## Inputs
- At least one uploaded image from chat image uploads.
- Optional prompt notes.

## Behavior
- Use the first uploaded image as source.
- Generate a cleaned cutout image while preserving subject details.
- Use the configured default source workflow. Workflow variants should be exposed as typed controls before being routed from chat.

## Output
- Return transformed image file name and image id.
