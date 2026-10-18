# Task: Audio/Music Studio phone layout: studio-workflow-layout resolves to 0px main + 280px side at <=375px, so the main column collapses and the bottom dock overflows the card (id=38)

> Exported from Taskitty at `2026-10-17T23:59:27.122Z`.

- **State:** done
- **List:** Done (id=1)
- **Added:** 2026-10-17T23:02:17.963Z

## Description

_No description._

## Comments (2)

> **rainer** — 2026-10-17T23:09:16.720Z
> Fixed in commit a7da90a on branch claude/gracious-mahavira-5c004f.
> 
> Root cause: in dashboard/src/styles/studio/_responsive.scss, inside `@media (max-width: 1520px)`, the rule for `body.view-ai-active.studio-workflow-focused :is(#model3d/#image/#audio/#music/#video ... workspace)` set `grid-template-columns: minmax(0, 1fr) minmax(280px, 320px) !important` and pinned the side panel to `grid-column: 2`. Nothing limited it to desktop, so it applied all the way down to phones and beat the single-column stack rules (studio/_responsive.scss max-width 980, media-ai/_responsive.scss max-width 1180). The Chat workspace rule beside it was already scoped to `@media (min-width: 981px)`.
> 
> Fix: moved both media-Studio rules into that same min-width 981px block. No new overrides anywhere else. Regenerated dashboard/src/generated.css.
> 
> Verified with Playwright against the stub dashboard server (Audio + Music):
> - 320 / 375 / 768: one 232 / 287 / 666px column; main, side, bottom dock and filmstrip all inside the card; card and document scrollWidth overflow is 0.
> - 1024 / 1440: two columns unchanged (602+320 / 1018+320).
> - Generation Queue panel: this branch doesn't have 5e58763 (it's on claude/angry-shtern-02ae07), so I cherry-picked it temporarily. With it, the queue stacks under the filmstrip at 320/375 and sits beside it at 768+, inside the card at every width. Temporary changes reset afterwards.
> 
> Checks: `npm run check:dashboard` and `npm run check:studio-visual` both fail, and I reproduced every failure on main without this change: check-tool-catalog-metadata ('Games' category missing from the local data dir), check-dashboard-gif-handoff (untracked tools/ folder is missing from the worktree), check-dashboard-server, check-dashboard-style-architecture (_model3d.scss is 2788 lines against a 2783 baseline), check-studio-media-performance, check:tools, and check-studio-workflows-browser ('image must use a shared generation queue', which 5e58763 addresses). Every other step of check:dashboard passes, including tsc.

> **rainer** — 2026-10-17T23:09:23.584Z
> Cause: In studio/_responsive.scss, a desktop-only two-column `!important` grid for the media Studios sat in a max-width 1520px block with no lower bound, so phones got it too: a 0px main column next to a 280px side track.
> Solution: Scoped the grid and the side placement to min-width 981px, matching the existing Chat rule. Phones fall back to the existing single-column stack rules.
> Troubles: The queue panel commit (5e58763) isn't on this branch, so I verified the queue with a temporary cherry-pick. Both required check suites fail on main for unrelated, pre-existing reasons, listed in comment 82.
> Findings: The Chat workspace had already been fixed for this exact problem with the same min-width 981px scope; the media Studios were left out. A max-width block holding `!important` grid tracks needs a lower bound.

