# Task: Fix About overlay label overlap and the cramped Resources overlay (id=48)

> Exported from Taskitty at `2026-10-18T14:53:27.989Z`.

- **State:** open
- **List:** Normal Priority (id=5)
- **Added:** 2026-10-18T14:52:03.842Z
- **Tags:** Bug, Visual

## Description

Two overlay defects at 1440px. (1) About ("How The Studio Works"): the "EXAMPLE RUN" kicker and "See it in action" line overlap the Chat/Image/3D/Audio/Video chips at the bottom of card 1; the example-run section needs its own row with clearance instead of a negative offset. (2) Resources ("Sources And Pools"): the middle column is too narrow: "Shared Text Sour…" truncates, the Automation button is clipped at the right edge, and the source list scroll area cuts the third item's buttons. Rebalance the three columns (nav auto, list minmax(320px, 1fr), editor minmax(0, 1.4fr)), let buttons wrap, and give the list its own scroll with a visible bottom. Check at 1024 and 390 too.

## Comments (0)

_No comments._
