# Migration Notes

## Recommendation

Prefer a rewrite to Node.js with TypeScript instead of a direct Java-to-JavaScript port.

Why:

- Discord bots are very well supported in the Node ecosystem
- The current Java code is centralized enough that feature-by-feature extraction is practical
- TypeScript adds type safety without changing the runtime platform
- A rewrite is a good chance to separate config, commands, services, and integrations

## Clarification

- Node.js is the runtime
- TypeScript is a language that compiles to JavaScript and usually runs on Node.js
- So "TypeScript Node" usually means "a Node.js app written in TypeScript"
- Alternatives include plain JavaScript on Node.js, Bun, Deno, Python, Go, Rust, or staying on Java

## Suggested Rollout

1. Create a new bot app beside the Java code
2. Move config to `.env`
3. Port simple commands first
4. Port AI and media workflows after the basic bot shell is stable
5. Keep Java bot as fallback until parity is good enough

## Current Progress

- `bots/discord-bot/` exists as the parallel migration target
- repo-local secret `.env` usage has been removed from the Node bot runtime model
- `npm run register` is available for guild slash command registration
- `/help`, `/ping`, `/ask`, `/say`, `/dm`, `/gift`, and `/humble` are implemented in the Node bot
- duplicate cross-channel text spam detection keeps the first message, removes later copies, and can timeout the user
- duplicate cross-channel image spam detection analyzes the first post with `llava:13b` and removes all copies when flagged
- a local dashboard can display runtime state, moderation events, and trigger bot actions over HTTP on `127.0.0.1`
- dashboard app source moved to top-level `dashboard/src/` (outside bot folders)
- root `package.json` now hosts the npm workspace, TypeScript/tsx tooling, and dashboard/worker launch commands; runtime processes use the repository root as their working directory instead of `bots/discord-bot`
- neutral server services resolve shared dependencies such as `dotenv` and `sharp` from the root workspace instead of reaching through the Discord package
- Humble bundle scraping works against the current page shape
- Unity gift scraping fails gracefully when the publisher sale page is unavailable
- Ollama requests work locally against `http://localhost:11434/api/generate`
- `scripts/bots/secure-run-as-admin.cmd` and `scripts/bots/secure-run-as-admin.ps1` support password-gated bot/worker launching with selectable `runas` user; dashboard launch is intentionally excluded so desktop profile resources remain tied to the signed-in user
- dashboard polling was tightened so the frequent refresh path uses local runtime state instead of repeatedly re-fetching Discord channel data
- dashboard Audio Studio STT microphone recordings are imported into generated audio storage before transcription so browser-side recordings are also saved on disk
- Image Studio regenerate now asks whether to add a new generated image or overwrite the selected image record, and Image/3D/Video Studio expose per-run generation count controls.
- future work should continue to prioritize anti-pwning and Discord rate-limit safety:
  - keep polling minimal
  - use cache-first reads where reasonable
  - debounce or queue repeated actions
  - handle Discord rate limits gracefully with backoff / retry instead of bursty retries

## First Port Candidates

- `/image`
- `/audio`
- `/music`
- `/model`

## Later Port Candidates

- richer moderation configuration
- dashboard auth or additional local hardening if needed
