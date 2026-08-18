# Architecture Cleanup Roadmap

## Target Dependency Graph

```text
shared contracts
      |
      v
server services
      |
      +------------------+
      v                  v
dashboard adapter   messenger adapters
      \                  /
       v                v
        runtime composition
```

Dependencies should point downward only. Runtime composition may import every adapter, but shared contracts and server services must not import dashboard or bot implementations.

## Phase 1: Enforce Real Package Boundaries

Status: complete.

1. `dashboard`, `server`, `shared`, and Discord are registered as root npm workspaces.
2. The workspace uses one root `package-lock.json` and one root install command.
3. Each TypeScript package has its own `tsconfig.json` and explicit package exports.
4. Deep relative imports such as `../../../server/src/...` have been replaced with scoped workspace imports.
5. `npm run check:architecture` rejects:
   - `shared -> server/dashboard/bots`
   - `server -> dashboard/bots`
   - `dashboard -> bots`
   - `workers -> dashboard/bots`

Resolved boundary violations:

- Rust model inspection and validation contracts now live under `shared/src/model3d/`.
- LM Studio protocol helpers now live under `server/src/services/llm/`.
- Telegram, Matrix, and WhatsApp admin clients now live under `server/src/services/messaging/`.
- Remote-worker HTTP helpers now live under `server/src/http/`.

Remaining Phase 1 work:

- None. Continue enforcing the dependency graph while extracting runtime composition.

## Phase 2: Extract Neutral Runtime Composition

Create a neutral runtime entrypoint, for example `runtime/src/index.ts`, that owns:

- dashboard server startup
- messenger runtime manager startup
- dependency construction
- lifecycle and shutdown handling

Keep Discord events, interactions, embeds, and Discord API operations under `bots/discord-bot`.

Completed groundwork:

- Messenger process lifecycle management now lives in `server/src/runtime/messengerRuntimeManager.ts`.
- Shared dashboard/runtime state now lives in `server/src/runtime/runtimeState.ts`.
- Dashboard settings persistence now lives in `server/src/runtime/dashboardSettingsStore.ts`.
- Runtime LLM synchronization now lives in `server/src/runtime/runtimeLlmSettings.ts`.
- Moderation rule normalization and compilation now lives in `server/src/services/moderationRules.ts`.
- Discord imports these runtime services through `@urage/server` exports.

Completion criteria:

- `bots/discord-bot/src/index.ts` becomes a Discord adapter factory instead of the combined application host.
- Dashboard-only startup does not execute the Discord composition module.
- Worker startup imports server services without dashboard or bot adapters.

## Phase 3: Centralize Repository Paths And Configuration

Status: complete.

Introduce one repository-path module that resolves paths from `import.meta.url`, not `process.cwd()`.

It should expose named paths such as:

- `repoRoot`
- `dataRoot`
- `toolsRoot`
- `workflowRoot`
- `dashboardAssetsRoot`
- `sharedConfigRoot`

Replace the repeated parent-directory candidate searches currently spread across dashboard and server modules.

Completed:

- Canonical paths live in `shared/src/runtime/repositoryPaths.ts`.
- Server retains a compatibility export from `server/src/config/repositoryPaths.ts`.
- Repository discovery no longer depends on `process.cwd()` in shared, server, dashboard, or remote-worker TypeScript.
- `npm run check:paths` verifies path stability after changing the process working directory.

Completed:

- Shared environment templates now live at repository root.
- Root `.env.public*` and `.env.main*` files are canonical.
- Legacy Discord-local env files remain supported as lower-precedence migration fallbacks.
- Messenger-only secrets and settings remain under their corresponding adapters.

## Phase 4: Split Oversized Modules By Feature

Prioritize files where size reflects mixed ownership:

- `dashboard/src/client/modules/aiMediaStudioHelpers.js`
- `dashboard/src/client/modules/dashboard/tools/workspaceHelpers.js`
- `dashboard/src/client/modules/aiActionHelpers.js`
- `dashboard/src/pageSections/aiView.ts`
- `bots/discord-bot/src/index.ts`
- `server/src/services/model3d.ts`
- `dashboard/src/server/routes/messagingAndModelRoutes.ts`
- `server/src/services/llm/ollama.ts`
- `workers/remote-worker/src/remoteWorker.ts`

Split by stable feature boundaries, not arbitrary line counts. Each feature should own its route handlers, contracts, service logic, and UI controller where practical.

Recent media performance work completed:

- Image, 3D model, and video history thumbnails use intersection-based source loading.
- Offscreen recent-media images and videos release their `src`.
- Rerenders detach old observer targets before removing DOM nodes.
- Image Studio closes decoded GIF `ImageBitmap` frames when previews change.
- 3D Studio disposes stale and replaced geometries, materials, and textures.
- Hidden browser tabs unload active Image/Video previews and the Three.js scene.
- Video history uses incremental rendering instead of creating every row at once.
- Generic media workflow form controls now live in `dashboard/media/workflowFormHelpers.js` instead of the oversized media studio factory.
- Dashboard checks exercise workflow form parsing, clamping, event dispatch, and mirrored-input synchronization.

Shared dashboard layout work completed:

- Tools Browser/Desktop, 3D Suites Projects/Addons, and Game Engines Projects/Assets each expose Cards, List, and Table layouts.
- Layout state is stored independently per dashboard tab and restored from browser storage.
- One shared renderer and client controller own the switcher contract instead of duplicating tab-specific behavior.
- Dynamically rendered project and desktop-tool cards inherit the active panel layout without rerender-specific wiring.

Tool asset bridge stability work completed:

- Dashboard file-input fallback dispatches one input/change delivery instead of additional synthetic drop events.
- Message-aware image tools no longer receive a `postMessage` copy before successful file-input injection.
- Interactive Book accepts dashboard media URLs directly, avoiding large Blob/File duplication and repeated page initialization.
- The tool bridge audit now guards the single-delivery contract and Interactive Book receiver.
- Image object identification now extracts balanced JSON candidates, salvages individually valid object entries, and retries vision once when no valid entries can be recovered.
- Successful Image Studio interpretation resets object-identification mode; separate-object generation now requires the toggle to be explicitly enabled.
- Multi-selected 3D history variants now resolve turntable thumbnails from each selected variant instead of defaulting every card to the low-poly preview.
- 3D variant deletion requires an explicit variant and filename, never deletes the whole model record, and lists low-poly directly after merged.
- Recent Image, 3D Model, Video, Audio, and Music docks share one reusable compact Group / Filter popup; image and video metadata filters cover prompt, source image, steps, CFG, and dimensions where available, while 3D filters cover source image, variant, and face count.

Dashboard navigation regressions fixed:

- Game Engine Assets uses a bounded zero-basis flex scroller, overriding generic Resource Hub max-content sizing that previously expanded beyond the clipped dashboard view.
- Tools rail category and search filters now update the visible main catalog as well as the workspace-home and sidebar renderers.
- Image, Video, and 3D primary workflow tabs share one connected no-gap visual contract, align flush at the focused panel origin, and synchronize active plus accessible selected state on click.
- Image Studio custom dimensions include an aspect-ratio lock that keeps width and height synchronized on the existing 8-pixel resolution step.
- Image Studio preview metadata now reflects the selected image's dimensions, steps, CFG, and seed instead of static placeholder values.
- 3D Studio inspector LOD generation now uses a dedicated `blender-scripts/decimate/decimateToFaces.py` pipeline, persists independently downloadable LOD artifacts, and derives automatic levels from inspected face counts instead of reusing the low-poly variant action.
- Low-poly conversion preserves source UVs before the installed LowPolyUV addon samples them, so palette colors match the visible source texture. New conversions export self-contained GLB artifacts rather than round-tripping through FBX; existing FBX low-poly variants remain readable.
- An empty Chat Studio session uses a centered, theme-aware mascot badge and the concise “Wow, such empty!” state instead of an instructional placeholder.
- Fresh Chat Studio messages use a short pop-in animation in the dashboard and Android companion; only newly appended messages animate, so transcript re-renders do not replay motion for history.
- Chat Studio message controls are compact, tooltip-labelled icons: task details follow the message role label without reserving empty bubble width, while edit, delete, speech, copy, and related actions share the lower-right action row. Task metadata opens as an anchored floating panel instead of expanding the bubble.
- Chat Studio defaults to deleting successfully sent voice recordings: the dashboard does not persist an STT source artifact or retain its base64 data in chat history, and Android removes the local recording after a successful transcription. Each client exposes a preference to retain sent voice recordings instead.
- Image Studio now constrains the primary image and GIF-canvas previews to their loaded intrinsic dimensions. Workflow layout may shrink an image to fit its panel, but cannot upscale uploads or variants that have missing or stale metadata.

## Phase 5: Consolidate CSS And SCSS Ownership

Status: started.

The stylesheet loading map is layered, but several broad files still mix shell, component, workflow, and responsive ownership. Current hotspots include:

- `dashboard/src/styles/shared/_studio-components.scss`
- `dashboard/src/styles/media-ai/_model3d.scss`
- `dashboard/src/styles/studio/_focused-workflow.scss`
- `dashboard/src/styles/_cards-components.scss`
- `dashboard/src/styles/studio/_core.scss`
- `dashboard/src/styles/_tools.scss`
- `dashboard/src/styles/_content-layout.scss`

Cleanup rules:

1. Keep `dashboard/src/styles.scss` as a layer loading map only.
2. Move touched selectors out of the transitional legacy layer into the smallest responsible shell, navigation, studio, messenger, or shared component file.
3. Split files by stable UI component or workflow ownership, not arbitrary line counts.
4. Consolidate repeated geometry into token-backed shared components before adding new overrides.
5. Reduce `!important` usage by fixing layer order and selector ownership where practical.
6. Preserve generated CSS behavior with build checks and focused browser smoke tests during each extraction.

Completion criteria:

- No broad legacy stylesheet exceeds 1,500 lines.
- No feature stylesheet exceeds 2,000 lines without a documented ownership reason.
- Touched workflow components have one base geometry owner and narrowly scoped state/layout overrides.
- Automated style architecture checks enforce the root loading map and migrated component ownership.

Completed:

- Primary Image, Video, and 3D workflow tab geometry moved from transitional `media-ai` styles into `studio/_workflow-tabs.scss`.
- Focused workflow breakpoint rules moved into `studio/_focused-workflow-responsive.scss`, reducing the base focused stylesheet to its non-responsive ownership.
- The final focused 3D viewer/action refinement block moved from the shared focused workflow stylesheet into `studio/_focused-workflow-model3d.scss` without changing generated CSS order.
- Cross-media dock, queue, and filmstrip rules moved out of `media-ai/_model3d.scss` into `media-ai/_media-docks.scss`.
- Removed hundreds of blank-only lines from the legacy Tools stylesheet and added an automated guard against excessive blank-line runs.
- Added no-growth line budgets for the seven remaining stylesheet hotspots so ongoing feature work must extract ownership instead of making them larger.
- Dashboard checks now enforce the root loading map and workflow-tab stylesheet ownership.

## Phase 6: Normalize Runtime Data And Static Assets

- Keep runtime state under root `data/` only.
- Removed stale tracked `bots/discord-bot/data/`; runtime state is root `data/` only.
- Removed stale Discord-local `SOUL.md` and `USER.md`; canonical personality files are under `shared/`.
- Messenger logos and theme definitions now live under `dashboard/assets/messengers/`.
- Dashboard static serving no longer exposes bot package directories.
- Remove stale nested `node_modules`, `dist`, and package lockfiles after the workspace migration is complete.
- Keep generated build output reproducible and untracked.

## Phase 7: Add Architectural Tests

Status: started.

The repository currently has no meaningful automated unit or integration test suite.

Start with:

1. import-boundary validation
2. repository-path resolution tests from different working directories
3. config precedence tests
4. dashboard route smoke tests with fake dependencies
5. server service tests for generated-media stores and prompt routing
6. runtime composition smoke tests with messenger adapters disabled

Completed:

- import-boundary validation
- repository-path working-directory invariance
- dashboard settings initialization, legacy migration, and queued-write validation
- dashboard server lifecycle and route smoke validation with fake runtime dependencies
- aggregate `npm run check` across architecture, paths, Discord, worker, dashboard, and tool contracts
- interactive runtime shutdown validation: Ctrl+C is handled by the Node runtime, reports the impact on embedded Discord, external messengers, and reachable ComfyUI, and leaves the server alive when the operator answers `n`.

## Recommended Sequence

1. Fix the three current reverse dependencies.
2. Add workspace package exports and boundary checks.
3. Add the central repository-path module.
4. Extract neutral runtime composition.
5. Split the largest feature modules incrementally.
6. Consolidate CSS/SCSS ownership and reduce broad legacy stylesheets.
7. Consolidate data/assets and remove stale local install artifacts.
8. Expand automated tests around each extracted boundary.

Avoid a big-bang folder rename before dependency direction is enforced. Renaming tangled modules changes addresses without improving ownership.
