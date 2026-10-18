# Task: Fix the seven pre-existing dashboard check failures (dashboard-server listener, studio-workflows shared queue, studio-media-performance, _model3d.scss line budget, remote Blender catalog label, tool bridge/theme scripts in individual tools) so check:dashboard and check:studio-visual run green end to end (id=34)

> Exported from Taskitty at `2026-10-17T23:59:27.122Z`.

- **State:** done
- **List:** Done (id=1)
- **Added:** 2026-10-17T22:24:32.826Z

## Description

_No description._

## Comments (2)

> **rainer** — 2026-10-17T22:44:38.147Z
> Committed 7b4b64d on branch claude/angry-shtern-02ae07 (fast-forwarded onto local main 63f5e77 first). `npm run check:dashboard` and `npm run check:studio-visual` both pass end to end.
> 
> Per failure, which side was stale:
> 1. check-dashboard-server: the check was stale. The real failing assertion was the access-token POST returning 403. The tsx source map pointed at the wrong line, which made it look like the listener check. Node fetch sends sec-fetch-mode, so the CSRF guard requires JSON. The check now posts JSON like the client does.
> 2. studio-workflows "shared generation queue": the check was stale. All five queue dock panels were removed on purpose in d8d992c, so the assertion was dropped. The leftover queue render calls and the .studio-component-queue CSS are now dead (follow-up).
> 3. studio-media-performance: the check was stale. Since c28b27d, deleting the only remaining merged variant deletes the model entry, and the route and client handle deletedModelEntry. The check now pins that single guarded call.
> 4. _model3d.scss budget: code fix. Video Studio chrome and the low-poly configuration panel were extracted into their own partials, with generated CSS byte-identical. _tools.scss was also over budget (2143/2137); the README overlay moved to legacy/_tools-readme-overlay.scss. Budgets ratcheted to 2657 and 2094.
> 5. Blender catalog "Local Starter Collections": code fix. The section never existed, although the starter catalogs did. Added it to 3D Suites > Scripts. The panel had no scroll owner, so the cards were collapsed to 26px. Fixed with a .global-scripts-scroll container plus mobile-nav clearance. Measured at 320/375/768/1024/1440 with no failures.
> 6. Tool bridges/themes: code fix in the separate URageTools repo (C:\Files\URageNow\tools, gitignored here). Added data-dashboard-theme to 10 pages, the bridge trio to 5, and the theme script to 3 (hub, house-generator, billards/dist). These edits are UNCOMMITTED on URageTools main and need a commit there.

> **rainer** — 2026-10-17T22:44:38.235Z
> Cause: The check suites are && chains, so the first failure hid every later one. Several checks drifted from intentional product changes: the CSRF guard, queue panel removal, and whole-entry deletion of the last variant. One check described a section that was never built. The tool pages live in a separate repo that the check reads through the gitignored tools/ folder.
> Solution: Fixed the stale checks to assert the current contracts. Moved owned SCSS components out at the same cascade position and verified the generated CSS is byte-identical (the readme overlay move only reorders rules that cannot conflict). Added the starter collections section with an inner scroll container, following the addon sub-panel pattern. Patched the URageTools pages.
> Troubles: The worktree had no node_modules and no tools/ folder. I ran npm ci and created a gitignored junction to C:\Files\URageNow\tools. The dashboard static server rejects tools served through the junction, so tool pages were previewed with a temporary static server.
> Findings: tsx-transpiled assert.ok messages can show the wrong source line. Adding explicit messages showed the real failure (403 on the access-token POST, not the listener check). The 3D Suites Scripts panel was visually broken (cards clipped to 26px) because it had overflow:hidden and no scroll owner. At <=768px a higher-specificity responsive rule forces content-wrap overflow to visible.
> Todos: Commit the URageTools page edits (data-dashboard-theme, bridge trio, theme script) in C:\Files\URageNow\tools, required for check-dashboard-tool-bridges/themes on main
> Remove dead per-Studio generation queue renderers (*-bottom-queue-list) and the .studio-component-queue CSS, or restore a deliberate queue region
> 3D Suites tabs at 320px: the layout switcher labels overlap (Cards/Table/SIZE) and the tab icons collide with labels

