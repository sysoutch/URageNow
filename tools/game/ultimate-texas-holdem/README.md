# Ultimate Texas Hold'em

Static browser implementation of Ultimate Texas Hold'em for the URage NOW Games catalog.

## Run

Open `index.html` through the dashboard. The root entry redirects to `dist/index.html`, where all runtime HTML, CSS, JavaScript, and audio assets live. The tool has no npm install, development server, or build step.

## Table rules

- A pre-game saloon map gates progressively higher-stakes tables by bankroll and offers valid quick Ante choices. Unlock requirements are not entry fees.
- Opening play uses Ante plus a matching Blind; Trips is optional.
- The Play wager is 3x or 4x before the flop, 2x after the flop, or 1x after the river. Settings can restrict the preflop choice to 3x only.
- Every wager is checked against the remaining bankroll. An unaffordable Play wager is rejected rather than silently reduced to an illegal partial wager.
- Dealer qualification is enabled by default and requires at least a pair of fours.
- Qualification uses the dealer's best five-card result across both dealer cards and all five community cards. A qualifying pair may therefore be entirely on the board.
- When the dealer does not qualify, Ante, Blind, and Play are returned. Trips still settles independently from the player's best seven-card hand.
- Settings can instead pay a winning Ante at 1:1 against a non-qualifying dealer. In that mode, Blind and Play are still returned; a losing or tied Ante still pushes. The original push-all policy remains the default.
- A non-qualifying dealer and a dealer tie have distinct result messages; side-bet profit or loss does not relabel the main-hand outcome.
- The minimum qualifying hand and qualification toggle remain configurable in the Settings dialog.

## Mobile layout

At phone widths, the table prioritizes the current decision rather than preserving desktop casino-table geometry. The HUD becomes a compact two-card summary, opening wagers use a two-column touch layout, inactive table regions are hidden until cards are dealt, cards scale to fit five community slots without horizontal scrolling, and the settings dialog uses the full viewport with a reachable footer.

## Static layout

- `index.html` — dashboard-compatible catalog entry.
- `dist/index.html` — runnable game page.
- `dist/assets/` — compiled stylesheet and local sounds.
- `dist/js/` — readable native ES modules; no package manager or bundler is required.

## Verification

From the repository root:

```powershell
node scripts/check-ultimate-texas-holdem-dealer-qualification.mjs
node scripts/check-ultimate-texas-holdem-ui.mjs http://127.0.0.1:8765/tools/game/ultimate-texas-holdem/dist/
npm run check:tools
```

The UI check expects the repository root to be served over HTTP on port `8765`, for example with `python -m http.server 8765 --bind 127.0.0.1`.
