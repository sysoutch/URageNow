# Task: Add runtime-importable games and Discord Token Typing game (id=26)

> Exported from Taskitty at `2026-10-17T22:24:36.401Z`.

- **State:** doing
- **List:** Doing (id=3)
- **Added:** 2026-10-09T15:54:12.910Z

## Description

Build a per-messenger-runtime game import system instead of hardcoding one game into Discord.

Dashboard: add a Games view where administrators can import/register a game package, inspect runtime compatibility, enable/disable per runtime, and delete imported games. Persist catalog and enabled state. Validate package manifests/files and prevent path traversal or executable code from escaping the game sandbox.

Runtime: begin with the Discord bot. Add a generic game registry/adapter contract, discover imported Discord-compatible games, and expose enabled games through a game command/interaction flow.

First game: adapt the existing Token Typing Simulator at C:\Files\github\URage-suite\URage Tools\simulation\token_typing_simulator\index.html. Preserve its Guess the speed rules: choose a hidden speed for each round, stream the supplied/default text at that rate (1 word ~= 1.3 tokens), accept a numeric tokens/second guess, reveal speed/error/score, and support a configurable number of rounds. Render the typing animation as an animated GIF attached in Discord. Use Discord buttons and a modal/text input for rounds and guesses. Players guess independently and receive individual scores/rankings; one participant's submission must not lock other participants out.

Acceptance: package import/delete/enable/disable is runtime-scoped; no game is compiled directly into the bot's command logic; Discord can run the first game and collect concurrent per-user answers; generated GIF is valid within Discord upload limits; commands/interactions respect permissions, timeouts and cleanup; tests cover manifest validation, game state/scoring, GIF output, per-user interactions and import lifecycle. Document supported package format and failure behavior.

## Comments (20)

> **rainer** — 2026-10-09T16:04:00.985Z
> Implementation started. Added a data-only game catalog/package store with strict manifest validation, per-runtime enable state, bundled-package discovery, import/delete APIs and a Discord Games view with package upload/management. The initial security review rejected dynamic imports of uploaded JavaScript as arbitrary server-side code execution; the design now accepts declarative JSON and invokes reviewed runtime adapters only. Added the bundled Token Typing package and began the Discord `/game` picker, per-player guess flow and FFmpeg animated preview adapter. Runtime/TypeScript verification is still pending.

> **rainer** — 2026-10-09T16:06:37.350Z
> Implementation now includes a per-runtime declarative package catalog, JSON import/delete/enable/disable management in the Discord Games dashboard, a built-in Token Typing package, `/game` selection, animated GIF rounds, individual private numeric guesses, and a host-controlled round flow with an individual leaderboard. Package validation limits `typing-speed` to Discord until another runtime adapter is actually implemented. Verification is pending: the local command runner currently fails before launching commands (`helper_unknown_error: setup refresh had errors`), so TypeScript builds, checks, FFmpeg output, and live Discord interactions remain unverified. Task remains Doing pending those checks and review.

> **rainer** — 2026-10-09T16:17:57.537Z
> Follow-up build fix: narrowed the Discord game `open` action to button interactions before calling `reply`, addressing TS2339 for the generic Interaction union. I attempted `npm run build:all` and `npm run build:dashboard:ts` after the fix, but the local command runner again failed before process launch with `helper_unknown_error: setup refresh had errors`; the TS build result is therefore still unverified.

> **rainer** — 2026-10-09T16:33:55.377Z
> Follow-up from the user not seeing `/game`: the bot does not automatically publish slash-command changes when it starts; it has an explicit Discord registration command. Also, previously-created command-settings files can omit newly added commands. Added a versioned command-settings migration that enables the newly introduced `game` command once for legacy settings, preserving later user toggles. Intended publish step: `npm --prefix bots/discord-bot run register`. I could not run build or publish here because the command runner again failed before launch (`helper_unknown_error: setup refresh had errors`).

> **rainer** — 2026-10-09T16:42:12.155Z
> Dashboard usability follow-up: Guild subview tabs now use a delegated document click handler (safe if tabs are injected/rebuilt after boot), prevent default navigation, and have explicit `type=button`. Added `scripts/check-guild-subview-tabs.mjs` to verify the Commands tab activates its matching panel and binds once. `node --check dashboard/src/client/modules/workspacePanelHelpers.js` passed; focused test and dashboard build could not launch because the command runner failed with `helper_unknown_error: setup refresh had errors`.

> **rainer** — 2026-10-09T16:52:26.250Z
> User confirmed Guild subtabs still did not respond after rebuild/reload in a local web browser. Follow-up trace found `bindSubviewTabs()` was invoked only after async dashboard refresh/workspace loading in appBootstrapHelpers.start; any earlier initialization failure left Guild and Moderation tabs unbound. The workspacePanelHelpers script now installs one delegated click handler immediately when the client script executes, keeps early selections until state is initialized, and has a focused regression check for an early Commands click. `node --check` passed for the updated helper. The local command runner still rejects execution of the focused test/build before process launch (`helper_unknown_error: setup refresh had errors`), and live browser behavior remains to be confirmed.

> **rainer** — 2026-10-09T17:05:09.552Z
> User supplied token-typing-round-1.gif for visual review. Inspected the GIF binary and frames: it was 640x360 but only 2 frames at 0.2 s each, an almost blank frame followed by the entire default paragraph. Reworked the Discord renderer with adaptive 6-30 fps typing based on the actual speed, a readable ready frame, a completed hold, larger text in a bounded scrolling panel, progress indicator, solid background, and palette encoding without Bayer dither. Rejected texts under 20 or over 100 words (also max 600 chars) because very short samples cannot expose the hidden speed; kept source 5-150 tokens/s scoring. Rendered and visually inspected a 140 tokens/s default-text preview: 64 frames, 2.13 s, 35,625 bytes, no green transparent corners. Stress-rendered 100 words at 5 tokens/s: 169 frames, 28.17 s, 99,083 bytes; final composed frame stayed legible. Discord `tsc --noEmit`, dashboard TypeScript build, and `git diff --check` passed. Live Discord playback remains user-side verification.

> **rainer** — 2026-10-09T17:12:49.546Z
> Discord Token Typing follow-up: each accepted modal guess now posts a public acknowledgement with player and round, without revealing the value, and sends a private receipt with that player's guess. The game records actual speed per round and round-numbered guesses; the final ranked report lists all actual speeds plus each player's per-round guess, actual speed, accuracy, and average. Long reports split at 1900 characters into Discord follow-up messages. Advancing a round reveals the previous actual speed. Updated docs/games-runtime.md. Verified with `npm --prefix bots/discord-bot run check`, `npm run build:dashboard:ts`, and `git diff --check`; no live Discord session exercised.

> **rainer** — 2026-10-09T17:27:44.309Z
> Added dashboard-managed Token Typing text rotation. Installed typing-speed packages now expose an Edit texts form for 1-30 passages, default rounds, and sequential/random/shuffle selection. Server validates every text (20-100 words, <=600 chars), preserves legacy single-text packages, and atomically saves configuration without losing runtime enable state. Discord host modal now asks only for rounds; each session snapshots its selected text per round, with ordered looping, random repeats, or shuffle-bag rotation. Updated bundled package to three valid example passages and docs/games-runtime.md. Verified `npm run check:games` (isolated persistence and Chromium editor flow), dashboard CSS and TypeScript builds, Discord TypeScript check, JS syntax, and scoped diff check. No live Discord round or live dashboard service was exercised.

> **rainer** — 2026-10-09T17:37:31.217Z
> Discord Token Typing finish presentation: the host's Finish/End interaction now sends a new public results message through interaction.followUp after deferUpdate, leaving the last GIF message and attachment untouched. Results use emoji/Markdown scorecards (medals, actual speed per round, each player's guesses and accuracy, average ranking); long reports continue in further messages under 1900 characters. Original GIF buttons remain visible but are rejected after the session ends. Updated docs/games-runtime.md. Verified `npm --prefix bots/discord-bot run check`, `npm run build:dashboard:ts`, and scoped `git diff --check`; no live Discord interaction was exercised.

> **rainer** — 2026-10-09T17:51:05.309Z
> Final-results presentation follow-up: replaced plain Markdown scorecard messages with Discord embeds. Each embed shows actual speeds and player fields with rank, average accuracy, every round guess/actual/score; large games paginate across separate embed follow-ups while leaving the last GIF untouched. Added a 100-player/10-round limit check, updated docs/games-runtime.md, and verified npm run check:games, npm --prefix bots/discord-bot run check, and root npm run build:all. Live Discord delivery remains untested.

> **rainer** — 2026-10-09T23:05:18.242Z
> Continuing the runtime-games task with Derby Lab improvements requested on 2026-10-10: preserve every race GIF as a separate Discord message, support one wager per racer per player, add a host species selection (horse/penguin/emu), and add countdown plus held finish scenes to the generated replay. I am tracing the existing adapter/renderer contracts first, then will update focused checks and the games runtime documentation.

> **rainer** — 2026-10-10T10:33:58.481Z
> Completed the Derby Lab follow-up: roster species is data-backed (`horse`/`penguin`/`emu`) and selected by the host before the round modal; a player can keep one wager per racer; each race retires only the prior controls and posts its GIF as a fresh Discord message; replays include 3–2–1–START and a held winner screen. Also fixed the Bots dashboard regression that hid Discord's other tabs: the bots shell now embeds the canonical standalone Discord dashboard at `/discord-dashboard`, restoring Guild, Commands, Messages, Automation, Moderation, Games, and Activity without duplicating the panel markup. Verified with `npm run check:games`, `npm run check:discord`, `npm run build:all`, focused dashboard scope checks, and a Playwright iframe/tab-switch check.

> **rainer** — 2026-10-10T10:37:57.187Z
> New Derby Lab bug follow-up: the replay’s random lane ordering is not constrained to the server-selected winner, so the GIF can disagree with the result. I am binding the animation to that winner and separating the replay from the result message with a first-play duration delay.

> **rainer** — 2026-10-10T10:41:11.771Z
> Fixed the Derby Lab winner mismatch. `racingFinishRanks` now forces the same server-selected `winnerIndex` used for payout/result text into first place in the replay, while randomizing only the other finishers. The replay is posted attachment-only; the textual round result and next controls wait for its measured 12.125-second first playback. Added a finish-rank assertion, updated the interaction check to assert replay-before-result ordering, rendered and inspected a real Blue Moon finish frame, then restored the default Thunderbolt preview. Passed `npm run check:derby-lab`, `check-discord-game-start-routing`, `npm run check:discord`, and `npm run build:all`.

> **rainer** — 2026-10-10T10:42:17.206Z
> Dashboard visual-regression follow-up: embedding the legacy Discord-only page restored tabs but imported its separate orange/grey stylesheet, changing the user-facing Bots dashboard. I am reverting that embedding and restoring the original shared generated dashboard appearance while rendering the missing Discord panels in the shared shell.

> **rainer** — 2026-10-10T10:45:17.959Z
> Corrected the Bots dashboard visual regression. The legacy Discord-only iframe and its incompatible stylesheet are removed. The all-bots page now renders the shared generated dashboard components directly and keeps a persistent shared-style workspace tab strip for Overview, Messages, Guild (with Commands), Moderation, Games, Automation, and Activity. The Playwright layout check now verifies the shared-style tabs stay visible while switching Guild/Moderation and that the Discord Guild Commands subtab is present. `npm run build:all` passed.

> **rainer** — 2026-10-10T16:01:36.115Z
> Investigating a main Dashboard Tools regression: the Tools view does not become usable and category clicks do not select. Tracing shared view routing and tools filter event delegation before patching.

> **rainer** — 2026-10-10T16:03:39.542Z
> Fixed the main Tools page interaction regression. `studioSidebarHelpers` was treating every `[data-tools-filter]` as a rail click, so catalog category clicks were redirected back to the rail and never reached `workspaceHelpers`. Promotion now applies only inside `.rail-tools-categories`. Added `scripts/check-tools-filter-event-scope.mjs` to `npm run check:tools`, documented the selector contract in the memory bank, and verified the targeted regression check plus `npm run build:all`. The broader `npm run check:tools` remains blocked by a pre-existing `check-remote-blender-script-catalog.mjs` assertion expecting `Local Starter Collections`.

> **rainer** — 2026-10-10T16:13:57.943Z
> Second Tools regression diagnosis and fix: the catalog DOM and filters existed, but `bindToolsViewEvents()` was never reached by the full dashboard bootstrap, while the separately loaded Browser/Desktop/Mobile handler did run. That explains why only those mode tabs worked. Tools now self-binds on DOMContentLoaded and uses an idempotent guard so the normal bootstrap cannot duplicate listeners. Live Playwright against http://127.0.0.1:4782 verified Tools home is visible, Art & 3D becomes active, 22 matching tools are shown, and there are no page errors. `npm run build:all` and the targeted filter/binding regression check pass.

