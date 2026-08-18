# Studio Workflow UX Rescue Plan

## Status

The Studio UX is **not visually complete**. The current LazyDev home implements part of the previous concept's structure, but the previous concept was not a sufficient product specification. It encouraged duplicated content, excessive navigation height, an oversized featured record, and a search control without a defined behavior.

The focused workflow audit is also incomplete: several files under `tmp/workflow-audit/` are only 31 pixels tall and cannot be treated as evidence that Image, 3D, Audio, Music, or Video were visually reviewed.

## Approved Direction References

| Surface | Reference | Purpose |
| --- | --- | --- |
| LazyDev home | [`ux-references/lazydev-home-v2.png`](ux-references/lazydev-home-v2.png) | Dense task dashboard, command-first creation, resumable work, and job state |
| Focused Image workflow | [`ux-references/image-studio-v2.png`](ux-references/image-studio-v2.png) | Shared focused-workflow shell, stable preview/inspector/history/queue responsibilities |

These are composition references, not pixel-perfect specifications. Generated text, imagery, icons, and decorative details are non-authoritative. The component responsibilities, hierarchy, density, and action placement are authoritative unless implementation evidence requires a documented change.

## Captures

Audit captures are written to `tmp/workflow-audit/`. `lazydev-home-current.png` is usable. The current Image, 3D, Audio, Music, and Video card captures are invalid because they captured a collapsed 31-pixel strip. Each workflow must be opened through its real navigation state and recaptured at the verification sizes below before visual approval.

## What Is Wrong Today

1. The home has two Chat entry points: the large promotional Chat card and the workflow grid. This creates competing primaries.
2. The recent-project list and recent-activity list repeat the same generation records instead of serving different decisions.
3. The featured record is allowed to consume most of the useful height even when its thumbnail aspect ratio is poor.
4. The search box is visually prominent without a specified searchable scope, result UI, keyboard behavior, or empty state.
5. Workflow navigation consumes two rows and six tall cards before the user reaches ongoing work.
6. The home lacks active job progress, failure recovery, import/library shortcuts, and a clear route to full history.
7. The previous plan declared the home successful without measurable visual or interaction acceptance criteria.
8. The focused-workflow plan names regions but does not define their ownership, size, behavior, or breakpoint transformations.

## Product Model

The home answers four questions, in order:

1. **What do you want to make?** One command composer plus six compact workflow selectors.
2. **What were you working on?** A project-oriented `Continue working` region with no duplicate records.
3. **What is the system doing?** A separate `Activity & jobs` region for queued, running, failed, and completed jobs.
4. **Where else can you go?** A compact quick-action strip for import, library, automation, and tools.

The focused workflow answers four different questions:

1. **What are the inputs?** A single task form with one obvious primary action.
2. **What is the result?** A dominant preview/canvas.
3. **What can be done with the result?** A stable inspector/action panel.
4. **What else is running or available?** A filmstrip/history region and queue with distinct responsibilities.

## Proposed Shared Pattern

1. Keep one primary task visible at the top of every workflow.
2. Put optional/legacy settings into closed, named accordions rather than removing them.
3. Keep preview, history, queue, and inspector as stable supporting regions instead of competing cards.
4. Give every action a matching icon and reserve strong accent fills for irreversible or primary actions.
5. Use a shared input-step vocabulary across Chat, Image, 3D, Audio, Music, and Video.
6. Use project cards for resumable work and event rows for system activity; never render the same record in both regions merely to fill space.
7. Keep the shell and information architecture theme-independent. Theme variables may change color and geometry, not region ownership or ordering.
8. Show only working controls. A search field, filter, menu, or `View all` action is not shippable until its behavior and destination exist.

## LazyDev Home Component Contract

| Region | Responsibility | Required behavior |
| --- | --- | --- |
| Header | Context and runtime readiness | Breadcrumb, page title, local/remote readiness, profile; no oversized welcome copy |
| Command composer | Fastest path from intent to work | Prompt, attachment, explicit mode/model choice, one `Start` action; keyboard submit and visible focus |
| Workflow selector | Direct navigation | Six compact, single-row choices on wide desktop; preserves workflow accent colors |
| Continue working | Resume projects/results | One moderate featured item and up to four supporting items; explicit open action; bounded thumbnails |
| Activity & jobs | Operational state | Active progress, completion, failure, retry/cancel where supported, full-history route |
| Quick actions | Common cross-workflow routes | Import asset, open library, new automation, browse tools |

Remove the standalone large Chat promo card. Replace the current static search input with the command composer; reintroduce global search only after its result scope and interaction contract are implemented.

## Focused Workflow Layout Contract

At desktop widths, use a stable `navigation / input / preview / inspector` grid. History belongs in the workflow navigation sidebar, result variants belong in a filmstrip adjacent to the preview, and execution state belongs in the queue. These are not interchangeable lists.

| Region | Desktop target | Notes |
| --- | --- | --- |
| App rail | 72-88 px | Global destinations only |
| Workflow sidebar | 220-260 px | New task, searchable workflow history, templates/settings |
| Input panel | 300-340 px | Prompt/source, essential choices, primary action, collapsed advanced settings |
| Preview | `minmax(520px, 1fr)` | Dominant region; neutral media-safe background |
| Inspector | 280-320 px | Metadata and actions for the selected result only |
| Filmstrip | 104-136 px high | Variants/results, selection, add/more affordance |
| Queue | 56-72 px high | Current job state and route to full queue |

Chat may replace the preview/filmstrip with its conversation and composer. Audio and Music may replace the visual preview with waveform/player surfaces. The layout contract remains: primary input, dominant result, selected-result actions, history, and job state each have one owner.

## Workflow Mapping

| Workflow | Primary flow | Secondary content |
| --- | --- | --- |
| Chat | prompt, context, send | model parameters, attachments, history |
| Image | prompt/source, generate | sampling, post-processing, send destinations |
| 3D | model/source, generate or texture | Blender adjustments, low-poly, print/export |
| Audio | text/source, generate | voice/effects/export |
| Music | prompt/reference, compose | structure, duration, export |
| Video | prompt/source, generate | camera/motion, post-processing, export |

## Rollout

1. **Repair visual verification.** Recapture all six focused workflows through their explicit navigation state at 1920x1080, 1440x900, and 390x844. Reject clipped, zero-height, or loading-only captures.
2. **Correct LazyDev home semantics.** Replace the promo/search block with the command composer and compact selector; separate project data from job/activity data; add real routes only where the feature exists.
3. **Extract shared focused-workflow primitives.** Create owned shell, input section, preview stage, inspector action, filmstrip, queue row, and empty/error/loading components instead of adding overrides to broad legacy files.
4. **Migrate Image first.** It exercises source input, generated variants, preview, selection, export, send destinations, and queue behavior.
5. **Migrate 3D second.** Reuse the shell while preserving its model viewer, multi-view, LOD, Blender, low-poly, and export requirements.
6. **Migrate Audio, Music, and Video.** Reuse media docks and queue primitives; specialize only the result stage.
7. **Migrate Chat last.** Reuse navigation, history, inspector, and status patterns without forcing media-specific filmstrip behavior into conversation UI.

## Acceptance Criteria

### Home

- At 1920x1080, the composer, all workflow selectors, featured work, four recent items, job/activity status, and quick actions are visible without page scrolling.
- There is exactly one dominant `Start` action and no duplicate large Chat card.
- Featured media occupies no more than one third of the main content width and is clamped to a landscape aspect ratio.
- `Continue working` contains project/result records; `Activity & jobs` contains job/event state. The same record is not repeated in both merely as presentation filler.
- Every visible action navigates, opens a defined overlay, or performs an implemented operation.
- The page remains usable with zero projects, one project, long titles, failed thumbnails, and ten or more jobs.

### Focused workflows

- The primary input and action remain visible without scrolling at 1440x900.
- Optional controls start collapsed and remain keyboard reachable.
- The preview is the largest workspace region on desktop.
- History, selected result, variants, and jobs do not duplicate each other.
- Loading, empty, error, cancelled, and completed states have visible, non-overlapping treatments.
- At 390x844, regions become deliberate views/tabs or drawers; they are not simply stacked into an extremely long page.

### Verification gate

- Run TypeScript, style architecture, and relevant browser checks.
- Capture all target viewports after the final CSS build.
- Compare captures beside the approved references and record intentional deviations in this document.
- Do not mark a surface complete from DOM assertions alone.

## Implementation Progress

- Android Matrix relay audit (2026-08-10): Chat plus Image, Audio, Music, Video, and 3D generation use the Matrix relay job backend rather than the LAN pairing API. Image prompt improvement and whole/parts source interpretation now also have relay actions; the bot maps them to the dashboard text/vision endpoints and uses the existing Image permission. Image Studio uploads a selected source as a Matrix relay attachment for explicit interpretation and Image generation, so the remote workflow can interpret and use the reference. Video and 3D retain their explicit source-image workflows.
- Plaintext-room media is denied by default. Android persists a separate `allowUnencryptedMedia` choice only after a risk-confirmation dialog. The confirmed value travels with each relay request; the Matrix bot refuses to upload generated media or consume a plaintext source attachment without it. Encrypted Matrix rooms continue to work without this opt-in.
- Verification: Matrix bot JavaScript syntax checks and `:app:compileDebugKotlin :app:compileDebugJavaWithJavac` completed after the relay changes. A real-room smoke test is still required before release because it depends on the configured homeserver, bot, dashboard runtime, and room permissions.
- Matrix relay diagnostics record every correlated relay action and its completion/failure in the local bot admin event log. This operational logging distinguishes attachment, permission, dashboard, and Android result-binding failures during a live-device test.
- Matrix Image Studio prompt actions also emit a compact correlated `URAGE_PROMPT` text event before their general workflow result. Android accepts that exact bot-user/request pair directly into the Image prompt field, avoiding a dependency on opaque media-result payload decoding for prompt-only operations.
- LazyDev Home starts as the default AI landing surface and the original URage NOW overview remains available from the brand rail button.
- The August 2026 home revision removes the duplicated promotional Chat entry, keeps all six direct workflow choices, separates the active project from recent work, and promotes usage from small KPI sparklines to a large media-series trend graph backed by the same live history records. URage NOW uses a dominant Continue/Create/Recent command row and a supporting product strip so ultrawide viewports no longer end in an unused lower half.
- The LazyDev layout is isolated in `dashboard/src/styles/shared/_lazydev-home-layout.scss`, loaded after older home layers. This prevents further home-screen spacing overrides from accumulating in generic Studio styles.
- The approved directional references live in `docs/design/home-concepts/`. They are composition targets, not a license to hard-code their sample records; production surfaces must continue rendering real dashboard state.
- `scripts/check-home-command-centers-browser.mjs` verifies both home modes at 2560×1440 and 390×844, rejects horizontal overflow and excessive ultrawide gutters/lower gaps, asserts that the LazyDev chart renders real series, and confirms the named 3D LLM height action in the focused browser studio.
- Tilemap Creator's narrow dashboard sidebar now contains the Brush foldout instead of clipping it. Icon-first brush/action controls retain accessible names, tooltips, and shortcuts while avoiding letter-by-letter wrapped labels.
- 3D Studio exposes LLM real-life height scaling as a named preview quick action. Viewer, transform, and quick-action triggers share the same `data-model3d-llm-real-height-action` command path and reuse `/api/model3d-edit`; do not fork the LLM height workflow per control.
- Pixel Art Converter preview cards explicitly contain their canvases so large images and animated GIF frames cannot expand the comparison grid beyond the available dashboard tool viewport.
- Deleting the only remaining merged 3D artifact now deletes its model entry through the existing delete path. The API returns `deletedModelEntry` so every 3D UI surface can explain that the entry, rather than a still-selectable variant, was removed.
- Blender rotate/delight captures remain valid Home image outputs. New captures retain source-model metadata so a later ownership-aware cleanup can be implemented without suppressing legitimate capture results.
- Messenger publication feeds retain a local canonical JSON file. Discord scheduled image and 3D deliveries can additionally upload dashboard-owned assets to URageNet Media Library with a server-side application password; the feed records the returned permanent website URLs. Telegram/Matrix URL resolution and WhatsApp media automation remain explicit follow-up work in `docs/automation-published-media.md`.
- URageNet Media Library connection settings are owned by Automation → Website Feed. The URL and username persist locally; the application password is write-only and uses the native secret store rather than dashboard state, browser storage, or automation JSON.

## Next Implementation Slice

Do not start by polishing colors. First change the home information architecture and data mapping:

1. Introduce typed view models for resumable records and job/activity records so the two regions cannot silently share one undifferentiated array.
2. Replace the home hero search and promotional Chat card with the composer and workflow selector contract.
3. Bound featured media and implement the four-item supporting grid.
4. Add the `Activity & jobs` state component using the existing generation job store; only expose retry/cancel actions already supported by the runtime.
5. Add quick actions using existing routes, omitting any action whose route is not implemented.
6. Verify empty/loading/error/overflow states before visual polish.
