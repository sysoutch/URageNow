# Rust Worker Adoption Plan

## Goal

Adopt Rust selectively for worker-shaped parts of URage NOW without rewriting the dashboard, bot runtimes, or workflow orchestration.

## Why This Repo Should Use Rust Carefully

Most of this codebase is orchestration:

- dashboard UX and state management
- Discord, Telegram, and Matrix runtime behavior
- LLM routing and workflow planning
- external tool coordination across Blender, ComfyUI, and local media pipelines

That work still fits TypeScript better. Rust should be used where native execution gives a real payoff:

- model and media inspection
- filesystem-heavy indexing and manifest generation
- deterministic asset transforms
- long-running local workers with stronger isolation requirements
- desktop-native backend paths if the dashboard packaging expands

## Target Architecture

```text
dashboard/                 TypeScript UI and server routes
bots/                      Messenger runtimes and orchestration
workers/remote-worker/     Existing TypeScript remote worker
workers/rust/              Native worker workspace
shared/                    Cross-runtime schemas and helpers
```

## First Migration Slice

Start with a narrow native worker instead of a rewrite:

- worker: `model-inspector`
- shape: CLI with JSON output
- input: model file path
- output: structured metadata, validation warnings, and file facts

This is a good first cut because it is:

- easy to call from Node
- easy to verify in isolation
- useful to both Studio and background automation
- low-risk compared with moving orchestration code

## Current Status

The first worker is no longer only a scaffold.

- `workers/rust/crates/model-inspector` now performs real `glb` / `gltf` inspection through the `gltf` crate
- it also performs real `obj` inspection through `tobj`
- it returns geometry counts, UV and normal stats, material summaries, texture summaries, parser identity, inspected state, and bounds
- `bots/discord-bot/src/services/model3d/modelInspector.ts` can launch the worker and normalize the result for TypeScript callers
- `asset-validator` now exists as a second Rust worker and turns inspection data into structured error/warning output for downstream workflow checks
- the dashboard 3D inspector now calls both inspection and validation so Rust results show up in normal Studio flow rather than staying backend-only

## Contracts

Worker boundaries should be explicit and versionable.

- use JSON request/response payloads
- keep contracts in a shared Rust crate
- mirror the response shape in TypeScript later through a schema or generated types
- avoid implicit stdout parsing beyond the JSON payload

## Recommended Rollout

1. Create a Rust workspace under `workers/rust`.
2. Add `worker-contracts` for shared native request/response types.
3. Build `model-inspector` as the first CLI worker.
4. Call it from the dashboard or remote worker through a thin TypeScript adapter.
5. Add tests around the adapter and worker JSON contract.
6. Expand format support from `glb` / `gltf` / `obj` into `fbx` if a solid parser path proves worth the maintenance.

## Good Rust Candidates After `model-inspector`

- `asset-validator`
  - purpose: fail-fast validation for generated 3D artifacts before posting or further processing
  - checks: missing textures, no UVs, zero-face meshes, suspicious bounds, unsupported formats
- `asset-indexer`
  - purpose: scan `data/generated-models` and build deterministic manifests for dashboard and automation use
  - checks: missing sidecar files, stale previews, orphaned textures, duplicate artifacts
- `media-probe`
  - purpose: central native metadata probe for images, GIFs, audio, and video
  - checks: dimensions, frame counts, duration, codecs, alpha, oversized assets
- `asset-packager`
  - purpose: safe import/export packaging for GLB/OBJ bundles and archive staging
  - checks: canonical file naming, collision-free output, stable manifests, hash generation
- `preview-render-preflight`
  - purpose: lightweight worker that decides whether an artifact is healthy enough for Blender or Three.js preview
  - checks: parser support, basic geometry presence, texture reachability, warnings scoring

## Best Next Rust Ports

These are the most practical next ports for this repo, in order:

1. `asset-validator`
   - highest leverage for Studio and automation
   - can block broken generated models before Discord posting or downstream edits
   - now partially live through dashboard inspection, but still not yet acting as a hard gate in posting/generation flows
2. `media-probe`
   - shared value across image, video, audio, GIF, and 3D workflows
   - reduces scattered JS-side metadata probing
3. `asset-indexer`
   - useful once generated media history grows and dashboard queries need faster or more deterministic summaries
4. `asset-packager`
   - worthwhile once import/export workflows harden and file moves matter more

## Things That Should Stay In TypeScript

- chat skill routing
- dashboard client code
- bot command and event handling
- workflow planning
- provider integrations that are mostly HTTP glue

## Guardrails

- do not duplicate business logic across Rust and TypeScript
- keep worker responsibilities small and composable
- prefer one binary per job family over a giant all-purpose native runtime
- require structured logging and structured error output
- prove operational value before adding more native surface area

## Immediate Next Steps

- scaffold `workers/rust`
- keep `workers/remote-worker` as the current execution bridge
- add a TypeScript adapter once the first Rust worker contract stabilizes
- expand from inspection into transforms only after real usage confirms the boundary

## Latest Follow-Up

- `media-probe` boundary types now live in `shared/src/media/probeContracts.ts` instead of being owned by `bots/discord-bot/src/services/mediaProbe.ts`.
- `asset-indexer` is now live under `workers/rust/crates/asset-indexer`.
- the worker currently scans a generated-models root, emits artifact file manifests plus orphan root files, and warns about empty artifact folders or duplicate sidecar basenames.
- `bots/discord-bot/src/services/model3d/assetIndexer.ts` now bridges the worker into TypeScript, with `indexGeneratedModelStoreWithRust()` exposed from `model3d.ts`.
- `/api/model3d-index` is now available in both the local dashboard route layer and the TypeScript remote worker bridge.
- `media-probe` now also performs real WAV audio metadata probing in Rust without adding new parser crates. The worker returns codec, duration, channel count, sample rate, and bits-per-sample for `.wav` files, while other audio/video kinds still return explicit parser-not-implemented warnings instead of pretending they were inspected.
- `media-probe` now also uses `symphonia` for broader compressed/container audio coverage, so `.mp3`, `.flac`, `.ogg`, and `.m4a` can return real audio metadata through the same shared probe contract instead of only parser-not-implemented warnings.
## Latest Progress

- `media-probe` now covers three real asset classes through Rust:
  - images
  - audio (`wav`, plus `mp3`/`flac`/`ogg`/`m4a` through `symphonia`)
  - video container/track metadata (`mp4`, `mov`, `webm`, `mkv`, `avi`)
- The shared TypeScript contract now exposes `RustVideoProbe` with:
  - `codec`
  - `container`
  - `durationSeconds`
  - `trackCount`
  - `frameCount`
  - `averageFrameRate`
- The dashboard/server bridge in `server/src/services/mediaProbe.ts` already normalizes that Rust output, so the UI/backend can start consuming video facts without another protocol migration.

## Recommended Next Ports

- `media-probe` next:
  - add real video dimensions only once we switch to a parser path that actually exposes them; the current `symphonia` `CodecParameters` path used here does not provide width/height fields
  - add waveform/thumbnail sidecar generation only if we want Rust to own preview preflight too
- `server` ownership next:
  - neutral runtime/config ownership now lives behind `server/src/config/appConfig.ts`, so the main `server/src/services/*` cluster no longer imports `bots/discord-bot/src/config.ts`
  - shared LLM/provider execution now lives under `server/src/services/llm/`, so model metadata and 3D decision helpers no longer reach back into `bots/discord-bot/src/services/llm/ollama.ts`
  - keep shrinking remaining `server -> bots/discord-bot` imports such as low-poly orchestration and dashboard console logging until the bot folder is mostly adapter/runtime code again
- dependency-boundary cleanup next:
  - `sharp` is already behind `server/src/services/sharpRuntime.ts`; the next cleanup there is making the dependency root itself neutral instead of resolved through the bot package's install location
  - once that is done, review whether any remaining image/model preview helpers still need bot-owned filesystem or workflow assumptions
- generation/validation next:
  - wire `asset-validator` in as a hard gate for more generation/posting flows instead of only surfacing the warnings in Studio inspection
  - continue extracting write-side generation orchestration from the bot package where it still owns provider-specific execution flow

## Latest Validation Follow-Up

- `asset-validator` is now a real hard gate in more 3D paths instead of only an inspector-side warning source.
- The server-owned `model3d.ts` flow now validates:
  - merged artifacts created from uploaded source models
  - merged artifacts created by image-to-3D generation
  - generated low-poly outputs
  - imported low-poly replacement artifacts
- The same Rust validation gate now also runs before post-process rewrites replace an accepted artifact:
  - single-file loose-parts exports
  - metallic/material adjustments
  - scale-to-height passes
  - AutoRig outputs
- Blocking Rust validation errors now stop those artifacts before they are persisted as the main accepted record for downstream Studio flows.

## Latest Ownership Progress

- `appConfig` is now server-owned at `server/src/config/appConfig.ts`.
- Shared Ollama / LM Studio runtime logic is now server-owned at `server/src/services/llm/`.
- Dashboard console logging is now server-owned at `server/src/services/dashboardConsoleLogger.ts`.
- The remaining high-value non-Discord ownership moves are now narrower:
  - low-poly orchestration
  - provider-specific generation write paths
  - any lingering bot-only dependency roots

## Latest Cleanup Follow-Up

- low-poly Blender orchestration is no longer bot-owned; it now lives in `server/src/services/model3d/lowPolyModelService.ts`
- remote worker transport is no longer bot-owned; it now lives in `server/src/services/remoteGenerationClient.ts`
- the biggest remaining shared-but-bot-owned surface is now generation write-side execution (`imageGeneration`, `audioGeneration`, and some remote-worker/image-generation coupling), plus messenger-admin adapters that are genuinely platform-specific
- follow-up: `imageGeneration.ts` and `audioGeneration.ts` have now moved into `server/src/services/`, so the biggest remaining shared-but-bot-owned execution surface is narrower again:
  - video-generation write-side execution
  - any lingering remote-worker/media-generation coupling that still imports through bot runtime paths
  - messenger-admin adapters, which are more genuinely platform-specific than the generation services
- follow-up: `videoGeneration.ts` has now also moved into `server/src/services/`, so the next cleanup focus is no longer the generated-media write-side owner itself. The best remaining ownership cuts are:
  - lingering remote-worker/media-generation coupling that still routes through bot runtime surfaces
  - low-value residual provider glue still mixed into bot runtime files
  - genuinely messenger-specific adapters that can stay in `bots/discord-bot`

## Latest Verification

- After the Tools Game Engine export coverage pass, the Rust workspace was rechecked with `cargo check` from `workers/rust`.
- The current worker crates (`worker-contracts`, `model-inspector`, `asset-validator`, `asset-indexer`, and `media-probe`) remain green, so the next Rust work can stay focused on real ownership cuts or additional validated worker value instead of emergency repair.
- `media-probe` now has direct unit tests for missing-file results and basic PCM WAV metadata. The audio/video Symphonia probe setup is centralized in one helper so future parser additions have one launch path to maintain.
- Latest Rust validation: `cargo test -p media-probe` and full-workspace `cargo check` both pass.
