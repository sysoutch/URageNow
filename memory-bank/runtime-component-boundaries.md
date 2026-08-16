# Runtime Component Boundaries

## Purpose

This document defines the current URage NOW runtime topology and the target
boundary for native Rust integration. The terms Studio, Dashboard, Server, and
Worker have previously been used as though each named a separate executable.
They do not.

## Current Responsibilities

### Studio

Studio is the user-facing product and workflow collection. Chat, Image, 3D,
Audio, Music, Video, Tools, Bots, and Settings are dashboard feature modules.
Studio is not a backend process.

### Dashboard

The dashboard owns the browser UI, authenticated HTTP routes, request
adaptation, settings presentation, and workflow coordination. Its neutral
process entrypoint is `runtime/dashboardRuntime.ts`.

The entrypoint still imports the Discord composition module for adapters that
have not yet moved to a neutral package. Messenger autostart is disabled there,
so this is an implementation dependency rather than intended ownership.

### Server

`server/` is the reusable TypeScript application layer. It owns configuration,
provider clients, generated-asset services, durable job state, and messenger
runtime control. It does not currently create an independent HTTP listener.

The `start:server` launcher is therefore a historical headless composition host,
not a clean standalone application server. Creating a genuinely independent
control plane requires explicit authenticated contracts; renaming a launcher
would not create that separation.

### Remote Execution Worker

`workers/remote-worker` is an optional **remote execution worker**. It executes
only requests that explicitly choose the `remote` target, including GPU/ComfyUI
work and Blender actions. It can be deployed on another machine or intentionally
isolated on the same machine under another OS user; its machine, user,
credentials, and installed applications define that execution environment.

Local Blender work does not automatically go through this worker. The dashboard
host (or its Tauri native broker) runs the default local path; bounded Rust
worker CLIs are invoked on demand. Local versus remote is an execution-target
decision, not a statement about whether an operation is “worker-like.”

### Rust

Rust currently has two bounded roles:

1. `src-tauri/` owns the installed desktop shell, packaged runtime lifecycle,
   native window/tray behavior, and logs.
2. `workers/rust/` contains small CLIs for model inspection, validation,
   indexing, and media probing.

These native jobs return typed data to the TypeScript application layer. They
do not own workflow orchestration.

## Current Desktop Application Launches

Bambu Studio is launched by the dashboard host through an allowlisted
application adapter. The adapter:

- resolves a configured or known installation;
- validates that the model path is absolute, exists, and has a supported type;
- passes the model as one positional argument without a command shell;
- runs from the application's directory;
- inherits the dashboard process's interactive OS user; and
- detaches the application from dashboard standard streams.

Blender uses a shared launch service. Dashboard routes execute it locally unless
the request selects the remote worker, in which case the worker invokes the same
contract under its own user.

## Native Execution Broker

The desktop runtime now uses a narrow local native execution broker rather than
a parallel workflow server.

```text
Dashboard route
  -> application service
    -> NativeApplicationPort
      -> TypeScript adapter (headless/browser installation, default)
      -> Rust broker adapter (packaged Tauri installation, explicitly injected)
```

The first broker version accepts typed requests for:

- `OpenModelInBambuStudio`
- `OpenAssetInBlender`

It returns a small typed result containing the application ID, launch state,
adapter, and optional process ID. It does not accept arbitrary commands, shell
fragments, or environment maps. The application layer resolves executable
paths; both adapters enforce the application allowlist, and the Rust broker
additionally validates Bambu model paths and Blender script/file arguments.

This split keeps responsibilities coherent:

- TypeScript decides **what workflow action is allowed**.
- Rust performs **how the approved local OS action is executed**.
- The remote worker performs **where an isolated or remote task runs**.

## Completed Native Migration

1. `NativeApplicationPort` owns the Bambu/Blender launch contract.
2. The TypeScript implementation is the default for headless and browser
   installations and waits for the OS spawn result before reporting success.
3. Tauri stages `native-application-broker` as a target-specific external
   binary and injects its exact path into the Node sidecar.
4. The broker uses typed CLI arguments because the dashboard is a separate Node
   sidecar process and therefore cannot invoke in-WebView Tauri commands
   directly. This preserves the same security boundary without coupling the
   dashboard server to WebView state.
5. Contract checks cover allowlisted application IDs/executables, shell-free
   launch, explicit desktop injection, and Rust argument validation.

## Remaining Composition Migration

`runtime/dashboardRuntime.ts` still imports
`bots/discord-bot/src/index.ts`. This is a real ownership defect, not merely a
bad filename: that module currently constructs both neutral media/provider
dependencies and Discord administration adapters in one large object.

The safe extraction order is:

1. split `DashboardDependencies` into neutral workflow/runtime ports and a
   Discord administration port;
2. move neutral provider, generated-media, job, and local-application assembly
   into `runtime/dashboardComposition.ts`;
3. make Discord register only its messenger/admin adapter;
4. switch `dashboardRuntime.ts` to the neutral composition and stop packaging
   `bots/discord-bot` for the desktop runtime;
5. then remove Discord-only production packages such as Playwright from the
   Tauri dependency closure.

Skipping the port split and supplying placeholder dependencies would make the
dashboard appear independent while silently breaking generation routes, so
that shortcut is intentionally rejected.

Do not move provider orchestration, generated-media persistence, browser API
routes, or remote GPU scheduling into the broker.
