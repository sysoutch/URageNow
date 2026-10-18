# Task: 3D Suites tabs at 320px: the layout switcher labels overlap (Cards/Table/SIZE) and the tab icons collide with labels (id=37)

> Exported from Taskitty at `2026-10-17T23:59:27.122Z`.

- **State:** done
- **List:** Done (id=1)
- **Added:** 2026-10-17T22:44:38.239Z

## Description

_No description._

## Comments (1)

> **rainer** — 2026-10-17T22:54:18.444Z
> Cause: At 320px the shared layout toolbar was flex nowrap, with 240px of content in a 192px box. The 3D Suites tabs needed about 80px for icon plus label but each button was only 65px.
> Solution: Commit 0278007. Moved the shared toolbar rules out of _tools.scss into legacy/_collection-layout-toolbar.scss with the rule set unchanged (budget now 2026). At <=760px the toolbar wraps and the suite tabs stack icon above label. The tab override is nested in the base rule, so its specificity matches.
> Findings: I measured the Projects, Addons and Scripts panels at 320/375/768/1024/1440. Tab content stays inside each button, toolbar children don't overlap or clip, and there's no horizontal overflow. Desktop geometry is unchanged. The responsive audit passes all 11 viewports, and check:dashboard and check:studio-visual pass.

