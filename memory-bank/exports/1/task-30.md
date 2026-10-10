# Task: Bring advanced Discord Guild, Moderation, and Automation controls to parity in the standalone bot dashboard (id=30)

> Exported from Taskitty at `2026-10-10T16:13:59.570Z`.

- **State:** open
- **List:** Normal Priority (id=5)
- **Added:** 2026-10-09T19:08:26.767Z

## Description

Port remaining Discord controls from the full Studio dashboard into the standalone Discord-only UI without enabling Studio, tools, other messenger runtimes, or non-template media automations. Acceptance: Guild People/Channels/Invites/Bot/Commands/Rod Tools and detailed Moderation/Automation controls have equivalent standalone workflows; browser tests exercise core mutations; scoped route checks stay enforced.

## Comments (1)

> **rainer** — 2026-10-09T19:10:56.259Z
> Parity investigation: loading the existing 4.7 MB full Studio page against the scoped bot server produced dozens of requests for tool thumbnails, Three.js, model/media APIs, network settings and companion endpoints, even before navigating. Reusing that page would reintroduce Studio initialization and violate the bot-only runtime goal. Advanced Discord controls should be ported into the dedicated page or its feature modules without importing the full Studio browser bootstrap.

