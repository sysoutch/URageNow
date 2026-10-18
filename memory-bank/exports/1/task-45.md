# Task: Replace hard-coded Tools home analytics with real usage data (id=45)

> Exported from Taskitty at `2026-10-18T14:53:27.989Z`.

- **State:** open
- **List:** High Priority (id=4)
- **Added:** 2026-10-18T14:50:43.667Z
- **Tags:** Bug, UX

## Description

dashboard/src/pageSections/toolsView.ts lines ~465-471 render a fixed "Tool runs 1,248 +18.6%" stat, a static sparkline and "Week 1…Today" axis, and the category bars are static too. This presents fake numbers as workspace analytics. Either (a) back it with real data: tool opens are already tracked for "Recently used" — persist per-day counts in dashboard data, expose them through the tools API, and render the sparkline/category bars from that; or (b) remove the card until data exists. Acceptance: no literal numbers in the markup, the stat reflects local history, empty history shows an honest empty state. Also audit the LazyDev home "Usage Overview" chart (aiView.ts ~600) for the same problem.

## Comments (0)

_No comments._
