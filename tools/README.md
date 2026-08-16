User can put more categories for tools here.

## Categories

- **art** - Image editing, color tools, SVG, pixel art
- **audio** - Music creation, sound effects, recording, audio visualization
- **dev** - Developer utilities, code generators, markdown tools
- **game** - Game development assets and animation tools
- **plan** - Planning and organization tools
- **video** - Video processing, recording, and media conversion

## Shared Components

### Tool Component Baseline (`shared/css/components/tool-components.css`)
Global themed controls for tools: buttons, selects, inputs, textareas, action rows, and details/foldout panels. It is auto-injected by `shared/dashboard-theme.js` and `shared/dashboard-current-output-autodescribe.js`, so tools that load either shared script receive the baseline without an extra `<link>`.

The shared tool component stylesheet now also normalizes older standalone tool shells, sidebars, cards, rails, controls, and output panels onto the dashboard token set. Prefer adding new tools to that shared layer instead of hardcoding per-tool theme colors.

Prefer semantic native elements (`button`, `select`, `details`, `summary`, `.button-row`, `.actions`) and only add tool-specific CSS for layout or genuinely unique visuals.

The shared dashboard stylesheet is re-appended after local tool styles at runtime so legacy tools keep their layout CSS while inheriting the current dashboard theme tokens for surfaces, controls, borders, and text. Do not hardcode per-tool theme colors when a `--tool-*` token or the shared component baseline can express the same state.

### Sidebar Scrollview Pattern (`shared/css/sidebar-scrollview.css`)
Global sidebar and foldout styling for tools with left/right sidebars. It is auto-injected after the shared component baseline by `shared/dashboard-theme.js`, so it is the final source of truth for sidebar scroll containment, outer sidebar border removal, panel blocks, and disclosure chevrons.

Prefer `.sidebar`, `.tool-sidebar`, `.left-rail`, `.right-rail`, `#sidebar`, or direct `#app > aside.panel`/`.left`/`.right` sidebars. For collapsible sections, use native `<details>`/`<summary>` with `.control-group`, `.sidebar-panel`, `.tool-foldout`, `.pool-sub-foldout`, or `.foldout`; the shared stylesheet hides native markers and supplies one token-based chevron.

Tools that use normal document scrolling instead of a fixed-height `.tool-layout` should add `data-dashboard-scroll-document` to `<body>`. This opts out of the shared `100vh` shell lock while retaining dashboard theming and stable vertical scrolling.

### Upload Card Component (`shared/css/components/upload-card.css`)
Universal styled upload area with dashed border, arrow icon, and dark theme. Compatible with all dashboard themes (fire, water, crystal, nature, rock).

**Usage:** Add `<link rel="stylesheet" href="/tools/shared/css/components/upload-card.css">` to your HTML head, then replace file input labels with:
```html
<label class="upload-card" for="fileInput">
    <span class="upload-card-icon arrow-icon">&#8595;</span>
    <strong>Choose a file</strong>
    <span>or drag it here.</span>
    <input id="fileInput" type="file" accept="image/*" hidden>
</label>
```

**Updated tools:** interactive-book, toon-image-shader, color-palette-extractor, normalmap-maker, image-transparency-tool, seamless-texture-maker, color-swapper, image-crop-and-scale, favicon-creator, gif-viewer

---

## Featured Tools

### Sprite Animation Studio Pro (`game/sprite-animation-studio/`)
A professional-grade HTML5 Canvas sprite animation tool with frame-by-frame editing, onion skinning, layers, undo/redo, and multi-format export (sprite sheet PNG, JSON atlas, CSS animation). See README.md for full documentation.

### Audio Recorder (`audio/audio-recorder/`)
Records microphone input, shared PC/tab audio, or both mixed together and exposes the latest recording through the dashboard asset descriptor bridge.

### Video Recorder (`video/video-recorder/`)
Records webcam video with optional microphone audio and exposes the latest recording through the dashboard asset descriptor bridge.

### AI Legitimacy Matrix (`plan/ai-legit-matrix/`)
Builds editable AI-use assessments and exposes the current matrix as JSON and Markdown resources.

### Pseudo Albedo Tools (`art/albedo-tools/`)
Converts normal or height maps into a stylized pseudo-albedo PNG and accepts dashboard-injected source images.

### ComfyUI MP4 Transcriber (`video/video-transcriber/`)
Extracts browser-decoded MP4 audio to mono 16 kHz WAV, runs a ComfyUI transcription workflow, and exposes both WAV and transcript outputs.

---

## Dashboard Image Insertion

- Image-capable art tools should avoid parser-blocking CDN scripts so the dashboard iframe can finish loading before an image is injected.
- Tools with file inputs should accept dashboard-injected `File` objects through normal `input`/`change` events.
- Tools without file inputs should listen for `tool:load-asset` messages from `urage-dashboard` and load `payload.dataUrl`, `payload.imageUrl`, or `payload.previewImageUrl`.

## Dashboard Game Engine Exports

- Prefer exposing processed outputs through the shared dashboard bridge with `describeCurrentAssets` when a tool has more than one exportable result.
- Each asset descriptor should include `kind`, `title`, `fileName`, `mimeType`, and either `sourceUrl`, `dataUrl`, or `textContent`.
- Every non-vendored `index.html` should load `tools/shared/dashboard-current-output-autodescribe.js` near the end of the body unless it has a stronger explicit descriptor script that still needs the same fallback.
- For generated media tools, expose the final processed file first in `describeCurrentAssets`, then add structured companions like JSON config, engine snippets, palettes, or source previews.
- If a tool does not expose descriptors, the Tools workspace now falls back to visible download links, canvases, image/video/audio elements, and text outputs, then lets the user choose which output to send in the shared `Send Resource` overlay.
- Browser-local `blob:` and canvas outputs are stored by the dashboard and served through `/api/game-engine-export-file`, so game-engine importers can fetch them like normal generated files.
- `npm run check:tools` audits every non-vendored HTML tool for the shared fallback and explicit current-asset descriptor coverage.
# Tool visual QA

Run `node scripts/audit-tool-screenshots.mjs http://127.0.0.1:4782 artifacts/tool-visual-qa` from the repository root before declaring a cross-tool responsive change complete. It captures every catalogued tool at phone and desktop widths, writes a JSON report, and treats horizontal overflow or page-load failures as failures.

Catalog entries use each tool's `thumbnail.png`, `thumbnail.jpg`, `thumbnail.jpeg`, or `thumbnail.webp` when present. Tools without an individual thumbnail use the shared `tools/shared/tool-cover.png`, so mobile cards always render an image cover.
