# Task: Add standalone all-bots dashboard runner (id=32)

> Exported from Taskitty at `2026-10-18T14:53:27.989Z`.

- **State:** done
- **List:** Done (id=1)
- **Added:** 2026-10-09T19:17:25.868Z

## Description

Create a dedicated loopback runner and dashboard for Discord, Telegram, Matrix, and WhatsApp without starting Studio tools, LazyDev, media or companion services. Include runtime controls and existing bot management surfaces, preserve Discord-only and full Studio runners, document commands, and validate builds and scoped routes.

## Comments (2)

> **rainer** — 2026-10-09T23:03:15.598Z
> Implemented the shared all-bots dashboard. Added start/dev/stop runner commands on loopback port 4784, scoped Discord/Telegram/Matrix/WhatsApp runtime and messaging routes, and skipped Ollama discovery, ComfyUI startup, remote-worker settings sync, companion discovery, Tools, and LazyDev in bot-only scope. Moved Studio away from inline bot-dashboard markup: it now lazily mounts the same /bots-dashboard document and controller used by the standalone runner. Added source, route, browser, and lazy-frame checks; live smoke verified four bot tabs, messaging view, 404 for Studio tool routes, and clean browser page errors. npm run build:all, npm run check:runtime, and the Discord bot TypeScript check pass. The broader check:dashboard proceeds through the bot/shell/messaging/3D checks but still fails later at the pre-existing network-settings listener assertion in scripts/check-dashboard-server.ts.

> **rainer** — 2026-10-09T23:03:25.981Z
> Cause: The bot workspace UI was embedded directly in the Studio page, so adding a standalone all-bots runner risked creating a second dashboard implementation that would drift.
> Solution: Created one bot dashboard document from the existing messenger/game page-section components, served it from a scoped loopback runner and /bots-dashboard, and replaced Studio's inline bot views with a lazy iframe host for that same document. Added a bots runtime scope and narrow route allowlist, plus startup exclusions for non-bot services.
> Troubles: The repository-wide dashboard check has an unrelated later failure in the network-settings listener assertion. Bot-specific builds, runtime checks, TypeScript checks, standalone browser checks, and Studio lazy-frame browser checks pass.
> Findings: A shared renderer alone is insufficient if two client controllers remain; the shared document and controller must be the unit embedded by Studio. Live browser testing also found an ephemeral-port Host validation bug, fixed by validating against the actual socket port when configured port is zero.

