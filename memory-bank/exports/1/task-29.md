# Task: Add standalone Discord bot dashboard mode beside full Studio (id=29)

> Exported from Taskitty at `2026-10-17T23:59:27.122Z`.

- **State:** done
- **List:** Done (id=1)
- **Added:** 2026-10-09T18:45:58.841Z

## Description

Provide an explicit Discord-only dashboard launcher and UI that operates independently of LazyDev, tools, other messenger runtimes, companion and media services, while preserving Discord dashboard integration in full URage Now Studio. Enforce scope at backend route/startup level, not merely by hiding navigation. Verify direct launch, bot management APIs, and blocked unrelated routes.

## Comments (2)

> **rainer** — 2026-10-09T19:08:16.619Z
> Implemented a separate single-process Discord bot dashboard launcher (`npm run start:discord-dashboard`, loopback 4783; dev/stop commands too). The dedicated page offers Overview, Guild, Commands, Messages, Automation, Moderation, Games, and Activity; Games reuses the existing package/text editor. Backend scope allowlists Discord routes and blocks Studio/tool/companion/other-messenger APIs. Startup skips Ollama model discovery, ComfyUI autostart, LAN companion discovery and other messenger autostarts. The bot-only scheduler runs Discord text-template automations only. Full Studio remains unchanged. Verified root build, Discord type-check, runtime suite, Games suite; live local browser tab/game-editor smoke and 200/404 route probes; default and dev launch plus port-specific stop. Live Discord connection and advanced full-Studio Guild/Moderation UI parity remain unverified/incomplete.

> **rainer** — 2026-10-09T19:08:26.766Z
> Cause: The shared dashboard had one broad page/server and started optional Studio, companion, ComfyUI, and messenger services from the same process.
> Solution: Added a distinct Discord-only entrypoint, single-process launcher, loopback port, dedicated Discord page, backend allowlist, and startup/scheduler guards while retaining the full Studio integration.
> Troubles: Existing env files override normal dashboard bind settings; the new mode sets its own loopback host and default port. Static launcher checks needed an update for the new shutdown condition.
> Findings: The standalone UI covers eight Discord areas and works in a local browser, but advanced Guild, Moderation, and Automation forms from the full Studio were not ported one-for-one. A live Discord session was not exercised. Ctrl+C could leave a child in the non-PTY test runner; the verified stop command cleans up the exact port safely.
> Todos: Bring advanced Discord Guild, Moderation, and Automation controls to parity in the standalone bot dashboard

