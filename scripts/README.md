# Runtime Scripts

Runtime launchers live here now. `bots/discord-bot` no longer contains `.cmd/.ps1` launchers.

Install Node dependencies once from the repository root with `npm install`. The root package is the npm workspace host and owns `tsx`, TypeScript, dashboard builds, and process launch working directories. Messenger-specific source remains under each `bots/` package.

## Main Discord runtime

- `.\scripts\bots\discord\store-discord-token.cmd`
- `.\scripts\bots\discord\run-main.cmd register`
- `.\scripts\bots\discord\run-main.cmd start`
- `.\scripts\bots\discord\run-main.cmd dev`

Optional headless Discord-only mode:
- `.\scripts\bots\discord\run-main.cmd start-headless`
- `.\scripts\bots\discord\run-main.cmd dev-headless`

The shorter independent runtime-server commands are:

- `npm run start:server`
- `npm run dev:server`

They use `scripts\run-server.cmd`, force the headless role, never bind the dashboard port, and explicitly suppress messenger autostart. This prevents a headless Discord client from disagreeing with the dashboard-owned Runtime Control state. Run `npm run start:dashboard` or `npm run dev:dashboard` in a second terminal when both processes are wanted.

## Dashboard-only role

- `.\scripts\run-dashboard.cmd start`
- `.\scripts\run-dashboard.cmd dev`

`run-dashboard.cmd` is the only dashboard launcher and always runs as the signed-in desktop user. To let that dashboard start Discord later:

1. Run `.\scripts\bots\discord\store-discord-token.cmd` once as that Windows user. It writes to Windows Credential Manager, not a user environment variable.
2. Run `.\scripts\run-dashboard.cmd start`.
3. Use the Discord runtime Start button in the dashboard. To start it on later dashboard launches, enable **Start Discord automatically with the dashboard runtime** and save the runtime settings.

The token is stored in that user's `DISCORD_TOKEN_SECURE_STORE` user environment variable. Windows does not expose another account's user environment variables to a normal process, and UAC cannot change the identity of the embedded Discord runtime inside an already-running dashboard. The supported approach is to store the token once for the signed-in user. The token grants Discord bot access but does not require Windows administrator privileges.

For LAN dashboard access, set `DASHBOARD_BIND_HOST=0.0.0.0`, `DASHBOARD_EXPOSE_API=true`, and `DASHBOARD_ACCESS_TOKEN` in the dashboard host environment. Use `DASHBOARD_ALLOWED_CLIENTS` to restrict remote access to exact client IPs or IPv4 CIDR ranges; local loopback access remains available.

The remote generation worker is not an elevation or impersonation broker. Running Discord under a different Windows account would require extracting it from the dashboard process and installing a separately authenticated Windows service or scheduled-task broker.

For a separate machine, use the Discord headless commands on that machine and configure its LAN URLs in `.env.main.local`. The dashboard Start/Stop control is deliberately local-process only; it can start embedded Discord when the dashboard and Discord share a host, but it does not execute processes across the network.

Dashboard role forces `DASHBOARD_ENABLED=true`. Messenger autostart remains default-off and is persisted per messenger from Runtime Control. The server batch passes `-NoMessengerAutostart`, so those preferences belong to the dashboard runtime and cannot accidentally create a second bot in the headless server process.

## Remote worker role

- `.\scripts\run-worker.cmd start`
- `.\scripts\run-worker.cmd dev`

Worker env files are loaded from:
- `.env.public`
- `.env.public.local`
- `bots/discord-bot/.env.public`
- `bots/discord-bot/.env.public.local`
- `workers/remote-worker/env/.env.worker.local`
- `workers/remote-worker/env/.env.worker.<profile>.local`

Main/dashboard env files are loaded from:
- `.env.public`
- `.env.public.local`
- `.env.main.local`
- `.env.main.<profile>.local`
- `bots/discord-bot/.env.public`
- `bots/discord-bot/.env.public.local`
- `bots/discord-bot/.env.main.local`
- `bots/discord-bot/.env.main.<profile>.local`

Root files are canonical and win over matching legacy files under `bots/discord-bot`. The legacy paths remain supported so existing local setups can migrate without breaking.

Discord token lookup for the main and dashboard roles reads `DISCORD_TOKEN_RUNTIME` first, then the current user's native credential store, then the legacy `DISCORD_TOKEN_SECURE_STORE` user environment variable as a migration fallback. The legacy value is plaintext and should be removed after migration. The headless server role deliberately disables messenger autostart and therefore does not require a Discord token just to serve APIs. The dashboard role hydrates the token when available so Discord can be started from dashboard controls. Credentials stored under a different OS account are not visible to the dashboard.

Discord autostart is off by default. Configure it in Dashboard Settings → Setup → Messengers; use Runtime Control for manual start, stop, and live status. `scripts/run-server.cmd` never autostarts messenger clients, even when the dashboard preference is enabled, so a second unmanaged Discord connection cannot silently conflict with the dashboard-owned runtime.

Use `npm run secret:status` to check whether the native Discord credential exists without revealing it, or `npm run secret:delete:discord` to remove it.

For an OpenAI-compatible server that requires an API key, run `.\scripts\llm\store-openai-compatible-api-key.cmd`. This stores `openai-compatible.default.api-key` for the current OS user. `OPENAI_COMPATIBLE_API_KEY` and the legacy `LMSTUDIO_API_KEY` remain higher-priority environment overrides for CI and services. Check or delete this credential with `npm run secret:status:openai` and `npm run secret:delete:openai`.

## Runtime control (dashboard must be running)

- Discord: `.\scripts\bots\discord\run-discord-runtime.cmd start`
- Telegram: `.\scripts\bots\telegram\run-telegram-runtime.cmd start`
- Matrix: `.\scripts\bots\matrix\run-matrix-runtime.cmd start`
- WhatsApp: `.\scripts\bots\whatsapp\run-whatsapp-runtime.cmd start`

Generic runtime control: `.\scripts\bots\runtime-control.cmd discord start`

Use `stop` or `restart` instead of `start` as needed.
All runtime scripts accept optional `baseUrl` as second argument (default `http://127.0.0.1:4782`).
Matrix runtime config lives in `bots/matrix-bot/.env.example` (copy to `.env` and set homeserver/token).

To repair an E2EE device-state conflict for an existing Matrix bot, run `npm run matrix:repair-session` as the same Windows user that runs the dashboard. It prompts locally for a Synapse administrator token, revokes the bot's existing sessions, creates a fresh bot device/token, stores that token in the native credential store, assigns a new local crypto-state folder, and restarts the runtime. The bot token is deliberately not printed. Use `npm run secret:print:matrix` only when absolutely necessary; it requires typing `PRINT` and exposes the current user's token in the terminal.

To repair an E2EE device-state conflict for an existing Matrix bot, run `npm run matrix:repair-session` as the same Windows user that runs the dashboard. It prompts locally for a Synapse administrator token, revokes the bot's existing sessions, creates a fresh bot device/token, stores that token in the native credential store, assigns a new local crypto-state folder, and restarts the runtime. The bot token is deliberately not printed. Use `npm run secret:print:matrix` only when absolutely necessary; it requires typing `PRINT` and exposes the current user's token in the terminal.

## Tool audits

- `node scripts/check-dashboard-tool-bridges.mjs`

This reports which art tools expose dashboard theme sync, dashboard image-load support, and processed-image export support so new tools do not quietly ship without the workspace bridge contract.

## Messenger theme config

Dashboard messenger themes and logos are loaded from dashboard-owned assets:
- `dashboard/assets/messengers/discord/`
- `dashboard/assets/messengers/telegram/`
- `dashboard/assets/messengers/matrix/`
- `dashboard/assets/messengers/whatsapp/`
- `dashboard/dashboard-theme-studio.json` (Studio-only theme)
