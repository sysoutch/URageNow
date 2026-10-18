# Task: add button in header in tauri and somewhere else at the top for browser for discord with discordicon and a link to the URage Discord (id=39)

> Exported from Taskitty at `2026-10-17T23:59:27.122Z`.

- **State:** done
- **List:** Done (id=1)
- **Added:** 2026-10-17T23:11:46.851Z

## Description

URage Discord https://discord.gg/n3jkrtN

## Comments (4)

> **rainer** — 2026-10-17T23:14:25.052Z
> also do this for the taskitty server frontend and add a task in #tk:workspace:taskitty-server in the "Frontend" board and do it

> **rainer** — 2026-10-17T23:25:29.012Z
> URage Now part done in a commit on claude/gracious-mahavira-5c004f ("Add URage Discord link to the desktop title bar and the rail").
> - Tauri: a Discord pill (bi-discord icon + "Discord") in the title bar left of the window controls; hover uses Discord blurple. The webview has no opener plugin, so dashboard/src/client/modules/desktopWindowChrome.js intercepts the click and calls a new `desktop_open_discord` command (src-tauri/src/window.rs). That command opens a hard-coded https://discord.gg/n3jkrtN via explorer/open/xdg-open and never takes a URL from the webview. `cargo check` passes (with placeholder sidecar binaries, since the worktree has none).
> - Browser: there's no global header, so the link is the first item in the rail's `.rail-home-wrap`, above the URage logo, on every view. In the expanded rail the collapse toggle sits at the end of the Discord row (_expanded-rail-navigation.scss, via :has). In the desktop shell the rail copy is removed, so the link appears only once.
> - Placement note: the rail's top level uses explicit grid rows, so a new direct child shifted .rail-home-wrap and the bottom group into the wrong rows. The home-wrap placement avoids that.
> - Verified via Playwright screenshots: compact 1440/375, expanded 1440/1024, Tools view, and ?desktopShell=tauri.
> - Checks: shell-navigation, sidebar foldouts/split, chat-studio-sidebar-browser, client-module validation, bootstrap-ready, the icon checks, native-application-port and tsc pass. Style architecture passes apart from the existing _model3d/_tools line budgets.
> Still open: the Taskitty server frontend part (comment 84) is in a different repo/workspace.

> **rainer** — 2026-10-17T23:37:26.124Z
> Taskitty server part done by a linked session: commit b9190ef on branch claude/affectionate-edison-a445ca in C:\Files\github\taskitty-suite\taskitty-server ("Add URage Discord link to the web header", touching web/src/community.ts, public.ts, backstage.ts and styles/app.css). It's tracked as task #9 on the Frontend board of the taskitty-server workspace, now done. Nothing is pushed. Both parts of this task are now complete.

> **rainer** — 2026-10-17T23:37:26.220Z
> Solution: URage Now: a Discord pill in the Tauri title bar that opens through a fixed-URL desktop_open_discord command, plus a Discord item at the top of the rail's home group for the browser (removed in the desktop shell). Taskitty server: a header link (commit b9190ef).
> Troubles: cargo check needs placeholder sidecar binaries in a fresh worktree.
> Findings: The URage Now rail uses explicit grid rows, so new items must go inside an existing group instead of becoming direct rail children. The Tauri shell has no opener plugin, so external links need a shell command.

