# Task: Define a type scale and control-height tokens, then remove sub-11px text (id=50)

> Exported from Taskitty at `2026-10-18T14:53:27.989Z`.

- **State:** open
- **List:** Normal Priority (id=5)
- **Added:** 2026-10-18T14:52:04.162Z
- **Tags:** Improvement, UI

## Description

A computed-style audit (2026-10-18) found 45 (home), 71 (Tools) and 36 (Image) visible text elements under 11px per view, with 9px and 10px as the most common sizes, and visible button heights spread over 25/30/32/36/38/40/47/60/61/62/72px. Define tokens in styles/shell (e.g. --text-xs 11px, --text-sm 12px, --text-md 13px, --text-base 14px; --control-sm 28px, --control-md 32px, --control-lg 40px; rail items 62px), replace the literal font-size/min-height values in dashboard/src/styles with them, and add a check script that fails when a studio or home view renders text under 11px. Keep the existing style-architecture line budgets.

## Comments (0)

_No comments._
