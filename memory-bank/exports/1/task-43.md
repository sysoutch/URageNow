# Task: Fix Bots dashboard Messages tab rendering an empty panel for Discord (id=43)

> Exported from Taskitty at `2026-10-18T14:53:27.989Z`.

- **State:** open
- **List:** High Priority (id=4)
- **Added:** 2026-10-18T14:50:43.344Z
- **Tags:** Bug, Ultra short task

## Description

In the standalone/embedded bots page (dashboard/src/botsDashboardClient.js) both tab handlers run `showView(view === "messaging" ? "messenger" : view)`. For Discord the panel is `<section data-view-panel="messaging" data-discord-only>` (features/discord/ui/messagingView.ts), so the Messages tab activates the non-Discord `messenger` panel, which is hidden, and the user sees an empty black area. Only remap to `messenger` when the selected messenger is not Discord. Acceptance: clicking Messages for Discord shows the chat workspace; Telegram/Matrix/WhatsApp still show the messenger panel; extend scripts/check-bots-dashboard-layout.ts to click Messages for Discord and assert a visible panel. Found in the 2026-10-18 UI survey.

## Comments (0)

_No comments._
