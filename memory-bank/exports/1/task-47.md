# Task: Move the URage Discord community link out of the first rail slot (id=47)

> Exported from Taskitty at `2026-10-18T14:53:27.989Z`.

- **State:** open
- **List:** Normal Priority (id=5)
- **Added:** 2026-10-18T14:52:03.682Z
- **Tags:** UX, Very short task

## Description

#39 (a92fd5f) added `.rail-discord-link` to the top of `.rail-home-wrap`, so an external community link is the first item in the primary rail, above the URage Now brand, in every view (see page.ts and shared/_expanded-rail-navigation.scss). Navigation hierarchy should start with the product. Move the link to the rail footer beside About/Resources (or into the About overlay and the desktop title bar only), keep its external-link affordance, and update scripts that assert the rail order (check-studio-shell-navigation.mjs, check-dashboard-bootstrap-ready.ts if needed). Verify in expanded, compact and phone rail modes.

## Comments (0)

_No comments._
