# Task: Compact quick action buttons and polish remaining dashboard views (id=41)

> Exported from Taskitty at `2026-10-17T23:59:27.122Z`.

- **State:** done
- **List:** Done (id=1)
- **Added:** 2026-10-17T23:43:05.046Z

## Description

Follow-up to #33 (user request 2026-10-18): make the quick action buttons more compact and continue improving the remaining dashboard views (Studio workflows, 3D Suites, Game Engines, settings/overlays). Fix root causes per memory-bank/styleguides/html-css-styleguide.md; verify at 320/375/768/1024/1440.

## Comments (2)

> **rainer** — 2026-10-17T23:59:23.714Z
> Quick actions compacted and more views polished (uncommitted on main).
> 
> Quick actions:
> - Image Studio: one shape (inline icon + single-line label, 32px, auto-fill 148px columns). The toolbar went from a 213px 3x4 block of tall buttons with mixed icon placement to three compact rows. Removed an nth-child hide/unhide pair that cancelled out.
> - 3D and Video: new owned partial shared/_studio-quick-actions.scss with the same shape. Video no longer highlights arbitrary buttons orange by nth-child position.
> - Studio app bars: buttons inline (Share stacked its icon), auto-save label no-wrap, action track max-content (it spilled over the project chip at ~1024px). The ≤860px rule that hides the project pill, auto-save and secondary icons pointed at non-existent classes; it now targets the real ones, so narrow bars show name + Share + avatar.
> 
> Other fixes:
> - Image GIF play overlay is placed in the preview grid cell (it centered on the whole panel, over the actions); preview row has a min(200px, 32vh) floor.
> - 3D inspector foldouts: Transform/Mesh/Materials/UV & Textures via data-foldout-title (all four read "Transform" because the sibling index is computed after re-parenting).
> - 3D Suites: duplicate Layout/Size toolbar removed (rendered twice in resourceHubView.ts); suite card icons back in their grid cell (selectors still targeted svg after the Bootstrap Icons migration).
> - Game Engines project cards: actions under the copy (they truncated project names); Table layout unaffected.
> 
> Verified at 375/768/1024/1180/1440 by screenshot, no horizontal overflow or page errors; responsive audit passes all 11 viewports; check:runtime passes; 95/101 dashboard+visual+runtime steps pass, and the 5 remaining failures are the pre-existing ones fixed on refs/heads/claude/angry-shtern-02ae07 (#34). Phone stacking of the Image/3D/Video workspaces is fixed on the unmerged refs/heads/claude/gracious-mahavira-5c004f (#38), so it was not redone here.

> **rainer** — 2026-10-17T23:59:23.802Z
> Cause: Quick-action styling was spread over many override layers that disagreed (flex vs grid, fixed 154px/40px buttons, missing display on some buttons, nth-child position rules). Several defects were stale selectors: classes renamed in markup (editor-appbar-actions, svg icons) or index-based labels broken by DOM re-parenting.
> Solution: Gave quick actions one owned contract (shared/_studio-quick-actions.scss plus the Image block in place), removed positional rules, pointed stale selectors at real classes, named foldouts explicitly with data-foldout-title, removed duplicated markup, and restacked Game Engines cards.
> Troubles: Several SCSS files mix CRLF and LF line endings, so the replacements needed an EOL-tolerant helper.
> Findings: The unmerged side branches overlap this area (phone workspace stacking, style budgets), so they should be merged into main before further Studio layout work to avoid conflicts.

