# Rust Workers

Rust workers are for bounded native jobs that benefit from stronger memory safety, predictable resource use, and cleaner packaging than the main TypeScript runtime. They complement the dashboard and remote worker; they do not own UI, Discord, or workflow orchestration.

## Workspace Goals

- keep native code isolated from dashboard and messenger orchestration
- share typed contracts between workers
- make each worker invokable as a small CLI or service
- grow one proven worker at a time

## Current Crates

- `worker-contracts`: shared request/response types
- `model-inspector`: first CLI worker for model file inspection
- `asset-validator`: CLI worker for structured asset validation on top of inspection data
- `asset-indexer`: CLI worker for scanning generated-model artifact directories into deterministic manifests
- `media-probe`: CLI worker for real image metadata probing, plus audio metadata such as codec, duration, channel count, sample rate, and bits per sample for WAV and the currently wired `symphonia` formats (`mp3`, `flac`, `ogg`, `m4a`)
- `native-application-broker`: typed, allowlisted launcher for Bambu Studio and Blender in packaged Tauri installations

## Current Inspection Support

- `glb` and `gltf`: real inspection through the `gltf` crate
- `obj`: real inspection through `tobj`
- `fbx` and `blend`: recognized, but currently return explicit "not implemented yet" warnings

The current result shape includes:

- file facts
- parser name
- inspected yes/no state
- geometry stats: mesh, primitive, vertex, face, normal, and UV-channel counts
- resource stats: scenes, nodes, materials, textures, and animations
- material summaries with named texture slots when available
- texture summaries with references, usage counts, and image dimensions when available
- model bounds when position data is available

## Local Commands

```powershell
cd workers/rust
cargo check
cargo run -p model-inspector -- --input C:\path\to\model.glb
cargo run -p asset-validator -- --input C:\path\to\model.glb
cargo run -p asset-indexer -- --input C:\path\to\data\generated-models
cargo run -p media-probe -- --input C:\path\to\image.png
cargo run -p native-application-broker -- --application-id bambu-studio --executable "C:\Program Files\Bambu Studio\bambu-studio.exe" --argument C:\path\to\model.fbx
```

## Integration Model

The intended integration path is:

1. Dashboard or bot runtime builds a JSON request.
2. A Rust worker runs as a CLI or persistent local service.
3. The worker returns JSON for the calling TypeScript runtime to consume.

This keeps the orchestration layer in TypeScript while moving tight native work into isolated binaries.

## Current Bridge

The native 3D bridge now lives under `server/src/services/model3d/`.

- `modelInspector.ts` resolves a built `model-inspector` binary when available
- `assetValidator.ts` resolves a built `asset-validator` binary when available
- `assetIndexer.ts` resolves a built `asset-indexer` binary when available
- both fall back to `cargo run -p <crate> -- --input <path>` during development
- `rustWorkerRunner.ts` owns the shared spawn/launch path so each worker does not duplicate process glue
- `server/src/services/model3d.ts` exposes `inspectGeneratedModelArtifact()` and `validateGeneratedModelArtifact()` for merged, original, or low-poly variants
- `server/src/services/model3d.ts` also exposes `indexGeneratedModelStoreWithRust()` for generated-model directory manifests
- `workers/remote-worker/src/remoteWorker.ts` exposes `/api/model3d-inspect` and `/api/model3d-validate`
- `workers/remote-worker/src/remoteWorker.ts` also exposes `/api/model3d-index`
- `dashboard/src/server/routes/messagingAndModelRoutes.ts` exposes `/api/model3d-inspect`, `/api/model3d-validate`, and `/api/model3d-index` for local or remote execution targets

## Current Workflow Usage

Rust is now visible in the dashboard 3D inspector path:

- selecting a generated model triggers native inspection
- the same selection also triggers native validation
- the inspector output now includes validation summary and issue lines next to the deeper parser stats
