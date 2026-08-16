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

## Authentication

<!-- Document auth requirements if any routes require it -->

## Error Responses

<!-- Document error format and common error codes -->
