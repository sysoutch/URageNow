# Distributed Runtime And Secret Storage

## Status

Design target for running the dashboard, bots, generation workers, ComfyUI, and LLM servers on separate hosts.

## Security Finding

`DISCORD_TOKEN_SECURE_STORE` is currently a per-user environment variable. Despite its name, it is stored as plaintext by the operating system and must not be described as encrypted secure storage.

Environment files remain useful for non-secret machine configuration such as URLs, ports, model names, workflow paths, and `COMFYUI_INPUT_DIR`. Bot tokens, API keys, and runtime shared secrets should be resolved separately.

## Required Runtime Topology

Each machine that runs a bot or worker owns that runtime's credentials. The dashboard must not become a central plaintext token database.

```text
Dashboard host
  dashboard -> authenticated runtime agent on each bot host
  dashboard -> ComfyUI HTTP API
  dashboard -> OpenAI-compatible or Ollama HTTP API

Bot host (one or many)
  runtime agent -> local OS credential store -> bot child process

Worker host
  remote worker -> local worker credentials

ComfyUI host
  ComfyUI and its local input/output paths

LLM host
  Ollama, LM Studio, or llama.cpp server
```

`COMFYUI_INPUT_DIR` is meaningful only on the machine that directly accesses that filesystem. A dashboard host must not use a path from a remote ComfyUI machine unless the directory is an explicitly mounted share. Prefer uploading inputs through the ComfyUI API.

## Secret Resolution Contract

Application code should request a logical secret such as `discord.default.token`; it should not know how that secret is stored.

Resolution order:

1. One-use manual value supplied for the current launch and retained only in process memory.
2. Process environment override for CI, containers, and service managers.
3. Native user credential store on the runtime host.
4. Optional encrypted vault for headless hosts where no desktop keyring is available.

Native adapters:

- Windows Credential Manager, protected for the selected Windows identity.
- macOS Keychain, scoped to the launch identity.
- Linux Secret Service when a user keyring session exists.

An unattended service often has no unlocked desktop keyring. It should use a dedicated service identity plus a service-manager secret, container secret, or encrypted vault unlocked at boot. A "current user session" store alone cannot satisfy unattended startup.

Secrets must never be returned by status APIs, persisted in dashboard settings, included in child-process command-line arguments, or written to logs. Child processes may receive a secret through a minimal inherited environment until a local IPC secret handoff is implemented.

## Remote Runtime Agent

To control a bot on another machine, install a small agent beside that bot. Its responsibilities are deliberately narrow:

- authenticate the dashboard with mutually authenticated TLS or a pinned host identity plus a rotated token;
- allow only declared runtime IDs and start, stop, restart, and status operations;
- resolve credentials locally and inject them into the child process;
- return redacted health and error information;
- reject arbitrary commands, executable paths, environment keys, and working directories from remote requests.

Do not expose the existing local messenger admin ports directly to a LAN without equivalent authentication and transport protection.

Remote generation requests perform an authenticated capability handshake before execution and cache it for five seconds. Image, 3D, LLM, and Blender requests each require their matching advertised capability, so a reachable but misconfigured worker fails before a job is submitted.

## LLM Provider Direction

Add an `openai-compatible` provider instead of adding llama.cpp-specific chat code. LM Studio and llama.cpp both expose OpenAI-compatible endpoints, while lifecycle operations differ.

Provider settings should separate:

- protocol: `ollama` or `openai-compatible`;
- server flavor: `generic`, `lmstudio`, or `llamacpp`;
- base URL, API key secret reference, text model, and vision model;
- lifecycle capability flags for list, load, unload, and context configuration.

Chat and vision requests can share the OpenAI-compatible transport. LM Studio-specific load/unload endpoints must run only for the `lmstudio` flavor. A llama.cpp server normally owns its model and context at process startup, so unsupported lifecycle controls should be hidden or disabled rather than emulated.

## Migration Order

1. Completed: identify the current plaintext user-environment mechanism as legacy rather than secure.
2. Completed: introduce the logical secret resolver and native-store CLI with store, delete, and status commands.
3. Completed for Discord: route local dashboard and manual bot launches through the resolver. Discord can run independently through `scripts/bots/discord/run-bot.cmd`; this path disables the dashboard and skips its build.
4. Completed initial support: the OpenAI-compatible transport accepts the explicit `llamacpp` provider, uses `/v1` chat and model endpoints, and excludes LM Studio-only stateful and lifecycle calls. Existing `LMSTUDIO_*` connection keys are retained during this compatibility phase.
5. Add the restricted remote runtime agent for separate bot machines.
6. Add TLS identity, enrollment, rotation, audit events, and migration tooling before treating remote control as production-ready.
