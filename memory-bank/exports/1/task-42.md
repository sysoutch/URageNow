# Task: Fix the two failing companion checks so npm run check passes (id=42)

> Exported from Taskitty at `2026-10-18T14:53:27.989Z`.

- **State:** done
- **List:** Done (id=1)
- **Added:** 2026-10-18T10:54:39.311Z

## Description

After merging #34/#38 into main (e7fe86a, d738dee), everything in npm run check passes except two companion steps that predate that work: scripts/check-android-companion.mjs (expects AndroidManifest configChanges="orientation|screenSize|screenLayout|smallestScreenSize|keyboardHidden") and scripts/check-companion-workflows.ts (expects "2 reference images as parts"). Decide per check whether code or assertion is stale, fix it, and verify npm run check exits 0. Follow-up to #41.

## Comments (2)

> **rainer** — 2026-10-18T11:00:37.689Z
> Fixed in 8b5b6b5 on main (not pushed); `npm run check` now exits 0. Every failure was a stale assertion, not a regression:
> - Android manifest: configChanges="keyboardHidden" is deliberate (companion 876058c lets rotation recreate MainActivity to swap the landscape rail for the portrait bottom bar; onSaveInstanceState restores the workspace). The check now asserts that and that orientation is not swallowed.
> - The same script had 8 more stale assertions: usesLeftSidebar → bottomNavigation orientation switch; bindImageToModelAction → bindImageQuickActions (still offers "Create 3D From Preview", 45d7698); whitespace-tolerant regexes for calls split across lines; MainActivity size ratchet 220 → 250 after the 5c338b9 job notifications (242 lines).
> - check-companion-workflows: since d8d992c parts mode only applies with combineSources: true and separate prompts are the default. The stub matches the current instructions, the parts case sends combineSources, and a new case covers the separate-prompts default.
> Side note: MediaStudioSupport.bindImageToModelAction in the companion repo is now dead code (no callers); left untouched since that repository was not part of this change.

> **rainer** — 2026-10-18T11:00:37.777Z
> Cause: Source-text checks drifted behind intentional refactors in the separate companion repository and the server interpret route. The first failure in each && chain hid all later drift, so more assertions had gone stale than the two reported.
> Solution: Ran the Android check with non-fatal asserts to list every failure, traced each to its originating commit, and updated the assertions to the current intent. Whitespace-only refactors got whitespace-tolerant regexes, and the new default interpret path gained coverage.
> Findings: The companion app lives in its own git repository under apps/android-companion, so its history explains these checks but is not visible in the main repo's log.

