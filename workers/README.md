# Workers

Workers isolate heavier or machine-specific tasks from the dashboard and messenger processes. They are execution boundaries, not alternate dashboard or bot hosts.

## When To Use A Worker

- Use `remote-worker` when the dashboard must execute a supported task on another machine, another Windows user, or a separate GPU/Blender environment.
- Use a Rust worker when a bounded asset job benefits from native parsing, predictable resource use, or a typed JSON contract.
- Do not start a worker for ordinary local dashboard, Discord, chat, or settings work. Those run in the normal application process.

## Current Layout

```text
workers/
|- remote-worker/           # current TypeScript remote execution runtime
`- rust/
   |- crates/
   |  |- model-inspector/   # first Rust worker CLI
   |  `- worker-contracts/  # shared Rust request/response types
   `- Cargo.toml            # Rust workspace manifest
```

## Worker Roles

- `remote-worker`: handles remote execution routes used by the dashboard, including Blender-side tasks.
- `rust`: hosts focused native workers for bounded jobs where performance, memory safety, packaging, or process isolation matter.

## Rust Worker Direction

Rust workers should stay narrow and explicit:

- one executable or service per job family
- JSON request/response contracts
- no UI, Discord, or workflow-orchestration logic
- reusable shared contracts for cross-worker consistency

The first worker is `model-inspector`, a CLI that inspects 3D asset files and returns structured metadata.
