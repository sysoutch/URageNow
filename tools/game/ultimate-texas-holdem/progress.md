Original prompt: implement the texas holdem poker tool like the others. i donnt need the npm things, only the static files in dist folder. also the rules aren't exactly same yet, and it need more checks if cash is enough for each bet. and the dealer must qualify with a pair of 4 not only if he has it on his own hand but also incombination with the table. if dealer doesnt qualify, ante and bet are pushed, trips are payed out if hit.

Current request: repair playing-card colors and clipped suit symbols; add a pre-game saloon map with increasing buy-ins and quick-bet choices; make preflop 3x-only versus 3x-or-4x configurable; and make disqualification/tie settlement and messaging explicitly report pushes instead of wins.

Current request (2026-08-09): make the game genuinely usable on mobile and add an explicit dealer-disqualification Ante policy: either push the Ante or pay a winning Ante even when the dealer does not qualify. Preserve the current push behavior as the default.

## Root causes

- Shared dashboard tool CSS targets the generic `.card` class with `!important`, overriding the poker card face and suit colors after the game stylesheet loads.
- Main-bet settlement already returns Ante, Blind, and Play when qualification is enabled and the dealer fails; the misleading headline comes from outcome labeling that compares hands without considering dealer qualification.
- Preflop multiplier behavior was hard-coded to the 3x–4x range rather than modeled as a persisted table rule.

## Completed

- Protected poker-card faces from the dashboard's generic `.card` theme so red suits, black suits, white faces, and corner symbols render correctly without clipping.
- Added a five-stop saloon map from low to high bankroll requirements, with locked-state feedback and quick Ante buttons.
- Added a persisted preflop rule for 3x-only or 3x/4x play wagers; controls, typed amounts, repeat bets, and affordability limits honor it.
- Extracted main-hand outcome resolution so non-qualification reports `Dealer didn't qualify`, tied best-five-card hands report `Dealer has the same hand as you`, and Trips cannot rename the main result.
- Extended settlement checks to prove that Ante, Blind, and Play each render as `Push` when the dealer does not qualify, even if the dealer's evaluated hand beats the player.
- Added a Playwright UI check for the saloon menu, card theme isolation, dealt-card rendering, console errors, and the preflop setting.
- Repaired two latent static-runtime syntax defects in the unused bankroll/AI strategy modules so every distributed JavaScript module parses successfully.

- Converted the imported Vite/npm project into a dashboard-compatible static tool whose runtime is entirely under `dist/`.
- Corrected dealer qualification to use the best five-card pair rank from dealer plus community cards.
- Preserved default pair-of-fours qualification, its toggle, and configurable minimum hand.
- Dealer failure returns Ante, Blind, and Play; Trips settles independently.
- Unaffordable Play wagers are disabled and rejected atomically instead of becoming partial bets.
- Added deterministic text-state hooks for browser-game regression checks.
- Corrected the 1280×720 opening and dealt-hand layouts after screenshot review; wager controls, instructions, hole cards, and action buttons no longer overlap.

## Verification

- Run `node scripts/check-ultimate-texas-holdem-dealer-qualification.mjs`.
- Serve the repository root and run `node scripts/check-ultimate-texas-holdem-ui.mjs http://127.0.0.1:8765/tools/game/ultimate-texas-holdem/dist/`.
- Run `npm run check:tools`.
- Browser checks passed for the saloon map, quick Ante selection, opening wagers, short-stack Play rejection, a dealt preflop hand, card colors and bounds, and the preflop/dealer Settings UI with no console errors.

## 2026-08-09 mobile and Ante-policy pass

- Added a persisted `dealerDisqualifiedAnteMode` setting. The existing `PUSH` behavior remains the default; `PAY_ON_PLAYER_WIN` returns the Ante plus a 1:1 win when the player beats a non-qualifying dealer while Blind and Play still push.
- Added payout regression coverage for both winning and losing hands under the new mode and browser coverage for settings persistence.
- Rebuilt the phone layout around the active decision: compact HUD, two-column touch-sized wager controls, hidden irrelevant opening regions, smaller cards, horizontal dealer/player hands, reachable action controls, and full-height settings.
- Verified 390x844 opening and dealt states with Playwright screenshots under `tmp/poker-mobile-audit/`; no horizontal overflow or console errors were observed.
- Visually verified the full-height 390x844 Settings dialog, including the new Ante settlement selector and reachable sticky Save/Cancel footer.

## Remaining follow-up

- Exercise the Android server-tool WebView on a paired physical phone after enabling `tools.browse`; compile-time, catalog, authorization, and resource-path checks pass, but a physical LAN session was not available in this pass.

## Suggested follow-up

- Add scenario fixtures for every Trips and Blind pay-table row.
- Add an in-table, non-blocking bankroll warning instead of the current browser alert.
- Add saloon-specific opponents, table ambience, and persistent progression goals; the current saloons intentionally change access and quick-bet choices without secretly changing poker odds.
