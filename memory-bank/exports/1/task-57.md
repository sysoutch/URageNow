# Task: UI/UX and tools audit 2026-10-18 (survey record) (id=57)

> Exported from Taskitty at `2026-10-18T14:53:27.989Z`.

- **State:** done
- **List:** Done (id=1)
- **Added:** 2026-10-18T14:52:05.281Z
- **Tags:** Documentation

## Description

Survey of every dashboard view at 1440 and 390px plus a computed-style audit and a structural audit of tools/, run after #33/#41/#42 and the #34/#38/#39 merges (main e7fe86a..8b5b6b5). Findings were filed as follow-up tasks #43–#56: bugs #43 #44 #45 #48 #49, improvements #46 #47 #50 #51 #52, cool-factor features #53 #54 #55 #56. Method: Playwright screenshots of Audio, Music, Chat, Settings, Resources, Skills, About, Console, Theme, Tools (browser/desktop/mobile, active tool), Bots (overview/messages/automation); per-view counts of font sizes, button heights, radii, focus styles; tools/*/*/index.html scanned for bridge/theme/viewport/README/thumbnail/tool.json/CDN use.

## Comments (2)

> **rainer** — 2026-10-18T14:53:23.000Z
> Survey complete. Views screenshotted at 1440/390: Audio, Music, Chat, Settings, Resources, Skills, About, Console, Theme picker, Tools (browser/desktop/mobile/active SVG Editor), Bots (overview/messages/automation). Zero horizontal overflow and no page errors in any view. Computed-style audit: 45/71/36 visible text nodes under 11px on home/Tools/Image; button heights spread over 11 values; every radius 0 from the appearance tokens; 35 scattered focus-visible rules; 37 reduced-motion blocks. Tools audit (67 index.html pages, 71 tool folders): 39 without the dashboard bridge, 11 with CDN scripts, 4 without viewport, 6 without README, 8 without thumbnail, only 17 tool.json. Hard-coded numbers in the Tools home analytics card. Defects filed as #43 #44 #45 #48 #49; improvements #46 #47 #50 #51 #52; cool-factor features #53 #54 #55 #56. No code changed in this task.

> **rainer** — 2026-10-18T14:53:23.093Z
> Cause: Fast feature growth across studios, bots and 67 imported tools without a shared type/control token scale or a notification surface.
> Solution: Filed 14 scoped tasks (#43–#56) with root causes, file paths and acceptance criteria so each can run as its own session.
> Findings: The product's feel is uneven more than broken: three studios keep a legacy header while three use the compact app bar, feedback lives only in per-studio status logs (no toasts), empty states are inert, and small type (9–10px) dominates dense views. The tools catalog is the largest gap: most pages predate the integration contract and the checks pass through exemption lists.
> Other: Suggested order: #43 and #47 (minutes each), then #44 #49 #48 (phone/overlay bugs), #45 (honest analytics), #46 + #50 (consistency), #51 + #52 (tools), then #53 #55 #54 #56 for the cool factor once the structure is stable.

