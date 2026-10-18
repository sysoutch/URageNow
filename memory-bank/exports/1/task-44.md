# Task: Audio/Music Studio phone layout: status and queue still overlay the form (id=44)

> Exported from Taskitty at `2026-10-18T14:53:27.989Z`.

- **State:** open
- **List:** High Priority (id=4)
- **Added:** 2026-10-18T14:50:43.506Z
- **Tags:** Bug, UI

## Description

At 390px the Audio Studio (and Music) still overlaps after #38: the Status/Preview sidebar sits on top of the Audio Prompt textarea, and the Generation Queue card covers the Recent Audio strip (see the bottom dock, which is absolutely positioned in studio/_focused-workflow-*.scss). Root-cause per memory-bank/styleguides/html-css-styleguide.md: make the workspace a single scrolling column on phones (form → sidebar foldouts → recent dock → queue) with no absolute positioning, as Chat already does. Verify at 320/375/390/768 with screenshots and no horizontal overflow. Also check Video Studio at 390 (its bottom dock uses the same pattern).

## Comments (0)

_No comments._
