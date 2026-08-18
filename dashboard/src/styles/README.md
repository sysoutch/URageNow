# Dashboard Styles

The root `styles.scss` is only a loading map. Keep new CSS in the smallest responsible layer instead of adding more selectors to the root or to broad legacy files.

## Layers

- `shell/`: app grid, left rail, sidebars, and global navigation structure.
- `navigation/`: shared workflow/category/resource rail lists.
- `bootstrap/`: Bootstrap token mappings and component bridges.
- `legacy/`: old broad stylesheets kept for compatibility while we migrate them away.
- `studio/`: LazyDev, Tools, Assets, 3D Suites, focused workflow, and theme-specific Studio surfaces.
- `messenger/`: messenger dashboard/channels/workspace structure only, not custom theme colors.
- `shared/`: late shared overrides that intentionally apply across multiple dashboard views.

The shared production baseline lives in `shared/_production-foundation.scss`. It owns cross-dashboard viewport resilience, keyboard focus, reduced-motion behavior, safe-area handling, and minimum mobile interaction behavior. Feature-specific layout still belongs in its feature layer.

## Rules

- Prefer moving touched selectors out of `legacy/` into a narrower folder.
- App-wide appearance controls live in `shared/_appearance.scss`. Radius, padding, and margin selectors for tabs, buttons, selections, inputs, textareas, selects, ranges, checkboxes, chips, cards, foldouts, sidebars, toolbars, lists, tables, badges, modals, overlays, previews, outputs, and rails should use the `--dashboard-*` component variables instead of redefining separate hardcoded component geometry.
- Global alert and confirmation popup structure lives in `shared/_popup.scss`; keep it independent from Studio workflow and rail styling.
- Studio-specific visual treatment belongs in `shared/_studio-components.scss` only when it depends on workflow state, workflow accents, the focused Studio shell, or the far-left rail. Do not put generic tabs/forms/cards/overlay appearance plumbing there.
- Relocated Studio inspector sizing, foldouts, and single-scroll ownership live in `shared/_studio-right-sidebar.scss`; keep workflow-specific sidebar fixes out of the shared Studio catch-all.
- Manager overlays with a left navigation/config column and a right work area should use the shared `overlay-manager-grid`, `overlay-manager-sidebar-card`, `overlay-manager-main-card`, `overlay-manager-section-heading`, and `overlay-manager-card-body` classes. Top-level manager sections should be real cards with headings; reserve `<details>` foldouts for nested expandable content.
- Do not add messenger-specific colors/radii unless they are token-backed and apply through the active dashboard theme.
- Far-left rail behavior belongs in shared rail styles. Feature styles may show/hide their own child groups, but should not redefine rail button geometry.
- Workflow rails, workflow sidebars, and focused workflow control strips should stay flat: use square corners, token-backed borders, and workflow-specific accent tokens instead of glossy gradients or theme-colored pill buttons.
- Primary Image, Video, and 3D workflow tab geometry lives in `studio/_workflow-tabs.scss`; shared focused panel placement remains in `studio/_focused-workflow.scss`.
- Focused workflow breakpoint adaptations live in `studio/_focused-workflow-responsive.scss`, loaded directly after the base focused workflow rules.
- Focused 3D viewer options, quick actions, and tool-picker refinements live in `studio/_focused-workflow-model3d.scss`. Keep that partial after the focused responsive stylesheet so its desktop refinements preserve cascade order.
- Shared `Send To ...` destination overlay styling for Image and 3D Studio lives in `media-ai/_model3d-send-destination.scss`; keep workflow-specific actions in their feature modules rather than the legacy media stylesheets.
- Home surfaces have three narrow owners: `shared/_home-command-centers.scss` owns the URage NOW launchpad, `shared/_lazydev-home-layout.scss` owns the LazyDev work dashboard, and `shared/_studio-home-insights.scss` owns usage charts and media filters. Keep LazyDev analytics visible and graph-based; do not collapse them into plain summary counters.
- Use the locally served Bootstrap Icons font for ordinary controls and actions. Reserve inline SVG for brand marks, workflow illustrations, or shapes Bootstrap Icons cannot express; do not add one-off button SVG paths.
- Shared Image, Video, Audio, and Music dock panels, queue rows, and filmstrips live in `media-ai/_media-docks.scss`; do not put cross-media dock components back into the 3D workflow stylesheet.
- Keep stylesheet spacing compact. The architecture check rejects runs longer than two blank lines so legacy files cannot accumulate invisible line-count inflation.
- Oversized legacy and Studio hotspots have no-growth line budgets in `scripts/check-dashboard-style-architecture.mjs`. New work must extract an owned component instead of expanding those files.
- If a selector needs `!important`, first check whether it belongs in a later layer or a narrower component file.
- Embedded tools that want their own left controls in the Studio second sidebar should mark one in-frame root with `data-dashboard-tool-sidebar`. Dashboard mirrors that root through `toolsView.ts` / `workspaceHelpers.js`; avoid hardcoding per-tool sidebars in the dashboard shell.
- The dashboard also falls back to common tool sidebar containers such as `aside.sidebar`, `aside.side-panel`, and `.tool-sidebar` so older tools still move into the Studio sidebar. Prefer explicit markers for new tools, but do not add per-tool dashboard selectors.
- Mirrored tool sidebars copy computed styles from the in-frame source before being inserted into the dashboard sidebar. Dashboard CSS should only provide shell sizing and low-risk fallbacks; it must not re-template every cloned control.
- Mirrored tool sidebars are hidden by an injected `[data-dashboard-external-sidebar-source]` rule when the dashboard externalizes them. Tool-local `body[data-dashboard-sidebar-externalized] ...` hide rules are still okay, but the global mirror flow must not depend on every tool having one.
- The Tools second sidebar width is user-resizable through the shared Tools layout CSS variable and persisted in client state. Mirrored tool controls must remain fluid: avoid fixed/min widths in dashboard mirror styles, and preserve normal document flow by default. Use `minmax(0, 1fr)` only for actual row/grid widgets, not whole cloned sidebars.
- Sidebar resize handles must be edge-only hit targets. Do not let global button/control rules stretch them across the sidebar, or sidebar clicks will be intercepted.
- Mirrored native inputs should keep native proportions where appropriate. In particular, checkboxes/radios should not inherit full-width button/input sizing.
- Mirrored native `<details>` controls must stay in normal document flow. Do not force every child into dashboard grids; open panels should expand their own height so tool sidebars do not overlap.
- All standalone tool `index.html` files should include `tools/shared/dashboard-theme.js` and a `data-dashboard-theme` host attribute. `npm run check:tools` enforces this, so theme drift should be fixed at the shared bridge or tool token layer instead of screenshot-by-screenshot.

## Responsive Verification

With the local dashboard running, use `npm run audit:dashboard:responsive` to check desktop and phone shell overflow and capture reference screenshots under the ignored `artifacts/dashboard-responsive-audit/` directory. An optional dashboard URL and output directory can be passed directly to `scripts/audit-dashboard-responsive.mjs`.
