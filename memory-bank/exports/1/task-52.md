# Task: Rewrite tools/README.md for the in-dashboard tools workspace (id=52)

> Exported from Taskitty at `2026-10-18T14:53:27.989Z`.

- **State:** open
- **List:** Normal Priority (id=5)
- **Added:** 2026-10-18T14:52:04.485Z
- **Tags:** Documentation

## Description

tools/README.md still documents deploying the folder as tools.your-page.com with scripts/build-catalog.js, Open Graph publishing, and a Playwright smoke check that no longer matches how the dashboard serves /tools/ (confined static route, catalog metadata API, Add Tool / Move Tool workflows, Browser/Desktop/Mobile modes). Rewrite it to describe: folder layout and category ids (tools/categories/*.json), the TOOL_TEMPLATE contract, how the dashboard discovers and themes tools, the bridge scripts and what they provide, how to add or move a tool from the UI, and which npm check scripts validate tools. Keep the public URageTools repository link. Remove the duplicated paragraph in TOOL_TEMPLATE.md ("Changing a category label…" appears twice).

## Comments (0)

_No comments._
