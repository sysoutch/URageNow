# ComfyUI MP4 Transcriber HTML Tool

This is a browser-only HTML5 tool for:

1. Selecting an `.mp4` file.
2. Extracting the audio locally in the browser.
3. Converting the decoded audio to mono 16 kHz WAV.
4. Uploading only the WAV file to a running ComfyUI backend.
5. Queueing a ComfyUI transcription workflow.
6. Polling ComfyUI history and displaying/downloading the transcript.

## Files

- `index.html` - UI and styling.
- `script.js` - MP4 audio extraction, WAV encoding, ComfyUI upload/prompt/history logic.
- `README.md` - this file.

## Dashboard integration

The tool is discovered automatically from `tools/video/video-transcriber/index.html`.

- It inherits the active dashboard palette through `dashboard-theme.js`.
- The ComfyUI connection controls are marked as `Transcriber Settings`.
- `dashboard-tool-bridge.js` allows the Tools workspace to inject an MP4 through the native file input.
- `describeCurrentAssets()` exposes the transcript text and extracted mono 16 kHz WAV to the Send Resource flow.
- The shared current-output fallback remains available for visible output discovery.

## Important

This version does **not** require FFmpeg WASM or CDN libraries. It uses the browser's native `AudioContext.decodeAudioData()` support. This works for MP4 files whose audio codec is supported by the browser, usually AAC in MP4.

If your MP4 uses an unusual audio codec, the browser may fail to decode it. In that case, use the FFmpeg WASM version instead, but the library files must be downloaded in an environment with internet access.

## Run

Because browser security can be annoying, serve the folder over HTTP instead of opening `index.html` directly:

```bash
cd comfyui-mp4-transcriber
python3 -m http.server 8080
```

Then open:

```text
http://127.0.0.1:8080
```

Your ComfyUI backend should be running, usually at:

```text
http://127.0.0.1:8188
```

## ComfyUI workflow setup

Paste your ComfyUI API-format workflow JSON into the textarea.

Then set:

- `Audio file input node ID` - the node that receives the uploaded audio filename.
- `Audio filename field` - the input field name on that node, for example `audio`.
- `Transcript output node ID` - the output node that returns text or a text file.

The app patches the selected node field with the uploaded WAV filename before calling `/prompt`.

## ComfyUI endpoints used

- `POST /upload/image` - used for uploading the WAV file because ComfyUI commonly routes uploads through this endpoint.
- `POST /prompt` - queues the workflow.
- `GET /history/{prompt_id}` - checks completion and output metadata.
- `GET /view?...` - fetches transcript text files if the output node writes `.txt`, `.json`, `.srt`, or `.vtt`.
