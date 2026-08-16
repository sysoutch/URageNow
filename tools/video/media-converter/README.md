# Media Converter

Browser-based converter for turning uploaded videos or animated GIFs into GIF output or PNG frame sequences.

## Features

- Accepts MP4, WebM, MOV, MKV, and animated GIF sources.
- Converts media to animated GIF.
- Extracts PNG frame sequences.
- Configurable FPS and output width.
- Provides preview, download, and frame ZIP actions.
- Sends converted GIF resources directly to GIF Viewer through Dashboard Send Resource.
- Accepts dashboard tool messages so Video Studio can send a selected clip into the tool or run a background MP4-to-GIF conversion through the same converter.

## Workflow

1. Upload a video or animated GIF.
2. Choose `Media To GIF` or `Media To PNG Frames`.
3. Set FPS and width.
4. Convert, preview, and download the result.
5. Use Send Resource and choose GIF Viewer to inspect the converted animation frame by frame.

## Notes

The tool runs in the browser and uses dashboard theme synchronization through `tools/shared/dashboard-theme.js`.

Dashboard automation uses `window.__URAGE_MEDIA_CONVERTER_AUTOMATION_RECEIVE__` and still posts to `/api/media-convert`, keeping ffmpeg conversion in the shared Media Converter service.
