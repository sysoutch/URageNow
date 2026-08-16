# SpriteForge AI

SpriteForge AI is a local-first spritesheet utility for quick grid slicing and AI-assisted sprite detection.

It runs in the browser with a tiny Node/Express backend and supports local vision models from:
- Ollama
- LM Studio (OpenAI-compatible local server)

## Features

- Upload PNG/JPG spritesheets
- Immediate input image preview in the workspace
- Debug preview mode with visual region lines
- Grid slicing fallback
- Auto split with diagonal-aware pixel connectivity
- AI sprite detection with JSON output
- AI polygon region support for non-rectangular/diagonal separations
- Runtime switch in GUI: `Ollama` or `LM Studio`
- Per-provider endpoint URLs configurable in GUI
- Dynamic model list based on selected runtime
- Adjustable AI detection prompt in `AI Settings`
- LLM debug panel with sent prompt, raw reply, and extracted JSON
- Sprite preview rendering in a scrollable grid
- `Cut down to sprites only` option (default off for strict grid splitting)
- Transparency toggle for sprite rendering/export
- GIF preview generation + GIF download

## Tech Stack

- Frontend: Vanilla HTML + JavaScript + Tailwind CDN
- Backend: Node.js + Express
- Local model runtimes: Ollama and LM Studio

## Project Structure

```text
spritesheet-utility/
|-- index.html   # UI (upload, provider/model selection, grid, previews)
|-- server.js    # Local proxy API for Ollama + LM Studio
|-- README.md
```

## Setup

### 1. Install dependencies

```bash
npm install
```

Node 18+ is recommended.

### 2. Start your local runtime

#### Option A: Ollama

Install and start Ollama, then pull a vision model:

```bash
ollama pull qwen2.5vl
ollama serve
```

Default URL used by this app:

```text
http://127.0.0.1:11434
```

You can override it with:

```bash
set OLLAMA_URL=http://127.0.0.1:11434
```

#### Option B: LM Studio

1. Open LM Studio
2. Load a vision-capable model
3. Start the local server API

Default URL used by this app:

```text
http://127.0.0.1:1234
```

You can override it with:

```bash
set LMSTUDIO_URL=http://127.0.0.1:1234
```

### 3. Run the app

```bash
npm start
```

Open:

```text
http://localhost:3001
```

## How Detection Works

1. Upload image in the browser
2. The image is converted to base64
3. Frontend sends request to `POST /api/detect`
4. Backend translates payload for selected provider:
- Ollama: `/api/chat`
- LM Studio: `/v1/chat/completions`
5. The response text is parsed for JSON sprite boxes
6. Sprites are rendered in the preview panel

Expected JSON format:

```json
{
  "sprites": [
    { "x": 0, "y": 0, "width": 64, "height": 64 }
  ]
}
```

Also supported for diagonal/non-rectangular separation:

```json
{
  "regions": [
    {
      "points": [
        { "x": 10, "y": 10 },
        { "x": 200, "y": 20 },
        { "x": 180, "y": 210 }
      ]
    }
  ]
}
```

## Workflow Tips

- Use `Auto Split (Diagonal)` when sprites are separated by angled boundaries.
- Keep `Debug overlay lines` enabled to inspect what was detected on the input preview.
- Keep `Cut down to sprites only` unchecked for strict row/column slicing that respects spritesheet borders.
- Toggle `Keep transparency` depending on whether you want alpha preserved in sprite output and GIF.
- Use `Generate GIF Preview` to test animation order, then `Download GIF`.
- Tune `AI Settings > Detection prompt` and inspect `LLM Debug` to iterate quickly.

## API Endpoints

- `GET /api/providers` -> available runtimes
- `GET /api/models?provider=ollama|lmstudio` -> normalized model list
- `POST /api/detect` -> provider-aware sprite detection

Request body for `/api/detect`:

```json
{
  "provider": "ollama",
  "model": "qwen2.5vl",
  "imageBase64": "...",
  "prompt": "Return ONLY JSON..."
}
```

## Troubleshooting

### Models do not load

- Verify selected runtime is running
- Confirm the runtime URL matches your local server
- Check if the model is loaded/installed and vision-capable

### Image uploads but was not visible

This is now fixed: uploaded images are shown immediately in the `Input Preview` panel.

If preview is still blank:
- Try a PNG/JPG file
- Check browser console for decoding errors
- Confirm the file is not corrupted

### AI returns invalid JSON

- Use a stronger instruction in prompt (already enforced by default)
- Try another vision model
- Some models add explanations around JSON; parser extracts first JSON object

## Recommended Vision Models

- qwen2.5vl
- llava
- bakllava

## License

MIT
