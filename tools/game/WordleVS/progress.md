Original prompt: i get:
POST
http://localhost:11434/api/generate
[HTTP/1.1 403 Forbidden 1ms]

Quellübergreifende (Cross-Origin) Anfrage blockiert: Die Gleiche-Quelle-Regel verbietet das Lesen der externen Ressource auf http://localhost:11434/api/generate. (Grund: CORS-Kopfzeile 'Access-Control-Allow-Origin' fehlt). Statuscode: 403.
Ollama error, try again later TypeError: NetworkError when attempting to fetch resource.

Notes:
- Root cause is browser-side direct call to `http://localhost:11434/api/generate`, which Ollama rejects by CORS policy in this setup.
- Added a local same-origin proxy endpoint in `server.js` (`POST /api/generate`) that forwards to Ollama.
- Updated `game.js` to call `/api/generate` via `generateWithOllama(...)` helper and include JSON content-type.
- Unified model usage in `game.js` via `OLLAMA_MODEL = 'llama3.1:8b'` for both solution and AI guess calls.

TODO / Suggestions for next agent:
- Verify gameplay end-to-end with running Ollama instance (`ollama serve`) and the new local server (`node server.js`).
- Add a simple `README.md` run section if needed (`node server.js`, open `http://127.0.0.1:5173`).
- Consider adding local dictionary fallback for AI guesses (currently `this.getRandomWord(...)` is referenced but no method is defined).

Validation log:
- `node --check game.js` passed.
- `node --check server.js` passed.
- With `node server.js` running, `GET http://127.0.0.1:5173/` returned `200`.
- With `node server.js` running, `POST http://127.0.0.1:5173/api/generate` reached Ollama and returned `404 {"error":"model 'llama3' not found"}` before model unification (this confirmed proxying works and CORS is bypassed).
- After model unification, `POST http://127.0.0.1:5173/api/generate` with model `llama3.1:8b` returned `200` with a valid generated response body.
- Playwright skill client run failed because package `playwright` is not installed in this repo/environment (`ERR_MODULE_NOT_FOUND`).

Model selection update:
- Added model selection UI in setup (`#ollama-model`) plus `Custom...` text input (`#custom-ollama-model`).
- Added runtime model handling in `game.js`:
  - Selected model is captured at game start and used for round solution generation.
  - AI player receives the selected model and uses it for guesses.
  - Added auto-loading of installed models from `/api/tags` with fallback to defaults.
- Added `/api/tags` proxy route in `server.js`.

Additional validation:
- With updated `server.js` running, `GET http://127.0.0.1:5173/api/tags` returned `200` and a non-empty model list.
- With updated `server.js` running, `POST http://127.0.0.1:5173/api/generate` returned `200` and expected response text.
- Playwright verification still blocked by missing `playwright` package (`ERR_MODULE_NOT_FOUND`).

Prompt refinement update:
- Updated both Ollama prompts in `game.js` to instruct the model to internally validate a candidate word by forming a short sentence first.
- Validation criterion added: candidate should be usable as a noun (singular/plural), verb, or adjective.
- Output restriction preserved: model must output only the 5-letter word, not the sentence.
- `node --check game.js` passed after this change.

Flow + empty-response hardening update:
- Added top HUD fields for match flow visibility: round number and round status.
- Added round lifecycle flags in `game.js`: `roundNumber`, `gameEnded`, and `roundTransitioning`.
- Added mode flow helpers in `GameManager` for focus handling, active-player calculations, timed skips, and queued round transitions.
- Hardened Ollama handling for empty output:
  - Added `extractOllamaText(...)` and `normalizeToFiveLetterWord(...)`.
  - AI guess generation now uses strict output-contract prompt + retry prompt + local fallback word.
  - Round solution generation now uses bounded retries, strict output-contract prompt, retry prompt, and local fallback word.
  - Removed recursive retry loop in `nextRound()` to avoid unbounded retry chains.
- Timer flow now marks unfinished active players as `skipped` before ending timed mode.

Latest validation:
- `node --check game.js` passed.
- Direct Ollama check with hardened prompt returned non-empty response (`HOUSE`) using model `llama3.1:8b`.

Separate model roles update:
- Split model selection into two independent settings:
  - `Word Generator Model` for round-start solution generation.
  - `AI Player Model` for the Ollama-controlled player.
- Updated setup UI:
  - Added `#word-model` + `#custom-word-model`.
  - Added `#ai-model` + `#custom-ai-model` inside AI options.
- Updated runtime wiring in `game.js`:
  - `this.wordModel` is used in `nextRound()` generation calls.
  - `this.aiModel` is passed to `OllamaAI` and used for AI guesses.
  - Model auto-loading from `/api/tags` now populates both selectors.
- `node --check game.js` passed after this change.

Language verification + phrase-proof update:
- Round-start word generation now requests structured JSON evidence from the model:
  - `word`
  - `part_of_speech`
  - `example_sentence` (must contain the word)
- Added parser checks so a generated word is accepted only when:
  - word is exactly 5 letters after normalization,
  - part-of-speech is one of noun/verb/adjective (with localized variants),
  - sentence contains the chosen word.
- Added stronger language gating:
  - check target language => must be `YES`,
  - for non-English modes, check English => must be `NO`.
- Added language-specific local fallback words (`English`, `German`, `French`, `Spanish`) so fallback no longer defaults to English.
- `node --check game.js` passed after this change.

User-requested no-fallback update:
- Removed all local fallback-word usage from `game.js`.
- AI now retries when no valid guess is returned instead of injecting a local word.
- Round-start word generation now retries generation when no valid word is returned instead of using any local fallback list.
- `node --check game.js` passed after removing fallback behavior.

Word source options update:
- Added setup options to support three user-controlled behaviors:
  - Upload a `.json/.xml/.csv/.txt` word file and use it for the selected language.
  - Enable LLM memory so found words are stored per `model + language`.
  - Leave both options unchecked for pure fresh LLM generation.
- Added `Reset LLM Memory` button to clear stored memory for currently selected word/AI models.
- Implemented uploaded word parsing in `game.js`:
  - JSON: arrays, `words` arrays, and language-keyed objects.
  - XML: `<word>` tags (optional `lang`/`language` attribute) or fallback token parsing.
  - CSV/TXT: delimiter token parsing.
- Implemented persistent memory storage in `localStorage` with per-bucket cap.
- AI prompt and round-word prompt now optionally receive learned-word context when memory is enabled.
- `node --check game.js` passed after these changes.

Language validator adjustment:
- Relaxed `verifyWordLanguage(...)` to avoid false negatives like valid German words being rejected only because they can also appear in English contexts.
- New behavior:
  - Must pass target-language YES check.
  - For non-English languages, reject only when model answers YES to: "mainly English and NOT a common standalone <target language> word".
- `node --check game.js` passed after this adjustment.

Round rejection memory update:
- Added `rejectedWordsThisRound` in `nextRound()` generation loop.
- Any word rejected by language validation is now stored for the current round.
- Subsequent prompts now include an explicit exclusion list (`Do NOT return ...`) so the model proposes new words instead of repeating rejected ones.
- Added repeat-guard to reject immediately if the model returns a previously rejected word in the same round.
- `node --check game.js` passed after this update.

Same-model instant-solve fix:
- Root cause: LLM memory was keyed only by `model + language`, so when word-generator and AI used the same model, AI could see round-generator memory.
- Memory is now role-scoped:
  - `word::<model>` for round-word generation memory.
  - `ai::<model>` for AI-player memory.
- Updated all memory read/write/reset call sites to pass explicit role.
- Updated debug log to print actual AI response text (not the prompt).
- `node --check game.js` passed after this fix.

Validity double-check + AI re-think update:
- Added phrase-based second-pass validator (`phraseRecheckWordValidity`) for words that fail initial language checks.
  - It requests two fresh sentences in the selected language containing the candidate word.
  - If phrase evidence is valid, word is accepted instead of rejected.
- Updated `verifyWordLanguage(...)` to use second-pass phrase validation before final rejection.
- Added `player-submitted-guess` event emission for every guess.
- Added shared round revision tracking in `GameManager` (`roundSharedRevision`), incremented on each submitted guess.
- `OllamaAI` now receives shared-guess context + round revision providers.
- AI move generation now re-thinks up to `AI_RETHINK_MAX_PASSES` when new guesses arrive while it is thinking, so it can adapt to fresher green/yellow/gray clues from other players.
- `node --check game.js` passed after these changes.

Persistent rejection exclusions update:
- Added per-language persistent rejected-word cache for round generation retries (`rejectedGenerationWordsByLanguage`).
- Rejected words are now carried across `nextRound()` retry cycles, not only within a single attempt loop.
- Exclusion hints now include the persisted list, so repeated cycles avoid proposing the same invalid words again.
- Rejection cache is cleared once a valid word is accepted for that language.
- `node --check game.js` passed after this change.

Length handling update:
- `normalizeToFiveLetterWord(...)` no longer truncates longer words to 5 letters.
- New behavior: cleaned token must be exactly 5 letters, otherwise it is rejected (`''`) so retry logic asks for a new word.
- `node --check game.js` passed after this change.

Word length configurability update:
- Added setup control `#word-length` (min 3, max 12, default 5) so the user can choose the active letter count before starting.
- Refactored game logic to use runtime `wordLength` instead of hardcoded 5:
  - Board tile rendering, keyboard input cap, submit checks, and guess evaluation loops.
  - AI prompts and retry prompts now request exactly `<wordLength>` letters.
  - Round solution generation prompts/schema/retry now request exactly `<wordLength>` letters.
- Replaced fixed normalizer with dynamic `normalizeToWordLength(raw, wordLength)`; words longer/shorter than target are rejected (not truncated).
- Uploaded word parsing now filters by selected language + selected word length.
- Uploaded/rejected-word buckets are now keyed by language + word length to avoid cross-length contamination.
- LLM memory storage is now keyed by model-role + language + word length to avoid mixing words across lengths.
- Word-file status text now reports selected letter count.

Validation:
- `node --check game.js` passed.
- `node --check server.js` passed.
- Playwright runtime check failed in this environment because package `playwright` is not installed (`Cannot find package 'playwright'`).

Word generator candidate-pool update:
- Updated round-start word generation to require a large candidate pool from the word model before choosing the final word.
- New constants in `game.js`:
  - `WORD_GENERATION_POOL_TARGET = 50`
  - `WORD_GENERATION_POOL_MIN = 40` (acceptance threshold for "about 50")
- Prompt now asks the word model to think of around 50 candidates and return structured JSON with:
  - `candidates` array
  - final `word`
  - `part_of_speech`
  - `example_sentence`
- Parser now validates:
  - candidate array exists and has at least 40 normalized unique words,
  - chosen word length is correct,
  - chosen word is contained in `candidates`,
  - POS + sentence checks still pass.
- Retry path now re-runs the same structured candidate-pool task (no one-word shortcut).

Validation:
- `node --check game.js` passed after these changes.

Refresh + AI-start + logging update:
- Fixed stale asset behavior on normal refresh by adding strict no-cache headers for static files in `server.js`:
  - `Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate`
  - `Pragma: no-cache`
  - `Expires: 0`
  - `Surrogate-Control: no-store`
- Added explicit `HEAD` handling in static file responses with the same headers.
- Hardened guess submission flow so no board can submit when no valid solution is set (`solution.length !== wordLength`).
- Added AI readiness gate in `OllamaAI`:
  - new `canGuessProvider` hook from `GameManager` (`!gameEnded && !roundTransitioning`)
  - new `isReadyToGuess()` check requires active round + non-empty solution of correct length.
  - AI now aborts delayed thinking cycles when round state is not ready.
- Added console logs requested by user:
  - `[AI Guess Prompt] ...`
  - `[Word Generator Prompt] ...`
  - `[Word Generator Retry Prompt] ...`
  - round solution logs:
    - uploaded source: `[Round N] Uploaded solution picked ...`
    - final round solution: `[Round N] Final solution ...`

Validation:
- `node --check game.js` passed.
- `node --check server.js` passed.

Solution word style customization update:
- Added new setup controls under `Word Style (Solution Generator)`:
  - `Only singular words (noun singular)` checkbox (`#word-style-singular`)
  - `Allow language-specific letters (e.g. � � �)` checkbox (`#word-style-extended`)
  - `Custom style prompt (optional)` textarea (`#word-style-custom`)
- Added style-option model in `game.js` and wired it into:
  - word normalization/parsing (`normalizeToWordLength`) with optional extended-letter handling,
  - uploaded-word parsing/filtering,
  - rejected-word caches,
  - LLM memory bucket keys (now include alphabet mode ascii vs extended),
  - round word generation prompt + retry prompt,
  - structured response parsing (`number_form` field + singular enforcement),
  - language verification (`only singular` adds singular-noun confirmation check),
  - AI guess normalization/prompt wording when extended letters are enabled.
- Player input now accepts Unicode letters when extended-letter mode is active; on-screen keyboard also adds an extra row (`���?`).

Validation:
- `node --check game.js` passed.
- `node --check server.js` passed.

Modern UI + random-pool selection + LLM wordlist builder update:
- Reworked `index.html` and `style.css` into a more modern app shell:
  - gradient/glass header and status chips,
  - card-based setup layout,
  - refreshed responsive player boards and stats view.
- Added new setup controls:
  - `#word-pool-size` so the user chooses how many candidate words the model should return,
  - `#wordlist-target-size`,
  - `#generate-wordlist`,
  - `#download-wordlist`,
  - `#wordlist-status`,
  - `#wordlist-preview`.
- Updated round generation flow in `game.js`:
  - the word model now returns a candidate pool only,
  - WordleVS shuffles that pool and validates random candidates itself,
  - the model no longer chooses the final solution word.
- Added reusable LLM wordlist creation in `game.js`:
  - generates a list for the selected language/length/style,
  - stores it in the existing reusable word-source bucket,
  - auto-enables that source for rounds,
  - supports JSON download of the current reusable list.
- Added `window.render_game_to_text` for browser-state capture and fixed board reset rendering so old guesses/keyboard states no longer leak into later rounds.

Validation:
- `node --check game.js` passed.
- `node --check server.js` passed.
- Playwright skill client ran successfully after installing `playwright` in the local environment used by the skill script.
- Browser validation with local server + Playwright confirmed:
  - setup screen renders with the new modern layout,
  - LLM wordlist generation completed for `English`, target size `20`,
  - generated list preview rendered 20 chips,
  - generated list auto-enabled as reusable source,
  - starting a match with reusable source reached `Round 1: 0/2 finished`.
- Artifacts:
  - `output/manual-setup.png`
  - `output/manual-builder.png`
  - `output/manual-round.png`
  - `output/manual-validation.json`

Setup organization refinement update:
- Reorganized the setup screen into a clearer 4-step map:
  - Step 01 `Players and mode`
  - Step 02 `Word engine`
  - Step 03 `Word sources`
  - Step 04 `LLM wordlist builder`
- Moved the primary `Start Match` action into a persistent overview card on the right so the page no longer ends in a detached footer button.
- Moved `#word-file-status` next to upload/source controls so source state now appears where the source is configured instead of in a separate sidebar card.
- Added setup flow chips, subsection headings, option panels, and tighter two-column card layout so the screen reads as grouped steps instead of one long stacked form.
- Kept all runtime IDs and game logic intact; this was a layout/organization pass only.

Validation:
- `node --check game.js` passed.
- `node --check server.js` passed.
- Playwright skill client captured setup state successfully (`output/organized-setup/state-0.json`).
- Browser validation confirmed:
  - reorganized setup renders correctly,
  - LLM wordlist generation still works,
  - reusable source can still be enabled and used,
  - `Start Match` in the new sidebar location still starts the round.
- Artifacts:
  - `output/organized-manual-setup.png`
  - `output/organized-manual-builder.png`
  - `output/organized-manual-round.png`
  - `output/organized-validation.json`

AI clue-solving + output-contract hardening update:
- Reworked AI guess generation in `game.js` so the AI no longer relies on one free-form LLM answer.
- Added local shared-clue parsing helpers:
  - collect all guesses from the AI board plus other player boards,
  - derive fixed-position / misplaced-letter / absent-letter / letter-count constraints,
  - filter candidate words against those constraints.
- Added local AI candidate scoring so when a reusable/uploaded/generated word source exists, the AI can solve against that source directly without waiting for an unreliable prose response.
- Hardened LLM fallback path for AI guesses:
  - prompt now explains that all boards share the same solution,
  - prompt includes readable guess-history lines and derived constraints,
  - response is now requested as JSON candidate list instead of raw prose,
  - returned candidates are filtered locally against Wordle constraints before use.
- Added `dictionaryWordsProvider` wiring from `GameManager` to `OllamaAI` so AI can use the active reusable word bank as a real guess dictionary.

Validation:
- `node --check game.js` passed.
- Shared-clue behavior verified in browser:
  - generated reusable English source,
  - started match with AI enabled,
  - Player 1 submitted `DANCE`,
  - AI reacted with its own clue-consistent guess `FLUTE`.
- Artifacts:
  - `output/ai-clue-react.png`
  - `output/ai-clue-react.json`
- Console evidence from validation included:
  - `[AI Local Solver] 3 candidates; selected FLUTE`

Note:
- A separate pure fresh-LLM fallback run was started but not fully completed in headless validation because round-start generation took too long; the code path was still updated to structured JSON candidate output.

AI prompt clue-color + cross-player repeat fix update:
- Updated AI guess context handling so prompts now include an explicit per-player color summary on every LLM guess prompt:
  - green positions,
  - yellow misplaced letters,
  - gray letters,
  - labeled as `self` or `other` per board.
- Split guess tracking in derived constraints into:
  - `selfGuessedWords`
  - `otherPlayersGuessedWords`
  - `allGuessedWords`
- Fixed invalid-repeat behavior:
  - AI now avoids repeating only its own previous guesses,
  - it may reuse another player's guess when that guess still satisfies all clues,
  - this prevents the previous bug where the correct solution from another player was filtered out as invalid.
- Added direct solved-word detection from constraints:
  - if shared clues fully determine all positions, the AI now immediately returns that solved word instead of retrying the LLM.
- Expanded local candidate pool to include observed guesses from other players in addition to reusable dictionary + memory words.

Validation:
- `node --check game.js` passed.
- Prompt-content validation in browser confirmed the AI prompt now includes:
  - `Per-player color summary:`
  - self vs other guess separation,
  - `Your own previous guesses:`
  - `Other players' guesses:`
  - instruction allowing reuse of another player's fully-green guess.
- Exact solved-clue validation confirmed:
  - with the user's `BRAVE`-style scenario, `generateGuessFromContext(...)` now returned `BRAVE`.
- Artifacts:
  - `output/ai-prompt-fix.json`
  - `output/ai-prompt-client/shot-0.png`

Module split + round-start hardening update:
- Split the runtime into browser modules:
  - `game.js` is now only the entrypoint and `render_game_to_text` bridge.
  - `src/shared.js` contains Ollama API helpers, word normalization/parsing, constraint logic, and LLM memory storage helpers.
  - `src/players.js` contains `PlayerBoard` and `OllamaAI`.
  - `src/game-manager.js` contains setup flow, word sources, round generation, and match lifecycle.
- Updated `index.html` to load `game.js` as an ES module.
- Fixed the startup failure mode where fresh LLM generation could stall forever because the app rejected partial candidate pools:
  - `parseCandidatePoolResponse(...)` no longer turns a partial pool into an empty pool.
  - `nextRound()` now accepts partial pools and proceeds to validate them instead of treating them as total failure.
  - When `Store found words` is enabled, saved word-model memory is now merged into the round candidate pool as a real fallback source instead of being used only as prompt text.
  - Prompt memory hints are now sampled/limited (`24` words) to avoid bloating the generation prompt.

Validation:
- `node --experimental-default-type=module --check game.js` passed.
- `node --experimental-default-type=module --check src/game-manager.js` passed.
- `node --experimental-default-type=module --check src/players.js` passed.
- `node --experimental-default-type=module --check src/shared.js` passed.
- Playwright startup validation with local server reached an active round after generation:
  - state: `{"status":"Round 1: 0/2 finished", ...}`
  - screenshot: `output/long-start-check.png`
- Memory-enabled startup validation also reached an active round:
  - state: `{"status":"Round 1: 0/2 finished", ...}`
  - screenshot: `output/long-start-memory-check.png`

Remaining production risk:
- Fresh LLM-only generation can still validate obscure words because the app is relying on LLM yes/no checks instead of a real dictionary/frequency list. For true production readiness, the next agent should add a deterministic dictionary-backed validator and use that ahead of the model.

AI round-pool solver update:
- Improved Ollama player quality by exposing the live round candidate pool to the AI.
- Added `currentRoundCandidatePool` tracking in `src/game-manager.js` and populate it for:
  - uploaded/reusable-source rounds,
  - fresh LLM-generated rounds after candidate-pool assembly.
- Updated AI dictionary wiring so `OllamaAI` now solves against the union of:
  - current round candidate pool,
  - uploaded/reusable word source.
- Added `currentRoundCandidateCount` to `render_game_to_text` for easier browser-state inspection.

Validation:
- `node --experimental-default-type=module --check game.js` passed.
- `node --experimental-default-type=module --check src/game-manager.js` passed.
- Browser scenario based on the user's failing clue log now returns `QUICK` from `generateGuessFromContext(...)` when the round pool contains `QUICK`.
- Standard skill-client screenshot/state capture still loads the app after the change (`output/current-ai-after`).

Multi-AI setup update:
- Replaced the old `player-count` + `vs-ai` setup model with explicit `human-player-count` and `ai-player-count` controls in `index.html`.
- AI options are now shown whenever `ai-player-count > 0`.
- Updated setup copy so AI-only matches are explained directly in the UI.
- `GameManager` now supports:
  - `0 humans + N AIs` (AI vs AI),
  - `N humans + M AIs` (multiple AI boards),
  - validation that at least one total player exists.
- AI boards are named `Ollama AI 1`, `Ollama AI 2`, ... when more than one AI is present.
- Focus routing now prefers the first human board when humans exist; AI-only matches simply run automatically.
- Added `humanPlayerCount` and `aiPlayerCount` to `render_game_to_text` output for validation.

Validation:
- `node --experimental-default-type=module --check game.js` passed.
- `node --experimental-default-type=module --check src/game-manager.js` passed.
- AI-only validation (`0 humans, 2 AIs`) with a seeded reusable source reached a completed AI-vs-AI match:
  - status: `Draw: Ollama AI 1, Ollama AI 2 solved the word.`
  - screenshot: `output/ai-vs-ai.png`
- Mixed validation (`1 human, 2 AIs`) with a seeded reusable source reached an active mixed match:
  - status: `Round 1: 2/3 finished`
  - screenshot: `output/mixed-multi-ai.png`

Setup-screen simplification update:
- Reworked the first view in index.html/style.css around a single quick-start card plus disclosure panels for round engine, AI settings, and reusable sources/builder.
- Kept all existing setup IDs intact so GameManager wiring still works; updateAIOptionsVisibility() now opens the AI disclosure whenever AI boards are enabled.
- Validation: node --experimental-default-type=module --check game.js, src/game-manager.js, src/players.js all passed.
- Browser validation: skill client capture saved to output/setup-ui-pass/shot-0.png and output/setup-ui-pass/state-0.json.
- Additional Playwright checks: desktop AI-expanded capture at output/setup-ui-ai-open.png confirmed ai-options becomes visible and open when AI Players = 2; mobile capture at output/setup-ui-mobile.png confirmed the compact setup stacks cleanly on a narrow viewport.


Match-flow and scoring update:
- Reworked in-match flow by mode in src/game-manager.js: standard now ends on the first solve, timed now advances to the next round on the first solve, and elimination keeps survivor-based round resolution while awarding solve points as boards finish.
- Added step-based scoring with a first-solve bonus, plus per-board stats for score, solves, best solve, and average solve.
- Player boards in src/players.js now render a compact HUD with score metrics, round summary text, and clearer solved/lost/skipped/thinking states.
- Match styling in style.css now compacts the header in match view, improves board presentation, and upgrades the stats screen into a ranked scoreboard with highlights.
- Updated game.js text-state output to include scoring and round-summary fields for browser validation.
- Validation: node --experimental-default-type=module --check game.js, src/game-manager.js, src/players.js all passed.
- Browser validation artifacts:
  - output/match-live-polish.png shows the new live match layout with four AI boards.
  - output/mode-standard-end.png confirms standard mode ends immediately on first solve with score + skip handling.
  - output/mode-timed-end.png confirms timed mode rolls through rounds and ends when a player reaches the target.
  - output/mode-elimination-mid.png confirms elimination mode keeps the round alive after the first solve so other boards can finish or fail.
  - output/mode-elimination-end.png confirms elimination resolves once the remaining board fails.


Peek-mode + width pass update:
- Added a new setup selector #peek-mode with Open letters, Only green / yellow / grey, and No peek options.
- Wired peek mode into src/game-manager.js so the active match stores the selected visibility mode, updates body dataset flags, and only shares cross-board AI clue context in full-open mode.
- Updated src/players.js so only the focused human board shows its on-screen keyboard, side boards can be visually masked by peek mode, and board summaries explain restricted views.
- Updated style.css to stretch the app container and match header wider, widen the board grid, and hide on-screen keyboards on non-focused boards so multi-board matches read cleaner.
- No validation run in this pass.

AI word-knowledge option update:
- Added #ai-word-knowledge in the shared AI settings with Give all possible words and Let AI guess on its own modes.
- Wired src/game-manager.js so AI boards only receive dictionaryWordsProvider data when the selection is ull; in ree mode they must rely on clue reasoning, prompts, and optional AI memory instead of the app's candidate universe.
- No validation run in this pass.

Per-AI model selection update:
- Replaced the shared AI Player Model selector with a generated Per-AI Models list in index.html so each AI board can be assigned its own model.
- Added dynamic model-control rendering in src/game-manager.js; the number of rows follows AI Players, preserves prior selections where possible, supports Custom... per AI, and reuses the /api/tags model list for all selectors.
- Updated AI startup wiring so each OllamaAI instance receives its own selected model instead of one shared model.
- Updated LLM-memory reset to clear all selected AI-model buckets, not just one.
- Validation:
ode --experimental-default-type=module --check game.js, src/game-manager.js, and src/players.js passed. Browser capture at output/per-ai-models-expanded.png confirms the AI settings panel renders separate model selectors for AI 1, AI 2, and AI 3.

Peek-open auto-close update:
- Added `shouldAutoCloseRoundOnSolve()` in `src/game-manager.js` and keyed it strictly to `peekMode === "open"`.
- Updated solve handling so first-solve round closure now happens only when `Peek Mode` is `Open letters`.
- `Colors only` and `No peek` now keep the round running after a solve under the normal mode-specific flow.
- For elimination with `Open letters`, the first solver now closes the round, unfinished boards are skipped rather than eliminated, and the next round begins unless only one player remains.
- Validation: syntax checks passed for `game.js` and `src/game-manager.js`. Browser validation in `output/peek-open-stop-check.json` confirmed `openLetters.view = stats` while `colorsOnly.view = match`; screenshot saved at `output/peek-open-stop-check.png`.

Singular length-repair update:
- Updated `src/game-manager.js` so candidate-pool parsing now keeps the raw LLM tokens, and when `Only singular words` is enabled it batch-checks wrong-length tokens for a valid singular noun form of the target length before discarding them.
- Added `repairSingularLengthVariants(...)` and made `parseCandidatePoolResponse(...)` async so repaired singular forms are merged back into the round candidate pool before solution validation.
- This specifically targets cases where the model returns a plural or inflected form with too many/few letters but the singular noun form would satisfy the active letter count.
- Validation: `node --experimental-default-type=module --check src/game-manager.js` and `game.js` passed.

Stats recap UI update:
- Updated `src/game-manager.js` so the end screen now renders a `Round recap` section with the final solution and one compact card per player showing that player's actual guesses from the final round.
- Added HTML-safe rendering helpers for guess tiles and per-player recap cards.
- Updated `style.css` with recap-panel, status-pill, and Wordle-style result-tile styling so the match summary still shows the board history after the match ends.
- Validation: `node --experimental-default-type=module --check src/game-manager.js` passed. Browser capture `output/stats-recap-check.png` confirms the end screen now shows color-coded guess rows and the final solution.

AI no-repeat + broader fallback update:
- Updated `src/players.js` so AI now treats `allGuessedWords` as unavailable, not just its own previous guesses. This affects local candidate filtering, LLM choice validation, direct-guess validation, solved-word detection, and prompt instructions.
- Prompt context now includes `All previous guesses`, and AI prompts now explicitly say not to repeat any previous guess from any player.
- Changed LLM candidate-pool handling to keep both raw parsed candidates and exact regex-valid matches.
- Added a relaxed fallback scorer that ranks raw LLM candidates by constraint-violation penalty and information value, so when no exact app-valid match exists the AI can try a broader exploratory word instead of looping on the same tight regex space.
- Validation: `node --experimental-default-type=module --check src/players.js`, `game.js`, and `src/game-manager.js` passed.

AI board naming update:
- Updated `src/game-manager.js` so AI boards now use their selected model name as the player name instead of generic `Ollama AI N` labels.
- Added duplicate-model disambiguation, so repeated models render as `model`, `model 2`, `model 3`, etc.
- This affects the live board headers, round-status messages, stats leaderboard, and final recap cards because all of them use `player.name`.
- Validation: `node --experimental-default-type=module --check src/game-manager.js` and `game.js` passed.

AI tactic subtitle update:
- Updated `src/players.js` so AI boards now show a subtitle line under the model name with the selected tactic (`Balanced`, `Calm`, or `Impatient`).
- Added `setSubtitle(...)` on `PlayerBoard` and use it from `OllamaAI` after construction so the board header reads as model name first, tactic second.
- Added matching subtitle styling in `style.css`.
- Validation: `node --experimental-default-type=module --check src/players.js` and `game.js` passed.

Update: visible AI typing + strict reusable-wordlist guess validation
- Added per-board guess validation hooks in `src/players.js` and `src/game-manager.js`.
- When a reusable word source is enabled and populated, submitted guesses must exist in that active list; off-list guesses are rejected without consuming a row.
- Human boards now surface the rejection inline (`Guess rejected`) while keeping the typed word visible for correction.
- AI boards now animate guesses letter-by-letter before submit, expose the in-progress row even when not focused, and show `Typing` / `Committing guess to the board.` while filling the row.
- AI guess filtering now respects the active reusable list via `allowedWordsProvider`, so off-list LLM suggestions are filtered out before final selection.
- Added `is-typing` visual styling in `style.css` for a clearer in-progress AI state.

Validation log:
- `node --experimental-default-type=module --check src/players.js` passed.
- `node --experimental-default-type=module --check src/game-manager.js` passed.
- `node --experimental-default-type=module --check game.js` passed.
- Ran the required skill Playwright client against `http://127.0.0.1:5173` with `#start-game`; artifacts in `output/web-game/`.
- Ran targeted Playwright validation:
  - `output/ai-typing-visual-check.png` shows the AI visibly typing across the row.
  - `output/ai-typing-visual-check.json` confirms in-match state with non-empty `currentGuess` during typing.
  - `output/wordlist-reject-check.png` shows an off-list human guess rejected on-board.
  - `output/wordlist-reject-check.json` confirms `submitted=false`, `guessCount=0`, and validation message `Guess is not in the active reusable wordlist.`
- No console or page errors in the targeted runs.

TODO / Suggestions for next agent:
- If desired, add a tiny blinking caret or per-letter keyboard highlight while AI is typing.
- Consider a separate setup toggle for `strict guess list` vs `list only for round generation`, in case the user wants reusable sources without hard submit enforcement.
- The AI typing screenshot and state capture are timing-sensitive; if you need a perfectly synchronized artifact, capture both inside one page evaluation hook.

Memory-bank AI upgrade:
- Replaced the old flat per-model word memory in `src/shared.js` with backward-compatible buckets that now store both `words` and a `guessBank`.
- Added `getGuessMemoryEntriesForModel(...)` and `rememberGuessMemoryForModel(...)` so AI models can persist clue-state-aware guess records keyed by model/language/length/style.
- Each guess-bank entry stores a state signature (`fixedMask`, absent letters, min/max counts, excluded positions, regex source), the guess itself, solve flag, guess number, effectiveness score, usage count, and last-used time.
- Updated `src/game-manager.js` to expose guess-bank providers/hooks to each `OllamaAI` and to keep the existing reset button clearing the richer memory bucket as well.
- Updated `src/players.js` so AI now:
  - scores prior guess-bank entries against the current clue state,
  - tries exact/similar remembered guesses before falling back to local sources or LLM generation,
  - includes a compact `Relevant guess-bank memories` hint in prompts when it does need the LLM,
  - records the board state before a submitted guess and writes a scored memory entry after the result is known.
- Updated the setup copy in `index.html` so the memory option describes the new stateful memory bank rather than just stored words.

Validation log:
- `node --experimental-default-type=module --check src/shared.js` passed.
- `node --experimental-default-type=module --check src/players.js` passed.
- `node --experimental-default-type=module --check src/game-manager.js` passed.
- `node --experimental-default-type=module --check game.js` passed.
- Ran the required Playwright client again against `http://127.0.0.1:5173`; latest artifacts refreshed in `output/web-game/`.
- Ran a targeted memory-bank browser check:
  - `output/memory-bank-check.json` shows the first run persisted `ai::llama3.1:8b -> guessBank[0]` for the empty-board state with `guess=CRANE` and `solved=true`.
  - In the second run, after clearing only the flat `words` list and leaving `guessBank`, console logs included `[AI Regex Matcher] memory bank produced a single app-valid match ...: CRANE`.
  - `output/memory-bank-check.png` captures the successful second run.

TODO / Suggestions for next agent:
- Right now the guess-bank similarity is heuristic and local-storage-only. The next meaningful upgrade would be a stronger retrieval score and optional export/import of AI memory buckets.
- If the user wants models to learn from each other, add a separate shared-team memory bank instead of only per-model memory.

Solution-review vote bank + near-solved randomizer update:
- Added a persistent word-review store in `src/shared.js` under `WORD_REVIEW_STORAGE_KEY` so reviewed-invalid solution words can be excluded in future rounds by language/length/style.
- Added `getReviewedRejectedWords(...)` and `rememberReviewedRejectedWord(...)` for persistent reviewed rejections.
- Updated `src/game-manager.js` so round generation now merges persistent reviewed rejections into the per-round `rejectedWordsThisRound` set before prompting or validating solutions.
- Added multi-model reviewer voting in `src/game-manager.js`:
  - reviewer set comes from the active word model plus configured/active AI models,
  - persistent rejection only applies when at least 2 reviewer models are available,
  - majority `NO` votes reject the candidate and write it into the persistent review bank.
- Reusable/uploaded sources now go through the same `pickValidatedRandomSolution(...)` review/validation path instead of bypassing solution validation entirely.
- Updated `src/players.js` with a near-solved endgame heuristic:
  - if only 1-2 positions remain unresolved and the rest are fixed green, the AI now skips the normal long reasoning path,
  - it first tries a random exact candidate from any known valid pool,
  - otherwise it generates a random constraint-fitting probe by filling the open slots directly.
- Fixed a follow-up bug in the new endgame randomizer by importing `shuffleArray` into `src/players.js`.

Validation log:
- `node --experimental-default-type=module --check src/shared.js` passed.
- `node --experimental-default-type=module --check src/players.js` passed.
- `node --experimental-default-type=module --check src/game-manager.js` passed.
- `node --experimental-default-type=module --check game.js` passed.
- Ran the required Playwright client again against `http://127.0.0.1:5173`; latest baseline artifacts refreshed in `output/web-game/`.
- Targeted validation:
  - `output/review-vote-check.json` shows a real multi-model rejection vote for `ZZZZZ` with `qwen2.5-coder:7b` and `llama3.1:8b` both voting `NO`, and the word persisted into `wordlevs_word_review_v1`.
  - `output/review-vote-check.png` captures the reusable-source validation phase during that review pass.
  - `output/review-and-random-check.json` shows the near-solved heuristic returning `DREXS` and logging `[AI Endgame Randomizer] near-solved state; randomly probing open slots with DREXS`.
  - `output/near-solved-random-check.png` captures the corresponding near-solved board state.

TODO / Suggestions for next agent:
- The review-bank path is intentionally conservative now: it only persists a rejection when at least 2 reviewer models are available. If the user wants stricter behavior with one model selected, add a separate toggle for `single-model auto-ban`.
- The near-solved randomizer currently works from direct slot-filling when no known pool fits. If the user wants a more dictionary-like finish, add a small common-ending pattern bank (`-ER`, `-ED`, `-ES`, etc.) before the pure random-letter fallback.

Elimination checkpoints update:
- Added dedicated elimination setup controls in `index.html` for `Round Time (s)` and `Checkpoints`.
- Implemented timed checkpoint elimination flow in `src/game-manager.js` using green-letter survival thresholds per checkpoint.
- Fixed elimination solve handling so if every surviving board has already solved, the round advances immediately instead of waiting for the next checkpoint.
- Exposed elimination timer/checkpoint state in `game.js` via `render_game_to_text()` for browser validation.

Validation log:
- `node --experimental-default-type=module --check src/game-manager.js` passed.
- `node --experimental-default-type=module --check game.js` passed.
- Ran the required Playwright client again against `http://127.0.0.1:5173`; baseline artifacts refreshed in `output/web-game/`.
- Targeted validation:
  - `output/elimination-checkpoint-check.json` shows checkpoint 1 eliminating boards that missed the 3-green threshold.
  - `output/elimination-checkpoint-check.png` captures the resulting elimination summary with the final-round recap.
  - `output/elimination-rollover-check.json` shows elimination round rollover into round 2 after all surviving boards solved before the next checkpoint.
  - `output/elimination-rollover-check.png` captures the live round-2 state after rollover.

Peek unlock on first guess update:
- Updated board presentation so side-board peeking stays locked until the focused player has submitted their first guess that round.
- Updated AI shared-clue access so AI boards also get no cross-board context until they have made their own opener.
- Added debug state in `render_game_to_text()` for `focusedPlayerCanPeekOthers` and per-player `canPeekOthers`.

Validation log:
- `node --experimental-default-type=module --check src/players.js` passed.
- `node --experimental-default-type=module --check src/game-manager.js` passed.
- `node --experimental-default-type=module --check game.js` passed.
- Ran the required Playwright client again against `http://127.0.0.1:5173`; baseline artifacts refreshed in `output/web-game/`.
- Targeted validation:
  - `output/peek-first-guess-lock-check.json` shows side boards locked before guess 1 with `focusedPlayerCanPeekOthers=false` and the UI message `Submit your first guess to unlock other boards.`
  - `output/peek-first-guess-lock-check.png` captures the corresponding locked-peek board state.
  - `output/ai-peek-first-guess-lock-check.json` shows AI shared context staying empty before its own first guess and only filling after the AI submits one.

Setup presets + binding audit update:
- Added one-click setup presets for `You vs AI` and `AI vs AI` at the top of the setup card.
- Removed the stale shared `AI Player Model` selector from `index.html`; runtime already uses the per-AI model rows, so the old control was misleading and unbound.
- Added `AI Candidate Suggestions` as a real setup field and bound it into `src/players.js` so the AI prompt count is no longer a hidden constant.
- Added `clampAIGuessPoolTarget(...)` and wired the selected value through `src/game-manager.js` into each `OllamaAI` instance.
- Verified that the round generator prompt still respects `Candidate Pool Size`, and fixed a stale hardcoded `Suggest 12 candidate guesses` line that was still leaking into the AI prompt after the new binding landed.

Validation log:
- `node --experimental-default-type=module --check src/shared.js` passed.
- `node --experimental-default-type=module --check src/players.js` passed.
- `node --experimental-default-type=module --check src/game-manager.js` passed.
- `node --experimental-default-type=module --check game.js` passed.
- Ran the required Playwright client again against `http://127.0.0.1:5173`; baseline artifacts refreshed in `output/web-game/`.
- Targeted validation:
  - `output/setup-presets-check.json` confirms `You vs AI -> 1 human / 1 AI` and `AI vs AI -> 0 humans / 2 AIs` with AI options visible.
  - `output/setup-presets-check.png` captures the new preset-driven setup view.
  - `output/setup-binding-audit-check.json` confirms the word generator prompt used `Return exactly 37 unique uppercase candidate words.` and the AI prompt used `Suggest 9 candidate guesses that satisfy every clue.` with no leftover hardcoded `12` line.

AI abort + responsive match layout update:
- Updated `src/players.js` so AI rounds carry an action token; in-flight thinking/typing now aborts cleanly if the round closes, the board is skipped, or a new round starts.
- Fixed the late-submit case in `typeAndSubmitGuess(...)` by rechecking readiness/token after the final typing pause before calling `submitGuess()`.
- Improved AI reliability by resolving known exact candidates locally when the app already has a valid match set (`memory bank`, `local sources`, and small exact pools) instead of always asking the LLM to choose again.
- Tightened match-view board sizing in `style.css` with more compact board headers, one-row metrics, smaller grid spacing, and an extra low-height compaction pass for shorter viewports.

Validation log:
- `node --experimental-default-type=module --check src/players.js` passed.
- `node --experimental-default-type=module --check src/game-manager.js` passed.
- `node --experimental-default-type=module --check game.js` passed.
- Ran the required Playwright client again against `http://127.0.0.1:5173`; baseline artifacts refreshed in `output/web-game/`.
- Targeted validation:
  - `output/ai-abort-and-deterministic-check.json` shows `deterministicChoiceCalls = 0` for a local-source exact-candidate resolution and confirms the second AI stayed at `otherGuessCount = 0`, `otherCurrentGuess = ""`, `otherStatus = "skipped"` after the first AI closed the round.
  - `output/match-height-responsive-check.png` captures the compressed 1440x900 match layout with both boards fitting comfortably in height.

Shared AI memory + solved-word review update:
- Upgraded `src/game-manager.js` so AI word memory and AI guess memory now write into both model-specific buckets and a shared AI bank (`__shared__` / `ai-shared`) while filtering persistently rejected words back out on read.
- Added a third `AI Word Knowledge` mode, `sample`, and made it the default. This mode gives each AI one seeded candidate from the known pool and then lets it reason on its own instead of getting the full universe.
- Added post-solve review reuse: when a player finds the word, the app reruns the validity review for that solved word, stores the result in `latestSolvedWordReview`, persists valid solves into the word/AI memory banks, and persists rejected solves into the future rejection bank.
- Added the solved-word review note to the final stats recap so end-of-match results now explain whether the winning word was accepted or flagged after review.
- Continued the stylesheet refactor by introducing a new non-breaking SCSS source tree in `styles/` plus `scripts/build-styles.mjs`. `style.css` is still the served file for now; the new SCSS files are the source split for future migration once Sass is installed.

Validation log:
- `node --experimental-default-type=module --check src/game-manager.js` passed.
- `node --experimental-default-type=module --check game.js` passed.
- `node --check scripts/build-styles.mjs` passed.
- Ran the required Playwright client again against `http://127.0.0.1:5173`.
- Targeted validation:
  - `output/web-game/state-0.json` shows `aiWordKnowledge = "sample"` at runtime after entering a round.
  - `output/web-game-setup/state-0.json` shows `view = "setup"` and `aiWordKnowledge = "sample"` on initial load.
  - `output/web-game-setup/shot-0.png` captures the setup screen after the new default binding pass.
- `node scripts/build-styles.mjs` currently exits with the expected message `Sass is not installed...`; install `sass` locally before compiling `styles/main.scss` into `style.css`.

TODO / Suggestions for next agent:
- Finish migrating the remaining `style.css` selectors into the new `styles/*.scss` partials, then install `sass` and switch the served stylesheet to the generated output with a normal build step.
- Add a targeted browser test for the solved-word review note in the final recap (the runtime path is wired, but this pass only validated the binding/state side and setup defaults).

AI guess-quality + endgame resolver update:
- Added a history-aware candidate scorer in `src/players.js` that layers proper plus/minus signals on top of the old pool-frequency score.
- New scoring now rewards novelty on unresolved slots, punishes reusing the same failed slot letters, penalizes near-duplicate guesses, and adds a lightweight word-shape prior so fallback guesses prefer more plausible letter patterns.
- Wired that scorer into deterministic candidate ranking, relaxed-match fallback, and exploratory probe selection instead of using only generic pool frequency.
- Replaced the near-solved random-letter path with a compact endgame LLM prompt first. The new endgame prompt uses the visible pattern (for example `GL_PH`) plus compact constraints and previous-guess exclusions, without dumping full guess history.
- The synthetic slot-filler still exists only as the final fallback, and it now uses the history-aware scorer when choosing letters.

Validation log:
- `node --experimental-default-type=module --check src/players.js` passed.
- `node --experimental-default-type=module --check src/game-manager.js` passed.
- `node --experimental-default-type=module --check game.js` passed.
- Targeted logic check via inline Node import:
  - compact endgame prompt contains `Pattern: GL_PH`
  - compact endgame prompt does not contain `Guess history:`
  - `scoreCandidateWithHistory("GLYPH") > scoreCandidateWithHistory("GLZPH")` in the near-solved regression case.
- Ran the required Playwright client again against `http://127.0.0.1:5173`; baseline artifacts refreshed in `output/web-game/`.

Setup wizard update:
- Converted the setup flow into a stepper instead of a long stacked panel. The existing essentials card and advanced sections are now treated as wizard steps (`Match`, `Engine`, `AI`, `Sources`) with one active section at a time.
- Added bottom navigation (`Back`, `Next`, `Start Match`) that stays visible while working through the setup.
- Added source sub-tabs inside the reusable-source step so `Word source`, `Memory bank`, and `Builder` no longer stack into one long scroll-heavy page.
- Hid the old disclosure headers while they are used as wizard steps, so the setup reads more like a real flow and less like nested accordions.
- Added extra bottom padding for the setup panel so the sticky footer does not overlap later-step content.

Validation log:
- `node --experimental-default-type=module --check src/game-manager.js` passed.
- `node --experimental-default-type=module --check game.js` passed earlier in this turn and setup-only wiring changes did not touch it afterward.
- Ran the required Playwright client against `http://127.0.0.1:5173` for setup capture.
- `output/web-game-setup-wizard/shot-0.png` captures the new wizard-style first step with the pinned footer.

SCSS cleanup update:
- Promoted styles/main.scss + partials to the active source for style.css via scripts/build-styles.mjs.
- Moved wizard/layout drift into styles/_layout.scss, board reaction styles into styles/_boards.scss, and responsive wizard rules into styles/_responsive.scss.
- Regenerated style.css from SCSS and verified the setup wizard still fits on one screen via Playwright screenshot output/web-game-setup-wizard/shot-0.png.

Validation:
- node --check scripts/build-styles.mjs
- node --experimental-default-type=module --check src/players.js
- node --experimental-default-type=module --check src/game-manager.js
- node --experimental-default-type=module --check game.js
- node C:\Users\rainer\.codex\skills\develop-web-game\scripts\web_game_playwright_client.js --url http://127.0.0.1:5173 --actions-file C:\Users\rainer\.codex\skills\develop-web-game\references\action_payloads.json --click-selector body --iterations 1 --pause-ms 150 --screenshot-dir output\web-game-setup-wizard

Late-game AI update:
- Added a dedicated last-guess solver path in src/players.js. On the final allowed guess, the AI now prioritizes exact candidates from shared clues, memory, and known word sources before falling back to a ranked plausible word.
- Removed the synthetic near-solved letter filler fallback; compact endgame prompting now returns an exact word or nothing.
- Expanded board reactions with more emoji states (thinking, typing, one-away, excellent progress, hot trail, rejected, solved, failed) and added matching SCSS tone styles.

Validation:
- node --experimental-default-type=module --check src/players.js
- node --experimental-default-type=module --check src/game-manager.js
- node --experimental-default-type=module --check game.js
- node --check scripts/build-styles.mjs
- node scripts/build-styles.mjs
- inline check: lastGuessResult=ALIVE from final-guess path
- inline check: nearSolvedFallback='' confirms synthetic one-letter fallback removed
- inline checks: typingReaction=??, oneAwayReaction=??
- Playwright baseline rerun: output/web-game-setup-wizard/shot-0.png
Constraint-hardening update:
- Tightened late-game AI fallbacks in src/players.js so once clue density is high (or <=2 guesses remain), the AI skips loose relaxed/probe paths and only uses exact, direct, or low-penalty semi-constrained candidates.
- Added getConstraintSignal(), shouldAvoidLooseFallbacks(), and getSemiConstrainedCandidates() to rank and filter fallback options by actual contradiction penalty.
- Last-guess resolver now prefers low-penalty fallback words instead of broad relaxed guesses.

Validation:
- node --experimental-default-type=module --check src/players.js
- node --experimental-default-type=module --check src/game-manager.js
- node --experimental-default-type=module --check game.js
- inline screenshot-like check: regex=^[^ACDFHKNORS][^ACDFKLNORS]EE[^ACDEFHKNORS]$, semiConstrained=["WHEEL"], penaltyALLEE=16, penaltyWHEEL=0
- Playwright baseline rerun: output/web-game-setup-wizard/shot-0.png
Prompt inference update:
- Added fixed-position inference in src/shared.js so letters can be promoted from repeated yellow exclusions into inferred fixed slots.
- Prompt formatting now suppresses redundant misplaced-yellow lines once a letter's placement is fully resolved by elimination.
- Added an explicit AI prompt note in src/players.js: "Inference upgrades: Treat X=Y as green/fixed positions..." so the model uses the deduced slot like a green clue.

Validation:
- node --experimental-default-type=module --check src/shared.js
- node --experimental-default-type=module --check src/players.js
- node --experimental-default-type=module --check src/game-manager.js
- inline check: repeated C-not-1/2/3/4 now formats as "Fixed positions: 5=C inferred" and "Misplaced letters: none"
- inline prompt check confirms the extra note: "Inference upgrades: Treat 5=C as green/fixed positions..."
- Playwright baseline rerun: output/web-game-setup-wizard/shot-0.png
Inference + setup shell update:
- Added duplicate-count prompt upgrades in src/players.js so exact-count deductions (for example E exactly 2) are called out explicitly as count constraints.
- The AI prompt now includes both position inference upgrades and count upgrades, so exclusion-based green deductions and duplicate-letter count deductions are surfaced in plain language.
- Added a branded SVG mark, sticky setup sidebar summary, current-step guidance card, and app footer in index.html.
- Reworked the setup shell in styles/_layout.scss + styles/_responsive.scss to use a two-column desktop layout with a sticky sidebar, smaller setup header chrome, tighter wizard spacing, and a more compact setup-specific header.
- Wired live sidebar summary updates from src/game-manager.js so roster, mode, format, AI behavior, and source state update as the user changes settings.

Validation:
- node --experimental-default-type=module --check src/shared.js
- node --experimental-default-type=module --check src/players.js
- node --experimental-default-type=module --check src/game-manager.js
- node --check scripts/build-styles.mjs
- node scripts/build-styles.mjs
- inline prompt check confirms exact-count note: "Count upgrades: Treat these as exact count constraints: E is fully resolved and appears exactly 2 times."
- Playwright top-of-page capture: output/web-game-setup-top/shot-0.png
- Playwright baseline capture: output/web-game-setup-wizard/shot-0.png
Advanced-step compression update:
- Converted the setup shell into a fixed-height setup frame for desktop: body[data-view="setup"] now uses a grid shell, #setup-screen keeps a fixed row layout, and the active step content scrolls inside the panel instead of pushing the whole page downward.
- Tightened advanced-step density in styles/_layout.scss: smaller field spacing, smaller input padding, denser helper text, smaller source tabs, denser option panels and AI model rows, and a more compact setup footer.
- Kept the sidebar summary sticky on desktop while making setup-main/setup-sidebar internally scrollable, so Engine and Sources stay usable without page-length growth.
- Added duplicate-count prompt upgrades in src/players.js so exact-count deductions are explicitly surfaced to the AI alongside inferred fixed positions.

Validation:
- node --experimental-default-type=module --check src/shared.js
- node --experimental-default-type=module --check src/players.js
- node --experimental-default-type=module --check src/game-manager.js
- node --check scripts/build-styles.mjs
- node scripts/build-styles.mjs
- inline prompt check confirms exact-count note: "Count upgrades: Treat these as exact count constraints: E is fully resolved and appears exactly 2 times."
- Playwright captures inspected:
  - output/web-game-setup-top/shot-0.png
  - output/web-game-setup-engine/shot-0.png
  - output/web-game-setup-sources/shot-0.png

Used-solution filtering update:
- Added `usedRoundSolutionsByLanguage` tracking in `src/game-manager.js` so previously used round solutions are excluded in app logic before model review runs.
- `pickValidatedRandomSolution(...)` now filters out already-used words first, only sends unused candidates to `reviewCandidateWithModels(...)`, and only clears the used-solution set after the candidate pool is exhausted.
- Fresh matches/reset-to-setup now clear the used-solution tracker.
- Chosen round solutions are marked immediately after selection.

Validation log:
- `node --experimental-default-type=module --check src/game-manager.js` passed.
- Targeted runtime check passed: with `OCEAN` and `URBAN` pre-marked as used, `pickValidatedRandomSolution(['OCEAN','URBAN','FLAME'], ...)` returned `FLAME` and reviewed only `FLAME`.
- Playwright client rerun against `http://127.0.0.1:5173` succeeded; setup artifacts captured in `output/web-game-used-solution-filter/`.

Crash fix:
- Added shared `getGuessesRemaining()` to `PlayerBoard` in `src/players.js` so board-level reaction/UI logic can safely call it for both human and AI boards.

Validation log:
- `node --experimental-default-type=module --check src/players.js` passed.
- Playwright client rerun against `http://127.0.0.1:5173` succeeded; artifacts captured in `output/web-game-get-guesses-remaining-fix/`.

German/opening-guess update:
- Added app-owned AI opening guesses in `src/game-manager.js` via `currentRoundAIKnowledgeSamples` and `currentRoundAIOpeningGuesses`.
- `sample` knowledge is now a real random app-selected candidate stored per player/model/round instead of a deterministic hash selection.
- AI boards now get `openingGuessProvider(...)`, and `src/players.js` uses that app-selected word immediately on an empty board before any LLM candidate-generation prompt runs.
- Added a stricter non-English system hint in `src/players.js` so models are told not to drift back into English unless the word is also standard in the selected language.

Validation log:
- `node --experimental-default-type=module --check src/game-manager.js` passed.
- `node --experimental-default-type=module --check src/players.js` passed.
- Targeted runtime check passed: app-selected knowledge/opening guess stayed stable within the round and `generateGuessFromContext(...)` returned that app-selected opener directly.
- Playwright client rerun against `http://127.0.0.1:5173` succeeded; artifacts captured in `output/web-game-german-opening-fix/`.

Refactor update:
- Split the oversized `src/players.js` runtime into a real folder structure:
  - `src/players/player-board.js`
  - `src/players/ollama-ai.js`
  - `src/players/index.js`
- Replaced root `src/players.js` with a thin export shim so existing imports keep working during the broader refactor.
- Next refactor target should be `src/game-manager.js`, which is still the largest remaining runtime file.

Tracked feature idea / memory bank:
- Team mode: players can be assigned to teams, share a team chat/hint panel, and exchange lightweight clue hints during the round.
- Suggested implementation path: team roster setup -> per-team shared chat log -> hint permissions/rate limit -> scoring based on team solves and assist points.

Validation log:
- `node --experimental-default-type=module --check src/players/player-board.js` passed.
- `node --experimental-default-type=module --check src/players/ollama-ai.js` passed.
- `node --experimental-default-type=module --check src/players.js` passed.
- `node --experimental-default-type=module --check src/game-manager.js` passed.
- `node --experimental-default-type=module --check game.js` passed.
- Playwright client rerun against `http://127.0.0.1:5173` succeeded; artifacts captured in `output/web-game-player-folder-refactor/`.

GameManager refactor update:
- Split setup-wizard/sidebar methods into `src/game-manager/setup-ui.js` and install them onto `GameManager.prototype`.
- Split word-source, reusable-word, AI knowledge sampling, and memory-bank helper methods into `src/game-manager/word-sources.js` and install them onto `GameManager.prototype`.
- `src/game-manager.js` now keeps constructor, event wiring, round flow, scoring, and match control, while the setup/source logic lives in the new folder modules.
- `src/players.js` remains a thin shim, and the runtime now has both `src/players/` and `src/game-manager/` folders instead of only monolithic top-level files.
- Team mode idea remains tracked in this memory file as a next feature: teams, shared hint chat, and assist-based scoring.

Validation log:
- `node --experimental-default-type=module --check src/game-manager/setup-ui.js` passed.
- `node --experimental-default-type=module --check src/game-manager/word-sources.js` passed.
- `node --experimental-default-type=module --check src/game-manager.js` passed.
- `node --experimental-default-type=module --check src/players/player-board.js` passed.
- `node --experimental-default-type=module --check src/players/ollama-ai.js` passed.
- `node --experimental-default-type=module --check src/players.js` passed.
- `node --experimental-default-type=module --check game.js` passed.
- Playwright client rerun against `http://127.0.0.1:5173` succeeded; artifacts captured in `output/web-game-manager-folder-refactor/`.

Shared module refactor update:
- Split the oversized `src/shared.js` file into focused modules:
  - `src/shared/constants.js`
  - `src/shared/ollama.js`
  - `src/shared/word-utils.js`
  - `src/shared/wordle-logic.js`
  - `src/shared/memory-store.js`
- Replaced root `src/shared.js` with a thin re-export shim so the rest of the app keeps importing `./shared.js` or `../shared.js` unchanged.
- This separates constants, Ollama transport helpers, normalization utilities, Wordle constraint logic, and persistent memory/review storage into clearer boundaries for further refactors.
- Cleaned one leftover magic number in `src/game-manager/word-sources.js` so rejected-word limits now use `MAX_REJECTED_WORDS_PER_LANGUAGE` again.

Validation log:
- `node --experimental-default-type=module --check src/shared/constants.js` passed.
- `node --experimental-default-type=module --check src/shared/ollama.js` passed.
- `node --experimental-default-type=module --check src/shared/word-utils.js` passed.
- `node --experimental-default-type=module --check src/shared/wordle-logic.js` passed.
- `node --experimental-default-type=module --check src/shared/memory-store.js` passed.
- `node --experimental-default-type=module --check src/shared.js` passed.
- `node --experimental-default-type=module --check src/game-manager.js` passed.
- `node --experimental-default-type=module --check src/players/ollama-ai.js` passed.
- `node --experimental-default-type=module --check src/game-manager/word-sources.js` passed.
- Playwright client rerun against `http://127.0.0.1:5173` succeeded; artifacts captured in `output/web-game-shared-folder-refactor/`.

Next refactor suggestion:
- Split `src/game-manager.js` further into `round-flow`, `scoring`, and `review` modules. That is now the biggest remaining runtime file after `shared.js` moved behind a stable module boundary.

GameManager round-flow/scoring/review refactor update:
- Added focused GameManager modules:
  - `src/game-manager/review.js`
  - `src/game-manager/scoring.js`
  - `src/game-manager/round-flow.js`
- Wired them into `src/game-manager.js` with:
  - `installGameManagerReviewMethods(GameManager)`
  - `installGameManagerScoringMethods(GameManager, { FIRST_SOLVE_BONUS })`
  - `installGameManagerRoundFlowMethods(GameManager)`
- Moved the review flow, scoreboard rendering/end-game flow, and round/match lifecycle methods behind those installers.
- `src/game-manager.js` now acts much more like the orchestration shell instead of holding every match/runtime method directly.
- After removing the duplicated in-class copies, `src/game-manager.js` dropped to 680 lines from 1284 lines in this pass.

Validation log:
- `node --experimental-default-type=module --check src/game-manager/review.js` passed.
- `node --experimental-default-type=module --check src/game-manager/scoring.js` passed.
- `node --experimental-default-type=module --check src/game-manager/round-flow.js` passed.
- `node --experimental-default-type=module --check src/game-manager.js` passed.
- `node --experimental-default-type=module --check game.js` passed.
- Playwright client rerun against `http://127.0.0.1:5173` succeeded; artifacts captured in `output/web-game-roundflow-scoring-review-refactor/`.

Next refactor suggestion:
- Clean the now-slimmed `src/game-manager.js` import list and consider splitting the remaining setup/model-selection helpers into a smaller `models-ui` or `match-setup` helper module if the file keeps growing again.

GameManager shell cleanup update:
- Added `src/game-manager/model-ui.js` for per-AI model selectors, custom model inputs, model loading from `/api/tags`, and AI model row rendering.
- Moved these methods out of `src/game-manager.js`:
  - `getFallbackModelNames`
  - `getAvailableModelNames`
  - `getSelectedWordlistTargetSize`
  - `pickValidatedRandomSolution`
  - `getWordPromptRuleLines`
  - `generateWordListWithLLM`
  - `downloadCurrentWordList`
  - `toggleCustomModelInput`
  - `toggleCustomModelElements`
  - `getSelectedModel`
  - `getSelectedModelFromElements`
  - `configureModelSelect`
  - `getSelectedAIModels`
  - `buildAIPlayerNames`
  - `renderAIModelControls`
  - `loadAvailableModels`
- `pickValidatedRandomSolution`, word prompt rules, and wordlist generation/download now live in `src/game-manager/word-sources.js`.
- `src/game-manager.js` now mostly holds the constructor, event wiring, basic selection helpers, and module installers.
- File size reduced again: `src/game-manager.js` is now 290 lines.

Validation log:
- `node --experimental-default-type=module --check src/game-manager/model-ui.js` passed.
- `node --experimental-default-type=module --check src/game-manager/word-sources.js` passed.
- `node --experimental-default-type=module --check src/game-manager.js` passed.
- `node --experimental-default-type=module --check game.js` passed.
- Playwright client rerun against `http://127.0.0.1:5173` succeeded; artifacts captured in `output/web-game-model-ui-word-source-refactor/`.

Regression note:
- Browser validation initially failed with `TypeError: game.getWordStyleOptions is not a function` after trimming `src/game-manager.js` too aggressively.
- Restored `getWordStyleOptions()` and reran validation successfully.

Next refactor suggestion:
- Split `setupEventListeners()` into a smaller event-wiring helper or bind groups by area (`setup`, `match`, `global`) so the constructor shell stays easy to scan.

Prompt semantics hardening update:
- Strengthened AI prompt wording in `src/players/ollama-ai.js` for weaker models that misunderstand Wordle colors.
- Added an explicit `Wordle clue legend` block to the shared prompt context:
  - green/correct = exact letter in exact position
  - yellow/present = letter exists but not in this position
  - gray/grey/absent = letter absent unless duplicate-count rules explicitly preserve copies
  - trust derived constraints, fixed positions, count rules, and regex gate over intuition
- Added a short example line so inferred fixed slots are treated like real green clues.
- Also hardened the top-level system prompt with the same color semantics so every AI request repeats the rule set.

Validation:
- `node --experimental-default-type=module --check src/players/ollama-ai.js`
- `node --experimental-default-type=module --check src/game-manager.js`
- `node --experimental-default-type=module --check game.js`
- Targeted prompt assertion confirmed the emitted AI prompt now contains the legend and anti-confusion instructions.
- Playwright boot pass succeeded with artifacts in `output/web-game-prompt-semantics/`.

Emoji + AI queue fix update:
- Fixed board reaction emoji rendering in `src/players/player-board.js`.
- Removed a stale duplicate `getLatestGuessReaction()` implementation.
- Replaced mojibake emoji literals with Unicode escape sequences so reactions render reliably regardless of file encoding.
- Added `clearPendingMoveTimer()` and call sites on reset / round completion so stale scheduled AI moves are canceled cleanly.
- Hardened `src/players/ollama-ai.js` against stacked retries:
  - added `pendingMoveTimer` guard usage
  - added `moveRequestInFlight` guard
  - retries now go through `scheduleMoveRetry()` instead of loose repeated `setTimeout(...makeMove...)`
- Added a game-level serialized AI task queue in `src/game-manager.js` (`runQueuedAITask`) and wired it into AI creation from `src/game-manager/round-flow.js`.
- Result: AI boards no longer burst multiple Ollama prompt chains in parallel from the same game manager, and per-board retries no longer pile up while a move is already scheduled or in flight.

Validation:
- `node --experimental-default-type=module --check src/players/player-board.js`
- `node --experimental-default-type=module --check src/players/ollama-ai.js`
- `node --experimental-default-type=module --check src/game-manager.js`
- `node --experimental-default-type=module --check src/game-manager/round-flow.js`
- Targeted reaction check passed for solved / typing / one-away emoji outputs.
- Targeted queue ordering check passed for serialized AI task execution.
- Playwright smoke run passed with artifacts in `output/web-game-emoji-queue-fix/`.

Team mode MVP + sad reaction update:
- Reintroduced clearly sad bad-state reactions in `src/players/player-board.js`:
  - lost => crying face
  - no useful clues => sad face
  - weak guess => concerned face
- Added a dedicated team label element on each board so players can show both team and AI tactic/model metadata.
- Added `Enable team mode` in `index.html` setup.
- Added runtime team state in `src/game-manager.js`:
  - `teamModeEnabled`
  - `teamAssignments`
  - `teamChatByTeam`
  - team assignment helpers, team chat rendering, focused-team hint sending, and auto-posted clue summaries after submitted guesses.
- Added match-time team chat panel in `index.html` with per-team logs plus a focused-human hint composer.
- Wired team start/reset flow in `src/game-manager/round-flow.js` so matches assign players to Team A / Team B and create initial system chat lines.
- Added lightweight team summary rendering to the final stats screen in `src/game-manager/scoring.js`.
- Exposed `teamModeEnabled`, player team fields, and team chat counts in `game.js` `render_game_to_text()`.
- Added SCSS for team labels and team chat panel in `styles/_boards.scss` plus responsive handling in `styles/_responsive.scss`, then rebuilt `style.css`.

Validation:
- `node scripts/build-styles.mjs`
- `node --experimental-default-type=module --check src/players/player-board.js`
- `node --experimental-default-type=module --check src/game-manager.js`
- `node --experimental-default-type=module --check src/game-manager/round-flow.js`
- `node --experimental-default-type=module --check src/game-manager/scoring.js`
- `node --experimental-default-type=module --check src/game-manager/setup-ui.js`
- `node --experimental-default-type=module --check game.js`
- Browser run confirmed team mode works in match view with artifacts in `output/web-game-team-mode/`.

Current MVP limits:
- Team mode currently layers on top of the existing individual scoring/rules instead of redefining winners by team.
- Team chat is visible to the local user and supports focused human hint sending plus automatic clue posts; it does not yet feed a dedicated same-team hint context back into AI prompts.

Timed unlimited + app-picked round solution update:
- `index.html` now allows `Target Games = 0` in timed mode, with helper text that `0` means unlimited rounds until the timer expires.
- Added `timedRoundActive` runtime state in `src/game-manager.js`.
- Updated `src/game-manager/round-flow.js` so:
  - timed matches with `gamesToWin = 0` no longer auto-end on solve count
  - the timed mode label shows `Timed � unlimited rounds`
  - the countdown only ticks while `timedRoundActive` is true
  - `timedRoundActive` stays false during round generation / transitions and becomes true only after a round word has been selected and assigned
- Replaced the old post-pool reviewed selection path in `src/game-manager/word-sources.js` with direct app-owned random selection from the candidate pool (`pickRandomRoundSolution`).
- Result: once the app has a candidate pool, it picks one random unused candidate directly instead of sending those candidates back through model review before using one.

Validation:
- `node --experimental-default-type=module --check src/game-manager/word-sources.js`
- `node --experimental-default-type=module --check src/game-manager/round-flow.js`
- `node --experimental-default-type=module --check src/game-manager.js`
- `node --experimental-default-type=module --check game.js`
- Targeted browser run with delayed `/api/generate` confirmed timed mode stayed at `20s` while status remained `Generating 5-letter word for round 1...`.
- Standard Playwright client rerun passed with artifacts in `output/web-game-timed-unlimited-client/`.
- Targeted artifacts captured in `output/web-game-timed-unlimited-fix/`.

Single-board layout + multi-round pool reuse + richer AI match context:
- Added `currentMatchCandidatePool` in `src/game-manager.js` and exposed normalized access in `src/game-manager/word-sources.js`.
- `getAIWordUniverse(...)` now includes both the current round pool and the persisted match pool, so AI knowledge can stay grounded across multi-round matches.
- Updated `src/game-manager/round-flow.js` so timed/elimination modes reuse the existing match candidate pool on later rounds before asking the LLM for a fresh pool. The app now picks a fresh random unused solution from that stored pool first.
- Round generation still creates a new pool when needed, but multi-round modes no longer throw away a good pool after one round.
- Added `matchStateProvider` to `src/players/ollama-ai.js` and included a `Match state:` block in AI prompts with:
  - mode
  - round number
  - current guess number / guesses remaining
  - time left for timed/elimination modes
  - target solves (including unlimited)
  - solved rounds so far
  - current elimination checkpoint requirement when relevant
- Updated AI construction in `src/game-manager/round-flow.js` to pass that live match state into each AI.
- Added a dedicated 1-player match layout pass in SCSS:
  - compacted match header for `data-player-count="1"`
  - reduced brand/header/footer footprint
  - centered a single wider board
  - tightened grid/spacing so keyboard + board fit more cleanly without extra scroll
- Rebuilt `style.css` from SCSS after the layout pass.

Validation:
- `node scripts/build-styles.mjs`
- `node --experimental-default-type=module --check src/players/ollama-ai.js`
- `node --experimental-default-type=module --check src/game-manager/word-sources.js`
- `node --experimental-default-type=module --check src/game-manager/round-flow.js`
- `node --experimental-default-type=module --check src/game-manager.js`
- `node --experimental-default-type=module --check game.js`
- Targeted prompt assertion confirmed the AI prompt now includes `Match state`, timed mode, round number, time left, and unlimited target wording.
- Browser check for a 1-player match captured artifacts in `output/web-game-single-layout-pass/`.

Full knowledge AI choice update:
- Adjusted `src/players/ollama-ai.js` so `AI Word Knowledge = full` no longer uses the app-selected opening guess path.
- Added `knowledgeModeProvider` to `OllamaAI` and wired it from `src/game-manager/round-flow.js`.
- In `full` mode:
  - opening guess is no longer app-picked from the universe
  - when local app-valid matches come from the full provided word list, the AI no longer short-circuits to deterministic local ranking
  - instead it uses the LLM choice prompt over that full valid match set
- `sample` mode still keeps the app-selected opener behavior.

Validation:
- `node --experimental-default-type=module --check src/players/ollama-ai.js`
- `node --experimental-default-type=module --check src/game-manager/round-flow.js`
- Targeted assertions confirmed:
  - full mode returns no app opener
  - full mode disables deterministic choice for `local sources`
  - sample mode still returns the app opener
- Playwright smoke run passed with artifacts in `output/web-game-full-knowledge-choice/`.

Memory-bank LLM-driven choice update:
- Removed the old `memory bank` short-circuit from `src/players/ollama-ai.js` so the app no longer resolves guess-bank memories into a direct guess before the model acts.
- Guess-bank memory now stays prompt-facing:
  - `buildChoicePrompt(...)` adds memory-backed candidate hints when valid matches overlap known guess-bank entries
  - `buildLastGuessPrompt(...)` explicitly tells the model that memory is advisory and it must choose the final word itself
  - `buildEndgameGuessPrompt(...)` now includes similar guess-bank memory hints too
- `local sources` choice is now forced through the LLM when relevant guess-bank memory exists, instead of using deterministic in-app ranking.
- Removed remaining heuristic paths that injected guess-bank candidates directly into app-owned exact/endgame candidate pools.

Validation:
- `node --experimental-default-type=module --check src/players/ollama-ai.js`
- `node --experimental-default-type=module --check src/game-manager/round-flow.js`
- `node --experimental-default-type=module --check src/game-manager.js`
- `node --experimental-default-type=module --check game.js`
- Targeted runtime assertion confirmed:
  - with guess-bank memory present, `shouldUseDeterministicChoice('local sources', ...)` returns `false`
  - without guess-bank memory, the same path still returns `true`
  - prompt hints now include both the general guess-bank memory summary and the overlap hint for app-valid matches
- Playwright smoke run passed with artifacts in `output/web-game-memory-bank-llm/`.

Dual-reaction + AI decision-style update:
- Added a second board reaction slot in `src/players/player-board.js`.
- Reactions are now split into:
  - primary/activity state: ready, thinking, typing, rejected, solved, lost, skipped
  - secondary/progress mood: one-away, excellent progress, hot trail, strong progress, weak guess, no useful clues
- Updated SCSS in `styles/_boards.scss` and rebuilt `style.css` so both reaction chips render side-by-side in the board header.
- Added `AI Decision Style` to `index.html` with three modes:
  - `llm`: memory is advisory prompt context; the LLM chooses
  - `hybrid`: app can still rank obvious local-source shortlist picks
  - `assisted`: restores the older app-assisted memory-first behavior
- Added `aiDecisionMode` runtime state in `src/game-manager.js`, setup summary label in `src/game-manager/setup-ui.js`, and wired the selected mode into AI creation in `src/game-manager/round-flow.js`.
- Updated `src/players/ollama-ai.js` so the decision style actually changes behavior:
  - `llm` disables deterministic local-source resolution when relevant memory-bank context exists
  - `assisted` restores direct memory-bank candidate use before local-source resolution
  - `hybrid` keeps the prompt hints but allows app ranking for local sources
- Exposed `aiDecisionMode` in `game.js` `render_game_to_text()` for browser validation.

Validation:
- `node --experimental-default-type=module --check src/players/player-board.js`
- `node --experimental-default-type=module --check src/players/ollama-ai.js`
- `node --experimental-default-type=module --check src/game-manager.js`
- `node --experimental-default-type=module --check src/game-manager/round-flow.js`
- `node --experimental-default-type=module --check src/game-manager/setup-ui.js`
- `node --experimental-default-type=module --check game.js`
- `node scripts/build-styles.mjs`
- Targeted runtime assertion confirmed:
  - exact-state memory makes `llm` mode return `false` for deterministic local-source choice
  - exact-state memory makes `assisted` mode return `true`
  - assisted mode exposes memory-bank candidates again
- Playwright smoke run passed with artifacts in `output/web-game-ai-decision-emojis/`.

Computer AI + timed-unlimited fix:
- Added a non-LLM `ComputerAI` in `src/players/computer-ai.js`.
- The computer AI uses only local heuristic logic over the known/app-provided word universe; it makes no Ollama calls.
- Exported the new class through `src/players/index.js` and `src/players.js`.
- Added `AI Backend` to `index.html` with:
  - `LLM (Ollama)`
  - `Computer (local heuristic)`
- Added `aiBackend` runtime state in `src/game-manager.js` and exposed it in `game.js` `render_game_to_text()`.
- Updated `src/game-manager/setup-ui.js` so setup summary includes the backend and hides LLM-only controls (`AI Decision Style`, per-AI model rows) when backend is `Computer`.
- Updated `src/game-manager/round-flow.js` to instantiate `ComputerAI` when the shared backend is `computer`, with names like `Computer AI 1`.
- Updated `src/game-manager/review.js` so local computer players are not treated like reviewer LLM models.
- Fixed timed unlimited rounds in `src/game-manager/round-flow.js`: the first-solver timed path now only ends the match when `gamesToWin > 0`. With `Target Games = 0`, a solve now queues the next round instead of ending after round 1.

Validation:
- `node --experimental-default-type=module --check src/players/computer-ai.js`
- `node --experimental-default-type=module --check src/players/index.js`
- `node --experimental-default-type=module --check src/players.js`
- `node --experimental-default-type=module --check src/game-manager.js`
- `node --experimental-default-type=module --check src/game-manager/round-flow.js`
- `node --experimental-default-type=module --check src/game-manager/setup-ui.js`
- `node --experimental-default-type=module --check src/game-manager/review.js`
- `node --experimental-default-type=module --check game.js`
- Targeted runtime assertion confirmed `ComputerAI` produced a local guess (`TRACE`) with subtitle `Local heuristic`.
- Targeted timed assertion confirmed `gamesToWin = 0` leaves `ended = null` and queues the next round instead.
- Playwright smoke run passed with artifacts in `output/web-game-computer-ai-unlimited/`.

Failed-word retry prompt fix:
- Updated `src/players/ollama-ai.js` so prompt-facing memory words are now filtered by the current constraints before being shown to the LLM.
- That means impossible memory words like `ALONE` no longer appear in `Known valid words from your memory` when the current board already rules them out.
- Added explicit retry blacklists for failed words in prompt context: `Do NOT guess these failed words again in this turn: ...`.
- `requestLLMDirectGuess(...)` and `requestLLMEndgameGuess(...)` now remember the model's rejected proposal so the retry prompt can forbid it by name.
- Candidate-pool retry prompts now also receive the previous invalid raw candidates as forbidden retry words.

Validation:
- `node --experimental-default-type=module --check src/players/ollama-ai.js`
- `node --experimental-default-type=module --check src/game-manager.js`
- Targeted runtime assertion confirmed:
  - filtered prompt memory words for the `A_I_S` constraint case became `[]`
  - retry prompt contained `Do NOT guess these failed words again in this turn: ALONE`
  - prompt no longer leaked `ALONE` through the memory hint
- Playwright smoke run passed with artifacts in `output/web-game-failed-word-prompt-fix/`.

Stuck-AI reveal + validity-penalty update:
- Added repeated-failure tracking in `src/players/ollama-ai.js`.
- After consecutive failed turns (threshold: 3), the AI now asks the LLM (JSON decision) whether to reveal the hidden solution.
- If reveal is chosen, `OllamaAI` calls a new manager hook instead of retry-looping forever.
- Added `handleAIRevealSolution(...)` in `src/game-manager/round-flow.js`:
  - validates the revealed solution using reviewer vote + language verification,
  - applies a score penalty only when the revealed solution is confirmed valid,
  - marks the revealing AI board as skipped to stop endless retries,
  - updates round status with reveal/validation outcome.
- Added scoring support in `src/game-manager/scoring.js`:
  - `getAIRevealPenaltyPoints()`
  - `applyPenaltyPoints(...)`
- Added generic point-delta support in `src/players/player-board.js`:
  - new `applyPointDelta(...)` supports both positive and negative deltas,
  - `awardSolvePoints(...)` now delegates to it.
- Wired new hooks in `src/game-manager/round-flow.js` AI options:
  - `revealFailureThresholdProvider`
  - `handleRevealSolutionHook`
- Added configurable constant in `src/game-manager.js`:
  - `AI_REVEAL_VALID_WORD_PENALTY = 3`

Validation:
- `node --experimental-default-type=module --check src/players/ollama-ai.js`
- `node --experimental-default-type=module --check src/game-manager/round-flow.js`
- `node --experimental-default-type=module --check src/game-manager/scoring.js`
- `node --experimental-default-type=module --check src/players/player-board.js`
- `node --experimental-default-type=module --check src/game-manager.js`
- `node --experimental-default-type=module --check game.js`
Blank-fill fallback update:
- In `src/players/ollama-ai.js`, LLM retry prompts now filter memory-bank words against live constraints before showing them to the model, so impossible words like `ALONE` no longer leak into tight endgame prompts.
- Added explicit retry blacklists (`Do NOT guess these failed words again in this turn: ...`) for candidate, direct-guess, and endgame retry paths.
- Added a new blank-fill endgame fallback prompt: when the AI keeps failing on a near-solved board, it is told to fill the `_` slots with remaining usable letters, mentally enumerate pattern variants, and then decide which variants are real common words.

Validation:
- `node --experimental-default-type=module --check src/players/ollama-ai.js` passed.
- Targeted prompt assertion confirmed filtered memory words were empty for the `^A[^CDEGLNV]I[^CDEGLNV]S$` case and the retry prompt explicitly blacklisted `ALONE`.
- Playwright smoke run passed against `http://127.0.0.1:5173` with artifacts in `output/web-game-blank-fill-fallback/`.
Prompt token trim update:
- Removed uppercase/casing instructions from AI guess prompts in `src/players/ollama-ai.js`; prompts now only require exact letter count and JSON shape.
- Removed uppercase wording from round word generation and wordlist/singular-repair prompts in `src/game-manager/round-flow.js` and `src/game-manager/word-sources.js`.
- Case normalization and character validation remain app-side.

Validation:
- `node --experimental-default-type=module --check src/players/ollama-ai.js` passed.
- `node --experimental-default-type=module --check src/game-manager/round-flow.js` passed.
- `node --experimental-default-type=module --check src/game-manager/word-sources.js` passed.
- `rg -n "uppercase|UPPERCASE" ...` returned no remaining matches in the touched prompt files.
- Playwright smoke run passed against `http://127.0.0.1:5173` with artifacts in `output/web-game-prompt-token-trim/`.
