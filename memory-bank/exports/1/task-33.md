# Task: Improve and clean the overall dashboard UI (id=33)

> Exported from Taskitty at `2026-10-17T22:24:36.401Z`.

- **State:** done
- **List:** Done (id=1)
- **Added:** 2026-10-17T21:57:52.910Z

## Description

User request 2026-10-17: further improve and clean the overall URage Now dashboard UI. Scope: audit the main Studio dashboard views (home, studios, tools, bots, settings) for visual inconsistencies, layout defects, responsive problems and dead/duplicated styling; fix root causes per memory-bank/styleguides/html-css-styleguide.md; keep existing checks (build:all, check:dashboard style architecture, responsive audit) passing.

## Comments (3)

> **rainer** — 2026-10-17T22:05:09.485Z
> Root cause of the broken-looking shell found: the full Studio dashboard bootstrap aborted on every load, silently (the rejection went only to setOutput). Three faults in sequence: (1) aiActionHelpers bound guild/moderation buttons that are no longer rendered in the Studio page (Bots now mounts /bots-dashboard) — made optional; (2) rootBootstrapTailHelpers received undefined updateAutomationTextPromptPreset — now passed as a deferred call like sibling helpers; (3) renderImageList threw for the absent moderation list — now returns when its container is missing. Consequences of the abort: rail foldouts overlapping (no studio-home-active / rail-expanded classes), unbound rail/hover handlers, missing theme/runtime polling. Bootstrap failures now also console.error. Added scripts/check-dashboard-bootstrap-ready.ts (Playwright: page must dispatch dashboard:ready with no bootstrap error and a home mode class) and wired it into check:studio-visual.

> **rainer** — 2026-10-17T22:24:32.727Z
> UI cleanup pass completed and verified.
> 
> Layout/visual fixes (root causes, per html-css-styleguide):
> - Rail: .rail-home-wrap rows now grid-auto-rows: max-content — open foldouts no longer collapse to 0px tracks and overlap other categories.
> - Load-time dim overlay removed: bootstrap selects the inspector tab without revealing it (it opened the overlay + scrim below 1550px).
> - Bots view: frame spans the content-shell rows (fills height instead of 100vh-150px); embedded page mirrors the parent theme (was default grey); duplicate inner tab row hidden; Studio-embedded frame no longer shows "Not found" for the scoped-only /api/discord/status; token-based button base for the standalone page; [hidden] made reliable there; redundant "Main Navigation" hint card removed from page.ts.
> - Tools: filter chips regain their size/border (bare .tools-filter-chip lost to .app-shell button reset); chip row drops Bootstrap .row (negative gutters overflowed the toolbar); header actions sit beside the mode switch; phone Tools card no longer clipped (layout toolbar wraps instead of contributing 238px min-content); compact metric tiles scale at 320px; Desktop mode shows the GitHub import form again and its stale three-row template that collapsed it under the launcher is removed.
> - Phone rail: theme picker is icon-only (was native ▶ marker + overflowing label); Bots children icon-only like other categories.
> - Robustness: image/video history responses normalized to arrays (a non-array threw in switchView and left panels inactive).
> 
> Verification: npm run build:all, tsc --noEmit dashboard, responsive audit passes all 11 viewports (failed before this work; its Tools-home import-panel assertion was updated because the panel is intentionally hidden there), screenshots reviewed at 320/375/768/1024/1440 for Studio/Tools/Bots with zero horizontal overflow and no page errors. check:runtime passes fully. Targeted checks pass: bootstrap-ready (new), bots frame/dashboard/layout, discord-only, tools filter/mobile, shell navigation, sidebar split, settings navigation browser, chat sidebar browser.
> 
> Pre-existing failures, confirmed identical on HEAD via stash comparison: check-dashboard-server (network listener check), check-studio-workflows-browser (image shared generation queue), check-studio-media-performance, check-dashboard-style-architecture (_model3d.scss 2788 > 2783 baseline), check-remote-blender-script-catalog (Local Starter Collections), check-dashboard-tool-bridges and check-dashboard-tool-themes (individual tools/ pages missing shared bridge scripts). Nothing committed.

> **rainer** — 2026-10-17T22:24:32.820Z
> Cause: Most visible defects had one hidden root: the Studio client bootstrap aborted on every load because shared bindings referenced Guild/Moderation panels that moved to /bots-dashboard, and the rejection was only written to an output element. The UI looked half-styled (overlapping rail, wrong classes) and later regressions were masked. Remaining defects were CSS layering issues: implicit grid rows collapsing min-height:0 items, specificity losses to the .app-shell button reset, Bootstrap .row gutters, and stale row templates.
> Solution: Made bootstrap-time bindings tolerate absent panels, passed the missing deferred automation helper, and logged bootstrap failures. Fixed layout at the owning containers (rail max-content rows, content-shell row span for the Bots frame, wrapping toolbar, removed stale Desktop-mode template), raised chip specificity, synced the embedded bots page theme, and removed redundant hint markup. Added check-dashboard-bootstrap-ready.ts to check:studio-visual.
> Troubles: The server assembles the client script and CSS at startup, so each verification needed a rebuild plus restart. Baseline comparison required temporarily stashing the working tree.
> Findings: Running bootstrap exposed behavior that only appeared once it completed (overlay inspector opening on load, unnormalized history responses throwing in switchView). Several check-suite failures predate this work and stop their && chains, so later checks were silently not running.
> Todos: Fix the seven pre-existing dashboard check failures (dashboard-server listener, studio-workflows shared queue, studio-media-performance, _model3d.scss line budget, remote Blender catalog label, tool bridge/theme scripts in individual tools) so check:dashboard and check:studio-visual run green end to end

