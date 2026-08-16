# Project Context

## 2026-08-15 — Imported glTF viewer sidecars

- The Three.js model viewer remaps GLTFLoader's same-origin absolute `/api/<sidecar>` URLs back to the selected model artifact, so imported glTF textures load through `/api/model3d-file`. The source model endpoint and external URLs are intentionally left unchanged.
- The viewer fog range now expands with the fitted model/camera distance. This prevents large-unit Sketchfab imports from being fogged to black after their correctly loaded texture is rendered.

## Execution terminology

- `workers/remote-worker` is the optional **remote execution worker**, not the default local work path. The dashboard/server process runs local workflow actions; Rust worker CLIs are invoked on demand for bounded native jobs. Start the separate worker only for `executionTarget: "remote"`, which may be a different machine or an intentionally isolated local environment.

## Rail layout contract

- Every expanded desktop rail category—including Bots—uses the same 224px rail width. Messenger children are subordinate 38px rail rows and must never trigger a narrower Bots-only navigation layout.

## Product identity

- The user-facing product name is **URage Now Studio**: `U` uses a neutral metallic gradient, `RAGE` inherits the active theme gradient, and `Now` adapts to the theme contrast. Internal runtime, package, and repository identifiers remain `URageStudio` until a compatibility-aware migration is explicitly planned.
- The standalone `URageStudioSite` static marketing page is intentionally product-accurate: it presents Studio workflows, generated-media handoff, local dashboard/optional worker boundaries, native tools, optional messengers, and the Android companion without claiming a hosted service, public release, or replacement for specialist DCC/game-engine software.
- The marketing site presents a **proposed** early-access price of **CHF 79 one-time**. It is not an active checkout or final commercial policy: provider/API fees, paid DCC/game-engine licenses, and hardware remain separate; payment, tax, refund, licensing, and update terms need explicit definition before sales open.

## 2026-07-31 — Messenger runtime readiness

- Matrix runtime health distinguishes a running admin process from a ready encrypted Matrix session. Dashboard sends fail fast with an actionable `503` when E2EE startup has failed instead of presenting a generic gateway error.
- Telegram workspace rendering now uses an injected controller, removing its accidental dependency on bootstrap-local functions.

## Local runtime control

- `npm run stop:dashboard` safely frees only the dashboard port (`4782`). `npm run stop:instances` covers the dashboard, messenger admin runtimes, and remote worker ports. Both refuse to terminate a listener unless its command line belongs to this repository.
- `/ready` represents the standalone dashboard runtime. Optional Discord, LLM, ComfyUI, and remote-worker outages are reported through `degraded`, `unavailableCapabilities`, and `checks` without returning a false service-level `503`.

## Game-engine asset catalog

- Unity, Godot, and Unreal package cards no longer depend on a developer-specific absolute checkout path. The dashboard transactionally caches `sysoutch/URage-Assets`, exposes package metadata through `/api/asset-catalog`, supports explicit refetch, and creates per-package ZIP downloads from the cached Git revision.
- Asset cards use semantically matched official Bootstrap Icons cached under dashboard assets. The redundant repository-source cards were removed; repository access remains available per package and through the catalog metadata.

## 3D-suite script catalog

- The 3D Suites Scripts tab independently renders the cached `sysoutch/URage-Blender-Scripts` catalog, with explicit refetch and package download routes. Its panel is a sibling of Projects and Addons so tab selection cannot accidentally hide it with the Addons parent. Other suite script sources intentionally remain a clear coming-soon state until curated repositories exist.
- Root-level `maya-scripts`, `3dsmax-scripts`, `houdini-scripts`, and `cinema4d-scripts` provide suite-native starter collections with matching `catalog.json` manifests. They are intentionally local source trees for now: do not advertise invented remote repositories until curated GitHub sources exist.

## Studio destination controls

- Image Studio uses the same mounted `Send To ...` overlay pattern as 3D Studio. Tool selection, game-engine import, and Blender image-plane import are grouped into destination tabs rather than scattered preview-toolbar controls. Video preset and generation states use shared Studio accent tokens rather than the legacy blue/orange palette.

## Repo Summary

- **Project:** URageStudio — unified local platform for AI generation, 3D workflows, and messenger bots
- **Current stack:** TypeScript/Node.js (primary), Java/Maven (legacy Discord bot), Rust (native workers)
- **Main entrypoint (legacy):** `src/main/java/ch/sysout/uragediscordbot/App.java` — Java Discord4J bot
- **Migration target:** `bots/discord-bot/` — Discord.js + TypeScript, parallel migration in progress
- **Dashboard:** `dashboard/src/` — standalone dashboard UI source, separate from bot folders
- **Server:** `server/src/` — neutral server services (generation, media, config, LLM) shared by bots and dashboard
- **Shared:** `shared/src/` owns TypeScript contracts; `shared/SOUL.md` and `shared/USER.md` own Chat Studio personality and durable user notes
- **Workers:** `workers/rust/` — native Rust workspace (`media-probe`, `asset-validator`, `asset-indexer`)
- **Data root:** `data/` — generated images/models/audio/video, dashboard settings, text sources

## Architecture Overview

```text
.
├── bots/                    # Messenger bot runtimes
│   ├── discord-bot/         # Primary runtime (Discord + dashboard server)
│   ├── telegram-bot/        # Telegram runtime
│   ├── matrix-bot/          # Matrix runtime
│   └── whatsapp-bot/        # WhatsApp runtime
├── dashboard/src/           # Dashboard UI source (SCSS, TypeScript, HTML)
├── server/src/              # Neutral server services (generation, media, config)
├── shared/                  # Shared contracts and Chat Studio personality/user notes
├── workers/rust/            # Native Rust worker workspace
├── comfyui-workflows/       # ComfyUI workflow JSONs by category
├── blender-scripts/         # Blender automation scripts
├── tools/                   # HTML-based web tools
└── data/                    # Runtime data (generated media, settings)
```

**Service boundaries:**
- `server/src/services/*` owns all non-Discord server logic: generation facade, image/audio/video generation, model3d, LLM execution, config, resource pools, media probe, remote worker client
- `shared/src/` owns TypeScript contracts only — no runtime dependencies on Discord or bot packages
- `bots/discord-bot/src/` owns Discord-specific event handling, slash commands, interaction routing

## Current State

### Node Migration Status
- `bots/discord-bot/` has working TypeScript build and typecheck scripts
- Root `package.json` is the npm workspace and runtime tooling host; installs, TypeScript builds, dashboard/worker launchers, and process working directories no longer depend on `bots/discord-bot`
- `dashboard`, `server`, `shared`, and Discord are root npm workspaces with one lockfile; architecture and repository-path checks run through root `npm run check`
- Shared/server/dashboard/worker dependency direction is enforced, and repository paths are source-anchored through `shared/src/runtime/repositoryPaths.ts`
- `/help`, `/gift`, `/humble`, `/ask`, `/say`, `/dm`, `/ping`, `/video` are implemented in the Node bot
- Admin text commands: `!ask`, `!say`, `!dm`, `!gift`, `!humble`, `!ping` wired in Node bot
- Humble bundle scraping works; Unity gift scraping fails gracefully on 404
- Ollama connectivity verified locally with `qwen3-coder:30b`
- Secret handling moved from repo `.env` files toward password-gated `runas` bridge
- Dashboard app source separated at `dashboard/src/`, builds through root `tsconfig.dashboard.json`

### Rust Worker Status
- `workers/rust/crates/media-probe` — returns real image/audio/video metadata (dimensions, codec, duration, frame count)
- `workers/rust/crates/asset-validator` — converts inspection data into structured validation errors/warnings
- `workers/rust/crates/asset-indexer` — indexes generated models into deterministic artifact manifests

### Dashboard Status
- Bootstrap 5.3 integrated through SCSS bridge (token-first, not a design reset)
- Client bootstrap reduced from ~2280 lines to ~700 lines via modular helper extraction
- CSS reorganized into folder-based modules (`shell/`, `navigation/`, `studio/`, `messenger/`, `shared/`)
- Tauri v2 desktop shell exists at `src-tauri/` — intermediate wrapper around local dashboard server

### Android Matrix Relay Reliability

- Matrix timeline listeners are a native Rust-SDK callback boundary. Relay result failures and timeline parsing errors must be converted to coroutine failures inside the listener; they must never throw out of `TimelineListener.onUpdate`, because that can terminate the Android process rather than surface an in-app error.
- Chat synchronization snapshots listener-collected timeline items under a lock after cancellation, avoiding concurrent mutation while the UI is rebuilding the conversation.
- Sent Matrix messages retain their SDK send handle until the correlated workflow result or failure is received, then release it deterministically.
- `:app:compileDebugKotlin` requires Java 11+. On this development machine use Android Studio JBR (`C:\Program Files\Android\Android Studio\jbr`) instead of the system Java 8 runtime.
- Android companion release `0.14.22` (version code `38`) is built as signed arm64-v8a, armeabi-v7a, x86_64, and universal APKs plus an AAB in `data/android-releases`. The universal APK SHA-256 is `a9bdc35b1574351fab76c1a67b2c6c1bd5dc8d542a50f3a54886e70f215050fe`.
- The published Matrix Rust SDK Android AAR (including `26.07.28`) uses `rustls-platform-verifier` but exposes no Android JNI initializer for its process-global verifier. Do not work around the resulting `Expect rustls-platform-verifier to be initialized` error with `disableSslVerification()`: that would make encrypted Matrix credentials and traffic vulnerable. The safe repair requires a custom SDK build with an Android startup bridge that calls the verifier’s `init_hosted`/`init_with_env` before Matrix networking begins.
- The custom SDK build also requires `rustls-platform-verifier-android.aar`, the Android TrustManager bridge bundled by the Rust dependency. A local SDK AAR does not preserve Maven transitive metadata, so omitting this bridge produces `failed to call native verifier` even when startup initialization is correct.
- Android companion `0.14.22` (version code `38`) fixes the custom ARM64 SDK startup order: `init_platform` now forces and enters its Tokio runtime before calling Android's `rustls-platform-verifier::init_hosted`. Calling the verifier after only registering the lazy runtime builder caused the exact `there is no reactor running, must be called from the context of a Tokio 1.x runtime` failure.
- Device verification showed `0.14.22` / code `38` can still raise that reactor error. The next native AAR must run Android verifier setup within `Tokio::Handle.block_on(...)` (not merely `Handle::enter()`), which forces a live reactor; rebuilding this corrected local Matrix SDK source requires an installed Android NDK.
- Android companion `0.14.23` (version code `39`) contains the rebuilt ARM64 Matrix SDK AAR with that forced Tokio reactor startup. Install `data/android-releases/urage-companion-v0.14.23-arm64-v8a.apk` on physical ARM64 phones; the other ABI APKs retain the prior native SDK until each ABI is rebuilt.
- Before a distributed Android build, run `npm run version:android -- <patch|minor|major|prerelease|x.y.z>`. It updates the semantic name and Android's monotonic build code together; use `--dry-run` to preview. Do not invoke it merely for local debug builds, because version codes are intentionally never reused.
- Android release shrinking is disabled because Matrix Rust SDK initializes JNA through native lookup of several literal Java members (including `Pointer.peer`, `Native.dispose()`, and `Native.fromNative(Class, Object)`). Maintaining an incomplete R8 allowlist caused sequential `UnsatisfiedLinkError` crashes. Release `0.14.8` / code `24` ships unminified and its final DEX verifies those names directly. The universal artifact grows by roughly 12 MiB, a deliberate reliability tradeoff.
- Matrix companion sessions use the SDK compatibility sync mode (`SlidingSyncVersion.NONE`) and standard `/sync`, not the SDK's Sliding-Sync room-list service. The companion first runs an immediate `syncOnceV2` to populate its local room store, then starts the long-poll `syncV2` loop. This avoids the old race where a 30-second first long-poll request outlasted a 20-second `getRoom` retry, so the user account never reached `Timeline.send()`. Before the SDK starts, the app also verifies the token account is actually joined to the configured canonical room ID via `/joined_rooms`; wrong tokens or rooms report that configuration problem directly.
- The Matrix relay protocol has an immediate acknowledgement: the bot emits ordered `URAGE_PROGRESS` sequence `0` as soon as it accepts an allowed request. Android waits 30 seconds for that acknowledgement before returning a clear Matrix Runtime/bot-token diagnostic, then retains the longer workflow timeout for actual generation. The Android access token and the bot access token are intentionally distinct accounts.

### Dashboard Messenger And Rail Contracts

### Studio Workflow Surface

- Focused Image, 3D, Audio, Music, and Video forms share the `studio-step-card` surface treatment: a single visual hierarchy for ordered input cards, primary actions, and compact advanced controls. Keep generic styling in `styles/studio/_focused-workflow.scss`; reserve `media-ai/_workflow-active.scss` for workflow-specific behavior.
- The 3D Texture tab is intentionally a two-step form (one model, then one source image). Blender adjustments and low-poly conversion are optional collapsed sections, so they must not visually compete with the Texture model action.
- Use the existing `renderButtonIcon` system for workflow headings: texture steps use cube/image icons and optional 3D foldouts use settings/box icons. Avoid text-only headings when the workflow navigation already uses recognizable icons.
- The focused 3D active panel itself is the left-column scroll surface. Keep its final full-height `flex`/`overflow-y: auto` rules in `styles/studio/_focused-workflow-model3d.scss`, after compatibility shell styles; otherwise those older rules shrink the scrollbar to the content height.
- The focused AI shell must establish `100dvh` at `.content-shell` and the active AI view in `styles/studio/_focused-shell.scss`. Percentage-only heights collapse when a parent is content-sized, producing the large blank lower viewport visible in all studio columns.
- The focused `.app-shell` must also have explicit `100dvh`; without it, even correctly sized descendants collapse to content height and clip the lower Edit workflow sections such as Low-poly conversion.
- The 3D detail card is the final sizing authority for the focused editor and explicitly uses `100dvh` in `styles/studio/_focused-workflow-model3d.scss`. This protects the canvas, history dock, inspector, and Edit form from legacy percentage-height layout rules.

- Browser-bootstrap fragments must not call helpers declared in a different assembly scope. Telegram chat rendering now owns its selected-chat lookup locally, so a Telegram refresh cannot abort later Matrix runtime rendering.
- Messenger runtime labels derive from the selected messenger after every selection change. If a label remains stale, first fix the earlier selection/render exception instead of adding a competing runtime panel.
- Messenger selection now renders the selected runtime panel before optional messenger-specific refresh work. Telegram chat discovery remains Telegram-only; Matrix and WhatsApp selection cannot be delayed or broken by a Telegram view renderer.
- Matrix room discovery is owned by the Matrix runtime, not the browser. The runtime exposes joined rooms plus `m.space.parent`/`m.space.child` relationships; the shared left rail renders spaces with nested joined rooms and a separate ungrouped-room section. An offline Matrix runtime correctly yields the explicit no-rooms state rather than pretending browser room membership can be queried.
- Default Matrix launches source the access token from the native secret store but leave non-secret homeserver and bot identity settings to `bots/matrix-bot/.env`. The dashboard must not require the homeserver URL twice: that previously rejected an otherwise valid default launch before the bot could start.
- Matrix crypto state is account-bound. An SDK diagnostic such as “account in the store doesn’t match” means `MATRIX_BOT_USER_ID`, the access token, and `MATRIX_STATE_DIRECTORY` identify different accounts/devices; do not delete old stores blindly. Correct the bot ID first. If a clean bot store then conflicts with already-registered one-time keys, rotate/re-login the bot account’s device/token in a Matrix client before restarting the runtime, then verify the new E2EE device in encrypted rooms.
- Android Matrix relay commands must enable the Rust SDK room send queue before `Timeline.send()`. The send API returns a local handle; without `room.enableSendQueue(true)`, a command can remain on-device and never appear in Element or reach the Matrix bot.
- Android observes the outbound command's timeline send state before waiting for the bot acknowledgement. A command that remains local or is rejected by the homeserver reports a transport-specific failure instead of looking like a bot timeout.

### Android desktop-application handoff

- The Android companion also has a standalone repository at `https://github.com/sysoutch/urage-now-android-companion`. The dashboard's GitHub download fallback targets that repository's Releases page, while locally built signed APKs continue to be served from the dashboard data directory. Tagging `v<version.properties VERSION_NAME>` runs its dedicated GitHub Action to build signed ABI APKs and an AAB, checksum them, and publish a Release; it requires the Base64 keystore plus four `ANDROID_RELEASE_*` repository secrets. Its independent `.gitignore` excludes Gradle/IDE state, builds, local SDK configuration, signing material, and local Matrix state; `.gitattributes` retains the Gradle wrapper and marks distribution/media binaries correctly.
- The companion repository owns `assets/branding/urage-now-android-companion-banner.png` and `assets/branding/urage-now-android-companion-icon.png`. The latter is also wired through Android adaptive-icon XML resources and verified with `:app:processDebugResources` using JDK 17.
- A phone cannot launch Bambu Studio. `POST /api/companion/model3d/print-applications/launch` is an audited, paired-device capability (`application.3d-print.launch`) that resolves a **dashboard-generated** model on the dashboard host and launches the host's allowlisted Bambu Studio process.
- The Gallery long-press action and completed 3D Studio result use the same `DashboardApi.openModelInBambuStudio` client method. The capability defaults off and is only meaningful on the direct LAN/HTTPS dashboard route; Matrix relay media deliberately does not grant host process control.

### Dashboard rail hierarchy

- Expanded category cards are always 56px; their destination rows are always 38px with shared 13px/700 text and 18px icons. Child media/category colors flow solely through `--rail-icon-color`; local legacy icon containers, borders, and font scales are explicitly neutralized in `_rail-category-cards.scss` so Tools, 3D Suites, Game Engines, Bots, and LazyDev cannot drift apart.
- The light dashboard theme intentionally overrides the dark rail's near-black metallic card base: category cards use quiet white/blue paper surfaces, lower-contrast borders and shadows, while colored accents remain reserved for the left strip, icon, and chevron.
- Settings Setup owns one `Messengers` subtab and one Messenger Startup panel. Expanded rail child color tokens must use `!important` because a legacy late rail layer still establishes a generic important fallback; this preserves per-workflow, suite, engine, and messenger colors without duplicating markup.
- Bots is a flat messenger switcher rather than a hierarchical child tree: its expanded rows intentionally omit the vertical guide and horizontal connector strokes used by nested workflow/tool groups.
- The URage Now home card never uses the legacy hardcoded fire-orange rail token. Its card accent and legacy icon token resolve from the active dashboard theme, while the wordmark retains its separate metallic `U`, themed `RAGE`, and contrast-aware `Now` treatment.
- Tools header actions are a single horizontal icon-first action rail. Labels expand on hover or keyboard focus; touch devices retain labels and horizontally scroll the compact rail if required, so Add, Edit, and Categories/Tags remain discoverable and do not collapse into a misleading vertical menu.
- Android's sandboxed local model viewer accepts GLB and FBX, including the Three.js FBX/NURBS/zip-loader dependency chain served only from the private in-app origin. Unsupported formats are routed to a compact handoff panel before a WebView is created; preview dialogs use a bounded 70%-screen/560dp viewport and wrap their window rather than leaving a fullscreen error viewport.
- Android release `0.14.17` (version code 33) packages that FBX preview and dialog correction; the dashboard release distributor reads `data/android-releases/latest.json` to offer it after the dashboard runtime reloads.
- Expanded rail category headers are flush; child-group padding may not create faux gaps between category cards. Category chevrons use the locally served Bootstrap Icons font rather than escaped text glyphs.

### Unity Integration Status
- Imported Resources Pool: Unity editor window for dashboard media import (Image, 3D Model, Video, Audio, Music)
- LazyDevPro: Unity runtime bridge to dashboard APIs (ask, image-generate, model3d-generate, audio/music generate, TTS/STT)
- Godot addon exists at `integrations/godot/imported_resources_pool/addons/urage_imported_resources_pool/`

## Known Risks and Debt

1. **Runtime composition ownership** — Root tooling and working-directory ownership are now neutral, but the combined dashboard/messenger composition entrypoint still lives in `bots/discord-bot/src/index.ts`. Future: extract a neutral runtime composition module while keeping Discord event handling in the bot adapter.
2. **Bot-owned image services** — `imageSanitizer.ts`, `model3d/capture.ts`, `model3d/previewMedia.ts` intentionally remain bot-hosted because they depend on `sharp`, installed only in the bot package. This is documented dependency-boundary debt.
3. **Remote ownership** — `main` tracks the `origin` GitHub repository. Keep commits scoped and reviewable before publishing because the worktree can contain several concurrent feature areas.
4. **Hardcoded Windows paths** — Several workflow paths are hardcoded to Windows absolute paths.
5. **Java bot fallback** — Java bot remains as fallback until Node parity is achieved for all features.

See `memory-bank/architecture-cleanup-roadmap.md` for the phased package-boundary and runtime-structure plan.

## Dashboard Backlog (Unfinished)

- Richer welcome flow: embed builder, button/CTA support, test-send preview, separate join/leave messages
- Fuller role administration: bulk role presets, reaction-role tooling, role CRUD
- Moderation dashboard: per-guild allowlists, review queue for spam events, mute/ban/kick tools
- Automation system: additional event triggers, chained actions, automation history UI, timezone selection
- Community management: autoroles, verification onboarding, ticket/support tools, announcement composer

## Reliability And Safety Priorities

- Anti-pwning the bot: first-class design concern. Avoid polling patterns that spam Discord APIs. Prefer cache-first reads for guild metadata. Gate high-volume/moderator-sensitive actions behind explicit user intent. Treat LLM-driven actions as potentially risky with confirmation/throttling paths available.
- Rate-limit safety: handle gracefully with backoff/retry, avoid burst replays, keep logs clear about delayed/skipped items.

## Technical Notes

- Matrix room discovery and E2EE send readiness are distinct: `/joined_rooms` can populate the dashboard even when the bot cannot send. A health error reporting an existing signed one-time key means the local Matrix crypto device state and homeserver registration disagree. Stop duplicate runtimes, rotate/re-login the bot device/token, then restart with the matching state directory; do not merely suppress the readiness guard or delete state blindly.
- `scripts/repair-matrix-bot-session.ps1` is the local, interactive repair path for an existing Synapse-administered Matrix bot. It never prints the replacement token, which is stored under `matrix.default.access-token` for the current Windows user. `show-matrix-bot-token.ps1` intentionally reveals that token only after the operator types `PRINT`.
- Dashboard-managed ComfyUI launchers open in a visible, dedicated terminal. Stopping waits for `taskkill /T /F` and the process exit before reporting success; a stop failure stays visible to the UI rather than becoming a false stopped state. Ctrl+C in the ComfyUI terminal can interrupt the active Python process.
- Tools has distinct Browser, Desktop, and Mobile modes. Mobile recommendations link to installable release pages and their source repositories; the first example is the standalone URage Now Android Companion repository.
- Image Studio and 3D Model Studio share the `studio-send-destination-*` overlay presentation contract. Their workflow-specific IDs and `data-*-send-*` attributes remain separate for behavior, but dialog and runtime backdrop classes must stay shared; a partial rename leaves the actions wired while stripping fixed overlay positioning and visibility styling.
- In 3D Suites > Addons, the executable picker follows the selected suite and persists the selection per suite in browser storage. Blender uses that path for real addon inspection/install actions; 3ds Max, Houdini, and Cinema 4D currently provide discovery and persisted selection only, until each has a suite-native addon adapter.
- Android Companion phone and tablet navigation uses one persistent 92dp LazyDev left sidebar. It owns Home, Gallery, workflow, Tools, and Connection routing while `WorkflowJobRailBinder` independently supplies job badges. The old horizontally scrolling phone bottom rail is no longer part of the shell.
- Android Tools is server-backed rather than bundled: `GET /api/companion/tools` exposes the live catalog and the paired-device-only tool-file endpoint serves WebView subresources. `ToolsWorkspaceController` owns category tabs, catalog cards, and the constrained WebView. The new `tools.browse` permission defaults off because opening a tool executes server-provided JavaScript.
- Android Companion release `0.14.24` (version code 40, ARM64) explicitly closes the Matrix SDK `Sync`, `Timeline`, `Room`, and `Client` handles in `MatrixSdkRelayClient.withSession`. The previous code left `Timeline` and `Room` to UniFFI's Android Cleaner, which invoked `Room`'s Rust destructor on `FinalizerDaemon` without a Tokio runtime and caused the `no reactor running` / poisoned-lock crash. Keep this deterministic destruction order when changing Matrix session ownership.
- Android Companion release `0.14.25` (version code 41, ARM64) sends Chat prompts as readable `!ask <prompt>` events and waits for the normal bot reply. `!urage` remains only for attachment-producing workflows. The Matrix bot must be restarted after this change so its new `!ask` route is active.
- Android Companion release `0.14.26` (version code 42, ARM64) snapshots normal bot replies before sending `!ask`. Timeline replay can contain an earlier `Chat Studio failed` response; the live request must ignore that stale body and wait for the newly-arrived answer.
- Android Companion release `0.14.27` (version code 43, ARM64) reduces the stale-reply snapshot from three seconds to 150ms and removes the redundant `/joined_rooms` request; initial SDK sync already verifies that the configured room is available. Long direct `!ask` replies over 3,500 characters are delivered by the bot as a compact preview plus an encrypted UTF-8 `.txt` attachment.
- Android Companion release `0.14.28` (version code 44, ARM64) reuses the verified Matrix identity and persisted room store on subsequent sends, avoiding redundant `/whoami` and initial-sync requests. Chat waits for and decrypts the bot's `.txt` attachment when a long-response preview names one. The composer uses square icon actions: send is `➤`, while `⋮` opens Sync and Clear in a popup.
- Android Companion release `0.14.29` (version code 45, ARM64) makes Chat a fixed vertical workspace: only the transcript scrolls, while the composer dock remains at the bottom. The redundant message-field helper text was removed.
- Android Companion release `0.14.30` (version code 46, ARM64) gives every workspace header its matching local rail icon (Gallery, Chat, Image, 3D, Audio, Music, Video, and Connection) through `MobileUiKit`; individual studios no longer need hand-maintained icon variants.
- Android Companion release `0.14.31` (version code 47, ARM64) makes Chat optimistic: the user bubble appears and the composer clears immediately. A lifecycle-aware, theme-coloured three-dot wave occupies the assistant bubble until streaming text arrives. The redundant Live Markdown Preview and permanent Connect helper surfaces were removed; shared action buttons now receive icons from the local workflow icon set where their label has a clear semantic match.
- Android Companion release `0.14.32` (version code 48, ARM64) adds an animated, palette-aware halftone Image Studio placeholder while an image job is running. Completed Image Studio images and Gallery image overlays now offer one shared “Generate 3D Model” handoff that selects the image in 3D Studio before navigating there.
- Android Companion release `0.14.33` (version code 49, ARM64) moves the global Companion header into a dedicated Home workspace with welcome, connection status, and shortcuts. Workflow tabs now use the full content height. Chat bubbles are the intentional rounded exception to the square-control system, and the animated thinking surface is taller with larger wave dots.
- Android Companion release `0.14.34` (version code 50, ARM64) adds a compact overflow selector alongside the 3D result's BambuLab action. It exposes `Send to BambuLab` (the existing safe dashboard-host Bambu Studio launch) and `Send to BambuLab + Print`. The latter intentionally reports setup is required: no printer transport, slicing preset, or printer credentials are configured in URage yet, so it must never imply that a physical print started.
- Android Companion release `0.14.35` (version code 51, ARM64) keeps Image Studio's animated generation placeholder authoritative while its newest image job is queued, running, or downloading. The presenter no longer replaces it with an older completed image; the result surface follows the Generate button and is brought into view when a job starts.
- Android Companion release `0.14.36` (version code 52, ARM64) lets the 3D result's BambuLab action use its paired dashboard connection even while Chat workflows are routed through Matrix. Matrix is a workflow relay, not the desktop Bambu Studio host; the action now correctly targets the paired dashboard and reports a missing pairing or dashboard authorization error instead of silently declining.
- Android Companion release `0.14.37` (version code 53, ARM64) makes the 3D BambuLab action observable in-place: the result card shows send, success, or the exact dashboard error and prevents duplicate taps while the request is active. `URageBambuLab` logcat entries record the model launch request and outcome for device-side diagnostics.
- Android Companion release `0.14.38` (version code 54, ARM64) treats Matrix chat replies as final timeline events rather than replaying the complete reply through its streaming callback. The companion keeps its thinking bubble while a Matrix reply (including an attached `.txt`) arrives, then renders it once as the final bubble. Persisted chat entries are capped at 24,000 characters while the current in-memory reply remains intact, reducing long-reply crash risk.
- Android Companion release `0.14.39` (version code 55, ARM64) replaces the mobile bottom navigation with a persistent LazyDev sidebar and adds a live, permission-gated Tools workspace. The workspace obtains categories and tool content from the paired dashboard rather than a hard-coded client catalog; enable `tools.browse` for the paired device to use it.
- Android Companion release `0.14.40` (version code 56, ARM64) fixes a production crash in the Tools workspace: some Android WebView callbacks supply a URI without a path, so tool-resource interception now validates the nullable encoded path before deciding whether to proxy it through the paired dashboard.
- Android Companion release `0.14.41` (version code 57, ARM64) gives the server-backed Tools catalog optional real thumbnail covers plus a themed fallback, adds an external-browser handoff without leaking the paired-device token, and implements Android's native `WebChromeClient` file chooser for every HTML tool file input. Color Palette Extractor and the other image tools can now open Android's document picker.
- Tool covers are now complete: catalog entries use their tool-local `thumbnail.(png|jpg|jpeg|webp)` where available and otherwise use `tools/shared/tool-cover.png`, the generated shared creative-workbench raster cover. The verified catalog has 57 tools, 26 specific thumbnails, 31 shared-image fallbacks, and no missing cover path.
- Run `node scripts/audit-tool-screenshots.mjs http://127.0.0.1:4782 <output-dir>` for tool visual QA. It opens every catalogued tool at 390px and 1440px, saves a screenshot for each viewport, and fails on page-load failure or horizontal overflow. The verified 2026-08-09 pass captured all 114 pages with zero failures, zero overflow, and zero console errors. The runner retries a single transient navigation reset; persistent failures remain visible in `report.json`.
- Dashboard Image Studio uses the same generation-state contract as Android: `setImagePreviewLoading(true)` marks the preview busy and exposes a labeled animated halftone placeholder. The placeholder overlays all preview-media types until the existing generation orchestration finishes, so an old image or GIF frame cannot remain visible during a new request.
- Matrix room rules live in `data/matrix-workflow-permissions.json`. They are inactive unless an administrator explicitly enables member access and selects workflows. The bot reloads this config for each command. Direct `!ask`/`!chat` failures must be posted back to the room as `Chat Studio failed: …`; never leave the companion waiting with an error only in the bot process log.
- The Matrix bot reads the dashboard access token from the same native-keyring entry (`dashboard.default.access-token`) as the dashboard. `DASHBOARD_ACCESS_TOKEN` remains an optional explicit runtime override; do not require a duplicate plaintext token in `bots/matrix-bot/.env`.
- If that keyring entry is unavailable, the Matrix bot obtains the current token only from the dashboard's existing loopback-only access-token endpoint and retains it in process memory. This keeps Matrix workflow calls authorized without writing another token file.
- Settings > Setup > ComfyUI owns the local ComfyUI runtime configuration. It saves an explicit launcher batch and working directory in `data/comfyui-runtime.json`, can start/stop that tracked process, and creates non-destructive `run_urage_*.bat` presets in an existing ComfyUI launcher folder. Existing user batches are never overwritten.
- Messenger pages use `dashboard/src/styles/shared/_messenger-studio-theme-contract.scss` for shared Studio surfaces, controls, fields, and typography. Messenger-specific colours are reserved for identity and semantic status only; do not reintroduce Discord-era page palettes in individual messenger views.
- Expanded dashboard rails use a content-first flex rail rather than legacy spacer grid rows. On non-AI routes, `.rail-studio-workflows` is removed from layout rather than merely collapsed, preventing its invisible rows from creating a false LazyDev-to-Tools gap. The home/content wrap gets remaining height across Studio, Tools, and every Messenger route (including legacy `messaging`).
- The desktop rail has two intentional navigation modes: compact keeps every header, workflow, resource child, and bottom action as a labelled icon; expanded is one continuous flat navigation list with coloured icons. Expanded parent rows have no idle border, radius, fill, or inter-section margin; hover/active state uses only a faint tint and thin inset accent. Child groups attach directly beneath their parent with a subtle connector line. Theme choices live in the single semantic `details.rail-theme-picker`, so the rail shows one compact Theme row until deliberately expanded. Expanded child containers must opt out of flex shrinking and legacy fixed max-heights; otherwise long category lists overlap the following section. Keep these rules in `shared/_compact-rail-navigation.scss` and `shared/_expanded-rail-navigation.scss`, loaded after legacy rail styles.
- The URage NOW overview's six workflow tiles are native full-card buttons carrying `data-ai-scroll-target`; do not put a second corner action inside them. This keeps the whole card clickable and preserves the shared Studio focus routing for mouse and keyboard users.
- URage NOW Home is the top-level Studio overview, not LazyDev Home. Returning to it clears the persisted/hovered LazyDev rail group, allowing the existing `studio-home-active` visibility contract to collapse workflow children. Its Tools, 3D Suites, Game Engines, and Bots feature art reuses the same icon renderers and colour tokens as the expanded rail.
- The non-AI rail-gap guard must exclude the active or leaving `workflow` hover state. Otherwise `Temp Expand` can set the correct LazyDev hover group but a later `display: none !important` still prevents its workflow list from appearing.
- The final rail invariant lives at the end of `dashboard/src/styles.scss`: outside AI, the direct workflow-list child of `.rail-home-wrap` is forcibly `display: none` with zero dimensions. This is intentionally more specific than old Studio layers because those layers reintroduced a 221px collapsed grid track in the expanded Tools rail.
- Dashboard Image Studio's focus viewer gets GIF history through `latestMediaViewHelpers.getLatestGifEntries()`; it must not reach into that module's private closure. Its loading state uses one full-area halftone placeholder; the obsolete pseudo-element sweep overlay was removed so no second panel slides across the preview.
- The public URage.net Sketchfab preview can hand a selected model to a locally installed dashboard with `urage-now://import?source=sketchfab&uid=…`. `scripts/register-urage-now-protocol.cmd` registers that user-level Windows protocol; `scripts/open-urage-now-link.ps1` validates the URI and opens the configured `URAGE_DASHBOARD_URL` (loopback by default), constructing its query once so it never produces malformed repeated `?` prefixes. The website administrator explicitly caches downloadable Sketchfab archives from Admin → Site Ops. Browser handoffs only issue a single-use five-minute grant to that server-cached archive; they must never fetch from Sketchfab during a client import. The dashboard accepts only that URage.net grant endpoint, downloads and extracts it with Windows `tar.exe`, validates the first supported mesh, preserves local sidecars, and stores it through `importUploadedSourceModel`. Do not weaken the origin, one-time grant, cached-archive prerequisite, size limit, or supported-format checks into a generic URL importer.
- The archive-cache request authenticates a Sketchfab personal API token with `Authorization: Token …`, not `Bearer …`. Archive cache failures include their first concrete upstream failure in the Admin → Site Ops result. A public preview shows `Cache required` until the respective server archive exists; do not leave a disabled generic import label with no explanation.
- Website/Sketchfab imports use the same preview contract as generated models: `importUploadedSourceModel` renders preview PNG/GIF media after persisting the model and sidecars. `RenderModelPreview.py` flattens glTF parent transforms and dynamically frames the final world bounds; fixed camera positions leave Sketchfab-scale assets invisible. The browser viewer must likewise reset to the newly selected asset's fitted camera rather than restoring the prior asset's camera state, preserve authored PBR material values by default, and only force full metalness when the explicit Metal control is enabled. Imported glTF sidecars arrive at Three.js as `/api/...`-relative paths, so the loading-manager resolver strips that endpoint prefix before requesting the model-local resource. A fresh URage.net handoff replaces an existing import overlay when its grant differs. On the website, the reusable catalog dialog button must clear its cached `protocolUrl` whenever a different model is opened; otherwise it replays the prior model's already-consumed five-minute grant.
- Settings > Network > Connection exposes `Enable URage NOW links`, which invokes only the repository-owned user-level protocol registration script. Embedded tools with `data-dashboard-sidebar-externalized="true"` must have document scrolling restored by `tools/shared/css/sidebar-scrollview.css`; standalone tools retain their fixed viewport/own sidebar behavior.
- Settings also exposes `Test URage NOW link`, which launches a harmless protocol request with no download grant. It isolates Windows registration and dashboard query handling from the website/OAuth grant path; the expected result is the Import from URage.net overlay with the import action disabled.
- The 3D `Send Model To …` Game Engine tab queues the selected current mesh directly from that panel. It owns the engine/title form and posts one `model3d` entry to `/api/game-engine-export`; do not re-bind `model3d-send-to-game-engine-button` through the generic Game Engine overlay, or the UI regresses to a second modal.
- Sidebar Behaviour offers `Collapse+Expand (keep others)` as one persisted hover-mode choice. It preserves all rail accordion groups instead of hiding non-hovered sections, and a repeated click on an already-open category collapses that category.
- Network Settings distinguishes this PC, another PC on the same network, and Internet hosting. Internet mode is operational only with an HTTPS public URL, an access token, and a nonempty client/IP/CIDR allowlist; the operator must still provide a reverse proxy or managed host, certificate, firewall, and network routing.
- Legacy Java bot token is hardcoded in `App.java` — should move to environment config
- 3D Studio Edit textures exactly one mesh with exactly one source image through `comfyui-workflows/3d/3dmodel_edit.json`. The two mesh choices are mutually exclusive (history selection or upload); node overrides remain at `/api/model3d-texture` so standard image-to-3D generation keeps its configured workflow contract.
- The Comfy 3D Texture upload contract is aligned with its model loader: OBJ, GLB, GLTF, STL, 3MF, and PLY. Keep the dashboard picker and `stageMeshInputForComfy` validation in sync.
- Audio Studio TTS retrieves Kokoro voice options live from the configured audio ComfyUI server's `/object_info` `KokoroSpeaker.speaker_name` choices. Do not maintain a dashboard-side voice list; it must reflect the installed node and voice pack.
- Android Chat Studio microphone capture starts its STT handoff automatically on stop by default, while Chat Studio settings can keep it attached until Send. On Matrix, the companion uploads it as an encrypted `URAGE_AUDIO_SOURCE` attachment and invokes correlated `stt`; the Matrix bot consumes that attachment once, calls `/api/speech-stt` (the `comfyui-workflows/audio/stt/stt.json` workflow), and returns the transcript to the composer. On LAN, it uses the paired-device `/api/companion/workflows/stt` endpoint. Image whole/parts interpretation explicitly selects and focuses the Image Studio prompt after receiving the correlated bot response. Those reference images are interpretation-only: Image generation submits its prompt/options without re-uploading a selected image through Matrix.
- Chat Studio defaults to keeping a completed voice transcript in the composer for editing. The three-dot menu has **Chat Studio settings**, where users can opt into automatic transcript sending as a chat message.
- The browser Chat Studio composer keeps its attachment actions in a single icon-only **Upload** menu to the left of the message field. Record Audio is an icon-only action beside Send on the right; the existing Game Engine handoff remains available there as an icon action.
- Browser Chat Studio microphone recordings are held in the shared composer attachment tray until Send. Sending transcribes them with the dashboard STT workflow and retains an audio player on the resulting user message.
- The browser composer uses a compact message hierarchy: fixed 56px upload/utility controls are bottom-aligned around a 168px minimum textarea, keeping the controls out of the input's vertical reading area.
- The Chat Studio upload dropdown establishes its own high composer-layer stacking context so it always overlays the prompt presets and send settings.
- Android Image Studio consumes the correlated `URAGE_PROMPT` event as the completed interpretation text, then fills and focuses the Image Studio prompt. The later `URAGE_RESULT` is only the protocol completion record.
- A correlated Matrix bot prompt, progress event, or result also proves that the homeserver accepted the outbound command. Treat it as delivery in addition to the SDK self-event send-state; otherwise a source interpretation can receive its text yet never return to the Android UI callback.
- Android Home must use `MobileUiKit` palette values rather than its own color literals; the kit follows the paired dashboard's `/api/companion/theme` selection and recreates the activity when that selection changes. LazyDev Home's usage renderer requires both `lazydev-home-usage-overview` and `lazydev-home-usage-range` markup to be present.
- Studio workflow sidebars use rounded `studio-step-card` surfaces with a subtle shared depth treatment. The 3D Texture tab is the reference layout: ordered input steps, one full-width primary action, and secondary workflows inside closed details panels. Reuse the generic workflow-step vocabulary rather than introducing per-studio visual variants.
- The focused 3D editor card is a desktop viewport surface (`position: fixed` beside the server rail), not a content-sized AI-grid child. Keep its grid to app bar + `minmax(0, 1fr)` workspace; changing it to a multi-row content layout cuts the workflow scrollbar off before the Low-poly conversion section.
- The Three.js viewport must frame every selected model from freshly computed world bounds. Imported Sketchfab files have arbitrary source units; camera fitting, not destructive mesh scaling, keeps their preview visible while preserving their original model dimensions for export and printing.
- Initial load, Reset Camera, and Focus now share the same world-bounds fit. The calculation refreshes nested transforms, uses the actual canvas aspect ratio, and derives camera clipping planes from the final distance; do not add a second ad-hoc focus calculation.
- Several workflow paths are hardcoded to Windows absolute paths
- Maven setup is dated and inconsistent
- `main` is pushable through the configured `origin` remote

## Important Files

| File | Purpose |
|------|---------|
| `pom.xml` | Legacy Java build config |
| `package.json` | Root npm workspace, build tools, and runtime launch commands |
| `bots/discord-bot/package.json` | Discord adapter dependencies and standalone scripts |
| `bots/discord-bot/src/index.ts` | Node bot entrypoint |
| `dashboard/src/page.ts` | Dashboard HTML template |
| `server/src/services/generationFacade.ts` | Shared generation routing |
| `shared/src/media/generatedRecords.ts` | Generated media contracts |
| `shared/src/resourcePools/contracts.ts` | Resource pool contracts |
# Blender script catalog root files (2026-08-15)

- The remote Blender Scripts catalog now includes top-level Python files as individual downloadable script entries in addition to folder packages. It deliberately ignores non-Python root files such as documentation, licenses, and Git metadata; file entries link to their GitHub blob page while folders link to their tree page.
