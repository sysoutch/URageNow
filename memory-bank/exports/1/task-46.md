# Task: Give Audio, Music and Chat the compact Studio app bar used by Image, 3D and Video (id=46)

> Exported from Taskitty at `2026-10-18T14:53:27.989Z`.

- **State:** open
- **List:** Normal Priority (id=5)
- **Added:** 2026-10-18T14:52:03.520Z
- **Tags:** Improvement, UI

## Description

Image/3D/Video studios open with a 51px editor app bar (icon, name, BETA, project chip, auto-save, actions, avatar). Audio, Music and Chat still render the legacy large header: a big title, a paragraph subtitle and a lone History / New Chat button (aiView.ts: audio ~2838, music ~3073, chat ~691). The product therefore changes shape between studios. Build the same app-bar component for the three (name, project chip where applicable, History/New Chat as actions, avatar) and move the subtitle into a tooltip or the empty state. Keep the workflow settings footer. Verify at 390/768/1024/1440 and keep check:studio-visual green.

## Comments (0)

_No comments._
