# URageStudio API Reference

> **Status:** Draft — populated from route files during documentation audit (2026-06-09). Fill in request/response schemas as routes are stabilized.

## How to Document an Endpoint

1. Add a section with `### METHOD /path` (e.g., `### GET /api/state`).
2. Include: HTTP method, path, description, request body/query params table, response schema, status codes.
3. Link to the source file in `dashboard/src/server/routes/`.

---

## Static Assets & Pages

| Method | Path | Source File | Description |
|--------|------|-------------|-------------|
| GET | `/vendor/gif.worker.js` | readRoutes.ts | Returns GIF worker script for dashboard |
| GET | `/assets/dashboard-logo.png` | readRoutes.ts | Serves dashboard logo image |
| GET | `/assets/dashboard-theme-logo.png` | readRoutes.ts | Serves theme-specific logo (query: `theme`) |
| GET | `/` | readRoutes.ts | Renders main dashboard HTML page |

---

## Runtime State & Control

| Method | Path | Source File | Description |
|--------|------|-------------|-------------|
| GET | `/api/state` | readRoutes.ts | Returns runtime state snapshot |
| GET | `/api/console-history` | readRoutes.ts | Returns console history entries |
| GET | `/api/messenger-runtimes` | readRoutes.ts | Returns messenger runtime snapshots |
| POST | `/api/messenger-runtimes/control` | readRoutes.ts | Controls messenger runtimes (start/stop/restart) |
| POST | `/api/dashboard/restart` | readRoutes.ts | Restarts the dashboard server |

---

## Installers

| Method | Path | Source File | Description |
|--------|------|-------------|-------------|
| POST | `/api/installers/run` | readRoutes.ts | Runs system installers (ollama, lmstudio, comfyui, blender, ffmpeg) |

---

## Discord Guild & Channel Permissions

| Method | Path | Source File | Description |
|--------|------|-------------|-------------|
| GET | `/api/guilds` | readRoutes.ts | Lists all Discord guilds |
| GET | `/api/guild-permissions` | readRoutes.ts | Gets guild permission summary (query: `guildId`) |
| GET | `/api/channel-permissions` | readRoutes.ts | Gets channel permission summary (queries: `guildId`, `channelId`) |
| GET | `/api/guild-dashboard-settings` | settingsAndGuildRoutes.ts | Gets per-guild dashboard moderation settings, including honeypot configuration (`guildId`) |

---

## Theme Configuration

| Method | Path | Source File | Description |
|--------|------|-------------|-------------|
| GET | `/api/theme-config` | readRoutes.ts | Gets theme config (queries: `target`, `messenger`) |

---

## Automation — Scheduled & Join Triggers

| Method | Path | Source File | Description |
|--------|------|-------------|-------------|
| POST | `/api/scheduled-automations` | automationRoutes.ts | Saves a scheduled automation (cron/interval) for image, model-3d, template, jokes, unity-gift sources |
| POST | `/api/scheduled-automations/delete` | automationRoutes.ts | Deletes a scheduled automation by id |
| POST | `/api/join-automations` | automationRoutes.ts | Saves a join-triggered automation for image, model-3d, template, jokes, unity-gift sources |
| POST | `/api/join-automations/delete` | automationRoutes.ts | Deletes a join automation by id |

---

## Automation — Text Sources & Image Pools

| Method | Path | Source File | Description |
|--------|------|-------------|-------------|
| POST | `/api/automation-text-sources` | automationRoutes.ts | Saves automation text source file (append or replace mode) |
| POST | `/api/automation-text-sources/generate` | automationRoutes.ts | Generates text source content via LLM (append or replace mode) |
| POST | `/api/image-pools` | automationRoutes.ts | Creates or updates an image pool with image URLs |
| POST | `/api/image-pools/delete` | automationRoutes.ts | Deletes an image pool by id |

---

## Automation — Resource Pools

| Method | Path | Source File | Description |
|--------|------|-------------|-------------|
| POST | `/api/resource-pools` | automationRoutes.ts | Creates or updates a resource pool (image, model3d, video, audio, music) |
| POST | `/api/resource-pools/delete` | automationRoutes.ts | Deletes a resource pool by kind and id |

---

## Channel Messaging & Bot Control

| Method | Path | Source File | Description |
|--------|------|-------------|-------------|
| POST | `/api/ask-to-channel` | channelMessagingRoutes.ts | Sends LLM prompt to a channel (draft mode if confirmation required) |
| POST | `/api/confirm-draft` | channelMessagingRoutes.ts | Confirms and sends a pending LLM draft to its target channel |
| POST | `/api/send-message` | channelMessagingRoutes.ts | Sends arbitrary content to a Discord/Telegram/Matrix channel |
| POST | `/api/edit-bot-message` | channelMessagingRoutes.ts | Edits an existing bot message in a channel |
| POST | `/api/send-dm` | channelMessagingRoutes.ts | Sends a direct message to a user by userId |
| POST | `/api/post-gift` | channelMessagingRoutes.ts | Posts a "gift" message to a channel |
| POST | `/api/post-humble` | channelMessagingRoutes.ts | Posts a "humble" message to a channel |

---

## Chat Skills & AI Personality

| Method | Path | Source File | Description |
|--------|------|-------------|-------------|
| GET | `/api/chat-skills` | chatSkillRoutes.ts | Lists all available chat skills with id, name, description |
| GET | `/api/chat-skill?skillId=` | chatSkillRoutes.ts | Gets a single chat skill's content (query: `skillId`, `id`) |
| POST | `/api/chat-skill` | chatSkillRoutes.ts | Creates or updates a chat skill file on disk |
| GET | `/api/chat-personality` | chatSkillRoutes.ts | Reads SOUL.md + USER.md personality settings and user notes |
| POST | `/api/chat-personality` | chatSkillRoutes.ts | Writes new personality settings (personalities, activeId) and USER.md content |

---

## AI Chat — Ask & Stream

| Method | Path | Source File | Description |
|--------|------|-------------|-------------|
| POST | `/api/ask` | chatSkillRoutes.ts | Non-streaming AI chat with skill routing, vision model support, clarification flow |
| POST | `/api/ask-stream` | chatSkillRoutes.ts | Streaming NDJSON chat with skill chains, reasoning deltas, artifact events, abort support |

---

## Media Conversion

| Method | Path | Source File | Description |
|--------|------|-------------|-------------|
| POST | `/api/media-convert` | mediaConverterRoutes.ts | Converts video to GIF or PNG frames via ffmpeg (requires `mode`, `sourceDataUrl`) |
| GET | `/api/media-converter-gifs?limit=` | mediaConverterRoutes.ts | Lists recent GIF conversions (query: `limit`, default 24) |
| GET | `/api/media-converter-file?jobId=&file=` | mediaConverterRoutes.ts | Retrieves a converted file by jobId and filename |

---

## Messaging & Model Generation (38 endpoints)

| Method | Path | Source File | Description |
|--------|------|-------------|-------------|
| POST | `/api/model-image-upload` | messagingAndModelRoutes.ts | Uploads an image for model processing (base64 data URL, optional metadata strip) |
| POST | `/api/model3d-start-notice` | messagingAndModelRoutes.ts | Posts a start notice for 3D generation in a channel |
| POST | `/api/model3d-generate` | messagingAndModelRoutes.ts | Generates a 3D model from an image input |
| POST | `/api/model3d-render` | messagingAndModelRoutes.ts | Renders a 3D model from multiple angles |
| POST | `/api/model3d-extract-textures` | messagingAndModelRoutes.ts | Extracts PBR textures (albedo, normal, roughness, metallic) from a 3D model |
| POST | `/api/model3d-low-poly` | messagingAndModelRoutes.ts | Generates low-poly version of a 3D model with LLM face count decision |
| POST | `/api/model3d-upload` | messagingAndModelRoutes.ts | Uploads a completed 3D model to Discord/Telegram/Matrix |
| GET | `/api/model3d-status` | messagingAndModelRoutes.ts | Gets current 3D generation job status |
| POST | `/api/image-generate` | messagingAndModelRoutes.ts | Generates an image via local or remote ComfyUI workflow |
| GET | `/api/image-workflow-metadata?workflowPath=` | messagingAndModelRoutes.ts | Reads configured image workflow dimensions, execution metadata, and required node types |
| GET | `/api/image-workflow-preflight?workflowPath=` | messagingAndModelRoutes.ts | Checks configured image workflow node types and explicit selectable model files against the active ComfyUI image server |
| POST | `/api/image-edit` | messagingAndModelRoutes.ts | Edits an existing image (inpainting, outpainting, background removal) |
| POST | `/api/image-interpret-prompt` | messagingAndModelRoutes.ts | Interprets a source image into an image-generation prompt |
| POST | `/api/image-rewrite-prompt` | messagingAndModelRoutes.ts | Rewrites, improves, or translates an Image Studio prompt via LLM |
| POST | `/api/image-upscale` | messagingAndModelRoutes.ts | Upscales an image using AI model |
| POST | `/api/image-to-video` | messagingAndModelRoutes.ts | Generates a video from an image prompt |
| POST | `/api/text-to-video` | messagingAndModelRoutes.ts | Generates a video from text description |
| POST | `/api/video-gif-convert` | messagingAndModelRoutes.ts | Converts video to animated GIF/WEBP |
| GET | `/api/generation-status` | messagingAndModelRoutes.ts | Gets current AI generation job status |
| POST | `/api/image-pool-select` | messagingAndModelRoutes.ts | Selects images from an image pool for generation |
| POST | `/api/model3d-pool-select` | messagingAndModelRoutes.ts | Selects 3D models from a resource pool |

_(Additional endpoints in messagingAndModelRoutes.ts handle workflow execution, batch processing, and model metadata extraction via LLM.)_

---

## Messenger Admin

| Method | Path | Source File | Description |
|--------|------|-------------|-------------|
| _(see `messengerAdminRoutes.ts`)_ | | messengerAdminRoutes.ts | Messenger admin/configuration routes |

---

## Resource Hub / Desktop Tools

| Method | Path | Source File | Description |
|--------|------|-------------|-------------|
| _(see `resourceHubRoutes.ts`)_ | | resourceHubRoutes.ts | Desktop tool bridge and resource hub routes |

---

## Speech

| Method | Path | Source File | Description |
|--------|------|-------------|-------------|
| _(see `speechRoutes.ts`)_ | | speechRoutes.ts | Text-to-speech / speech recognition routes |

---

## Release-client and LLM integration

External apps, games, and LLM adapters consume a running URageNow release as an external HTTP service; they do not require this source checkout and must not infer server absence from their own project files. The local default base URL is `http://127.0.0.1:4782`, but releases may override it with `DASHBOARD_PORT`; consumers use project/user configuration first, then directly confirm the selected URL with `/health` or `/api/llm-tools` and never scan ports. Each client configures a base URL and authorization, then reads `GET {baseUrl}/api/llm-tools` as the source of truth for available generation and tool-resource functions plus their current schemas. It invokes the release with direct HTTP requests, never Dashboard-page browser automation unless UI testing is explicitly requested. The portable skill provides concrete health, manifest, generation, download, recovery, and JSON-file payload commands through a dependency-free Node 18+ helper for Windows, macOS, and Linux and retains PowerShell as a Windows alternative. It treats a plain image request as terminal, uses returned artifact IDs/file names/URLs for downloads, and reserves job IDs for recovery only. The portable agent instructions live at `.agents/skills/URageNow` and may be copied into a project that supports project-local skills. Loading the skill supplies instructions only, so the consuming agent immediately runs its exact `health` helper command and then `manifest`; it must not reload the skill or inspect client workspace files instead of making those API calls. Narration and command examples are not API progress: the agent must execute the next helper command, then download a requested image using its returned artifact fields and report the saved path.

Generation POST routes can take minutes and return their artifact on success; never replay one as polling. A returned artifact includes its ID, file name, and relative download URL; use those fields to retrieve the binary, not a job ID. An image request ends with that image artifact: only call model generation when the user explicitly asks for a 3D model. Callers that need recovery after a timeout send a unique `dashboardRequestId`, inspect `GET /api/generation-jobs?requestId=...` (also supports `jobId`, `kind`, and `limit`), then resolve the returned artifact ID with `GET /api/generated-artifact?kind=<kind>&id=<artifactId>`.

Use `POST /api/image-import` with an image `dataUrl` to put an external attachment into generated image history; preserve its returned `id` and `imageFileName` when calling a named transformation. Both shipped helpers accept ordinary JSON files with CRLF or LF endings, and the Sharp-backed converters accept PNG as well as JPEG; JSON parsing failures normally indicate malformed or shell-mangled payloads. When an agent has a local attachment path, use the helpers' `import-image-file` action instead of creating a base64 JSON file. Metadata stripping preserves animated imports by re-encoding them as GIF instead of flattening them to PNG. The copied URageNow skill also ships a stdio MCP bridge that exposes the named image transformations as callable tools; its one-step installers register a path-free `uragenow-mcp` command for Cline and Codex. The Codex installer resolves `%USERPROFILE%\.codex\config.toml` at install time and changes only its `[mcp_servers.uragenow]` section. Pixel Art Converter uses two separate Sharp resize passes because a second resize on one Sharp pipeline replaces the first; converter callers must return the new artifact record rather than the imported source. Use the MCP bridge as the primary LLM interface: it exposes media generation, server tools, artifact downloads, recovery, and tool-resource handoffs. Its initialization instructions carry the no-browser and exact-named-tool rules. Keep the reduced skill only for installation and direct-HTTP fallback. Use `GET /api/llm-tools` to discover catalog capabilities: each tool is marked `client` or `server`. Client tools remain Dashboard-only and can receive persistent resources but are not executed by the API. A registered server adapter is invoked through `POST /api/tools/invoke` with its exact `toolId` and `input`; this prevents a named tool request from silently being replaced with generic media generation. Pixel Art Converter, Normalmap Maker, and Image To Ascii are server adapters. Each takes a URage image `imageId` and `imageFileName`; Pixel Art additionally accepts `pixelSize`, Normalmap Maker accepts `strength`, and Image To Ascii accepts `columns`, `characterSet`, and `colorMode`, defaults to Detailed/Original colors, and returns its ASCII text with a rendered PNG (static source) or animated GIF (animated GIF source) artifact.

Use `POST /api/tool-resources` for persistent tool-to-tool handoffs and `GET /api/tool-resources?targetToolId=...` to read the target inbox. A resource is delivered only after the receiving tool imports it through its own normal input flow. `localhost` is same-machine only; remote consumers require a reachable server, firewall configuration, authorization, and, for browser clients, appropriate CORS policy. Never commit credentials into the copied skill or consuming project source.

`npm run start:api` is the API-only profile. It reuses the Dashboard HTTP listener, route groups, authentication, and persistence while setting `DASHBOARD_UI_ENABLED=false`, disabling Dashboard/static-tool routes, and suppressing messenger autostart. It still exposes all existing `/api/*` capabilities, including the LLM manifest and persistent tool-resource handoff. `npm run start:server` is intentionally not an API host.
### MCP-first external integration

For LLM clients, use the bundled `uragenow-mcp` stdio server as the normal integration point. It supplies typed callable operations, a live capability manifest, server-side named-tool invocation, artifact download, generation recovery, and tool-resource handoff. Its initialization instructions are the authoritative agent rules, including the browser-automation prohibition and requirement to select the exact named transformation.

The copied `URageNow` skill is intentionally small: it installs/configures MCP and provides a direct-HTTP fallback when an MCP host is unavailable. It must not duplicate endpoint schemas or named-tool definitions; those change with the running release and are discovered through `GET /api/llm-tools`.

For a non-MCP integration, configure `URAGE_API_BASE_URL` (default `http://127.0.0.1:4782`) and optional `URAGE_API_TOKEN`, then use the shipped Node 18+ helper on Windows, macOS, or Linux:

```sh
node .agents/skills/URageNow/scripts/uragenow-api.mjs --action health
node .agents/skills/URageNow/scripts/uragenow-api.mjs --action manifest
```

The helper supports `post-json` for a manifest-advertised endpoint, `import-image-file`, `jobs`, `artifact`, and `download`. Windows users without Node can use the matching PowerShell helper. Do not replace a named server tool with `/api/image-generate`; use `POST /api/tools/invoke` with the manifest's exact `toolId` and input schema. For MCP 3D generation from a prior URageNow image, call `urage_generate_model3d_from_image` with that image record's `id` and `imageFileName`; the bridge retrieves the binary and sends the required data URL to the model endpoint. A relative generated-image URL is not valid `imageInput`.

## Authentication

<!-- Document auth requirements if any routes require it -->

## Error Responses

<!-- Document error format and common error codes -->
