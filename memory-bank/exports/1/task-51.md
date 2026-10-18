# Task: Bring all 71 tool pages up to the dashboard integration contract (id=51)

> Exported from Taskitty at `2026-10-18T14:53:27.989Z`.

- **State:** open
- **List:** Normal Priority (id=5)
- **Added:** 2026-10-18T14:52:04.325Z
- **Tags:** Refactor, Very long task

## Description

Audit of tools/*/*/index.html on 2026-10-18 against tools/TOOL_TEMPLATE.md: 39 pages lack ../../shared/dashboard-tool-bridge.js (no asset handoff), 11 load scripts from CDNs (texture_map_painter, 3d-model-sharer, csharp-class-extractor, css-background-generator, css-to-scss, electron-app-icon-generator, house-generator, html-separator-and-combiner, qr-code-creator, website-builder, filer) so they break offline, 4 have no viewport meta (favicon-creator, svg-editor, csharp-class-extractor, css-to-scss), 6 have no README, 8 have no thumbnail.png, and only 17 of 71 have tool.json (most of those lack title and schema version). scripts/check-dashboard-tool-bridges.mjs and check-dashboard-tool-themes.mjs currently pass only because of exemption lists. Work category by category: add the bridge + autodescribe scripts, vendor CDN libs under tools/shared/libs, add viewport/README/thumbnail/tool.json, then shrink the exemption lists to zero.

## Comments (0)

_No comments._
