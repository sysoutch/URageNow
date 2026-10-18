# Task: Add a toast notification layer for generation results and errors (id=53)

> Exported from Taskitty at `2026-10-18T14:53:27.989Z`.

- **State:** open
- **List:** Ideas + Nice to have (id=7)
- **Added:** 2026-10-18T14:52:04.648Z
- **Tags:** Feature, UX

## Description

The dashboard has no transient notification surface (no toast/notification module under dashboard/src/client/modules); results and errors only appear in each studio's Status log or via setOutput, so a finished 3D model or a failed request goes unnoticed when the user is on another view. Add one themed, stackable toast region (bottom-right on desktop, top on phones) with success/error/info variants, an action slot ("Open", "Retry"), auto-dismiss with hover pause, prefers-reduced-motion support and an aria-live region. Emit toasts from generation completion (image/3D/audio/music/video), tool import, runtime start/stop, and request failures. Respect a Settings › UI toggle.

## Comments (0)

_No comments._
