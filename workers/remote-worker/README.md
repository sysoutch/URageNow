# Remote Worker

Remote generation worker runtime entrypoint and worker-specific env templates.

This worker is the execution bridge for dashboard tasks intentionally configured to run remotely. It is useful when Blender, a GPU workload, or the effective Windows user must stay separate from the dashboard process. It is not required for the normal same-machine dashboard and Discord setup.

Native Rust workers live separately under `workers/rust` so bounded jobs can move into focused binaries without replacing this orchestration layer.

## Entrypoint

- `workers/remote-worker/src/remoteWorker.ts`

## Env files

- `workers/remote-worker/env/.env.worker.local`
- `workers/remote-worker/env/.env.worker.local.example`
- Optional profile overrides: `workers/remote-worker/env/.env.worker.<profile>.local`

## Launch

Use dashboard launchers from repo root:

- `.\scripts\run-worker.cmd start`
- `.\scripts\run-worker.cmd dev`

Start this runtime only when the relevant dashboard workflow uses `executionTarget: "remote"` and `REMOTE_WORKER_BASE_URL` points to this worker.

Use unauthenticated `GET /health` only for liveness monitoring. All worker actions still require the configured shared secret.

Use authenticated `GET /ready` to confirm that the worker is accepting authorized work requests. It requires ComfyUI, and reports the active LLM plus Blender availability as optional capabilities.

Use authenticated `GET /capabilities` for scheduling. It returns protocol version `1`, redacted capability states for image generation, 3D generation, ComfyUI, LLM, and Blender, plus CPU/memory capacity and NVIDIA GPU VRAM when `nvidia-smi` is available. It never returns machine paths, addresses, or credentials.

For a separate LAN machine, set `REMOTE_WORKER_BIND_HOST=0.0.0.0` and a long `REMOTE_WORKER_SHARED_SECRET` on the worker. Configure the dashboard with that worker's `REMOTE_WORKER_BASE_URL` and the identical secret. For interactive local hosts, the secret can instead be stored as `remote-worker.default.shared-secret` in the OS credential store; the environment variable remains the explicit service and CI override. Allow only the worker port through the host firewall; the worker does not need a Discord token or dashboard access token.

## Blender + AutoRig

When 3D Model Studio uses `executionTarget: "remote"`, the remote worker now also handles:

- `POST /api/model3d-autorig`
- `POST /api/model3d-autorig-preview`
- `POST /api/blender-open-model`

That means Blender-side AutoRig and dashboard `Open In Blender` can run under the worker process user instead of the main dashboard/bot user. On startup the worker logs its OS username, which is the effective user for those Blender launches.
