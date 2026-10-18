# Task: Studio workflow settings footer hides its settings button on phones and overshoots the footer edge (id=40)

> Exported from Taskitty at `2026-10-18T14:53:27.989Z`.

- **State:** done
- **List:** Done (id=1)
- **Added:** 2026-10-17T23:18:53.061Z

## Description

Found while verifying #38. At <=760px the Chat/Audio/Music "Workflow settings" footer kept its label beside a sideways-scrolling button row that shrank to ~120px, so each Studio's own settings button (e.g. "Audio ComfyUI Workflow") sat fully off screen with no scroll cue. Separately, the actions container carried Bootstrap's grid `.row` class, whose negative gutter margins pushed it 2–4px past the footer padding at every width and clipped the last button.

## Comments (2)

> **rainer** — 2026-10-17T23:19:04.181Z
> Fixed in commit 9fa7f4b on claude/gracious-mahavira-5c004f.
> - dashboard/src/pageSections/aiView.ts: removed the stray `row` class from `.studio-workflow-settings-footer-actions`. Bootstrap `.row` added `margin: 0 -12px`.
> - dashboard/src/styles/media-ai/_responsive.scss: in the existing max-width 760px block, the footer wraps, the label takes its own line, and the buttons use `flex: 1 1 140px` with wrapping and no max width. This replaces a redundant `display: flex` rule.
> Verified with Playwright (stub server) for Chat/Audio/Music at 320/375/600/760/761/768/1024/1440. The actions row and both buttons sit inside the footer padding at every width. Phones show two full-width buttons; from 761px up they're back in one row. Not changed: at 1440 the Chat "Model + Connection…" label is ~14px wider than its 180px button.
> Checks: studio-shell-navigation, sidebar-foldouts, sidebar-split-layout, chat-studio-sidebar-browser, validate-dashboard-client-modules, dashboard-bootstrap-ready and tsc all pass. style-architecture and studio-workflows-browser fail exactly as on main (_model3d.scss/_tools.scss line budgets; image generation queue).

> **rainer** — 2026-10-17T23:19:04.261Z
> Cause: A desktop strip layout (label + sideways-scrolling buttons) was kept at phone widths, and Bootstrap's grid `.row` class had been used as a generic flex helper.
> Solution: Wrapped layout at <=760px, and removed the `.row` class from the markup instead of overriding its margins.
> Findings: Bootstrap's `.row` brings negative gutter margins. In this codebase use the component's own flex class, not `.row`.

