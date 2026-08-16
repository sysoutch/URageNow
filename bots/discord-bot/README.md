# Node Bot

Parallel Node.js + TypeScript rewrite target for the existing Java Discord bot.

## Goals

- Keep the Java bot intact while we migrate feature-by-feature
- Move secrets and machine-specific paths into environment configuration
- Break the bot into small command and service modules instead of one large app file

## Current Commands

- Slash: `/help`, `/ping`, `/ask`, `/say`, `/dm`, `/gift`, `/humble`
- Message moderation: duplicate cross-channel text/image spam detection
- Local dashboard: `http://127.0.0.1:4782` by default
- Dashboard app source: `dashboard/src/`

## Scripts

Install dependencies from the repository root with `npm install`. Root launchers run with the repository root as their working directory.

- `npm run dev`
- `npm run build`
- `npm run check`
- `npm run register`
- `npm run start`

Prefer the root commands for the combined Studio runtime:
- `npm run runtime:dev`
- `npm run runtime:start`
- `npm run check:discord`

Remote worker runtime is separate:
- entrypoint: `workers/remote-worker/src/remoteWorker.ts`
- launcher: `scripts/run-worker.cmd`

## Public Config

Create root `.env.public.local` from `.env.public.example`.

- `DISCORD_TOKEN_RUNTIME`
- `DISCORD_CLIENT_ID`
- `DISCORD_GUILD_ID`
- `HUMBLE_ROLE_ID`
- `OLLAMA_URL`
- `OLLAMA_MODEL`
- `OLLAMA_VISION_MODEL`
- `LLM_PROVIDER`
- `OPENAI_COMPATIBLE_BASE_URL`
- `OPENAI_COMPATIBLE_API_KEY`
- `OPENAI_COMPATIBLE_MODEL`
- `OPENAI_COMPATIBLE_VISION_MODEL`
- `MODEL3D_EXECUTION_MODE`
- `IMAGE_EXECUTION_MODE`
- `DASHBOARD_PORT`
- `DUPLICATE_WINDOW_MS`
- `SPAM_TIMEOUT_MS`

Defaults:

- `OLLAMA_VISION_MODEL=llava:13b`
- `DASHBOARD_PORT=4782`
- `DUPLICATE_WINDOW_MS=60000`
- `SPAM_TIMEOUT_MS=3600000`

## LAN LLM Setup

You can run the LLM on another machine in your network and keep image/3D generation local.

- `OLLAMA_URL` can be either `http://<host>:11434` or `http://<host>:11434/api/generate`
- `OPENAI_COMPATIBLE_BASE_URL` can be either `http://<host>:1234` or `http://<host>:1234/v1`
- llama.cpp uses the same OpenAI-compatible connection fields. Set `LLM_PROVIDER=llamacpp` and point `OPENAI_COMPATIBLE_BASE_URL` at the llama.cpp server, normally `http://<host>:8080/v1`. Legacy `LMSTUDIO_*` names remain accepted during migration.
- No remote worker is required for this LLM-only split setup

Example llama.cpp server connection:

```env
LLM_PROVIDER=llamacpp
OPENAI_COMPATIBLE_BASE_URL=http://192.168.1.60:8080/v1
OPENAI_COMPATIBLE_API_KEY=
OPENAI_COMPATIBLE_MODEL=your-loaded-model-id
```

llama.cpp owns model loading and context size when its server process starts. Dashboard load/unload actions are therefore not sent to llama.cpp.

Example (root `.env.main.local`):

```env
LLM_PROVIDER=ollama
OLLAMA_URL=http://192.168.1.50:11434
MODEL3D_EXECUTION_MODE=local
IMAGE_EXECUTION_MODE=local
REMOTE_WORKER_BASE_URL=
```

## Moderation Behavior

- If the same text is posted by the same user in multiple channels inside the duplicate window, the bot deletes all but the first message, optionally timeouts the user, and posts a notice in the first channel.
- If duplicate image posts are detected across channels, the first post's images are analyzed with `llava:13b`. If Llava flags spam, NSFW, crypto spam, or obvious crypto imagery, the bot deletes all copies including the first and posts a notice in the first channel.
- Members with Discord moderation permissions are exempt from the timeout, but duplicate cleanup still runs.
- Additional moderation bypasses are dashboard-managed per guild through protected users and protected roles instead of hidden env user IDs.

## Dashboard

The dashboard binds to `127.0.0.1` only and uses the bot token to call normal bot actions. It does not automate a user account.

- LLM-to-channel sends require confirmation by default.
- You can toggle that behavior on or off in the dashboard at runtime.
- When confirmation is enabled, the dashboard stores a short-lived pending draft until you confirm the send.
- The dashboard now fetches connected guilds, sendable channels, and searchable members so you can select them directly instead of typing raw IDs.
- The dashboard also shows DM threads and lets you inspect recent messages for DM channels the bot currently knows about in its runtime/cache.
- The anti-spam guard can now be configured from the dashboard, including enable/disable, duplicate window, timeout length, timeout application, and duplicate-image analysis.
- Guild welcome-message settings are now persisted in the workspace-level `data/guild-settings.json`, and the dashboard can manage welcome behavior plus assign/remove roles for the selected member.
- Messenger color themes and logos are dashboard-owned under `dashboard/assets/messengers/`.
  Update those assets to change dashboard presentation without coupling it to bot packages.

## Secret Handling

The bot no longer expects a secret `.env` file in the repo.

Discord tokens are stored in the operating system's native credential store for the current user: Windows Credential Manager, macOS Keychain, or the Linux credential backend. Process environment values remain supported as explicit overrides for services, containers, and CI. The legacy `DISCORD_TOKEN_SECURE_STORE` user environment variable is read only as a migration fallback and is not encrypted.

Recommended flow:

1. Run `scripts\bots\discord\store-discord-token.cmd` as the Windows user that will run the dashboard.
2. Type the Discord bot token into the hidden PowerShell prompt.
3. Start the dashboard with `scripts\run-dashboard.cmd start`.
4. Start Discord later from the dashboard runtime controls.

Inspect or delete the stored credential without revealing it:

```sh
npm run secret:status
npm run secret:delete:discord
```

The dashboard access token, remote-worker shared secret, and messenger-admin shared secret can use the same native store. Their names are `dashboard.default.access-token`, `remote-worker.default.shared-secret`, and `messenger-admin.default.shared-secret`; the matching `secret:status:*` and `secret:delete:*` commands are listed in the root `package.json`.

Dashboard-launched Telegram, Matrix, and WhatsApp runtimes also resolve `telegram.default.bot-token`, `matrix.default.access-token`, and `whatsapp.default.access-token` from the current user's native store. Their normal environment variables still take priority for service and CI deployments.

To run the bot later from the normal user account:

- `scripts\bots\discord\run-main.cmd register`
- `scripts\bots\discord\run-bot.cmd` (Discord only; no dashboard server or dashboard build)
- `scripts\bots\discord\run-bot.cmd dev` (Discord-only watch mode)
- `scripts\bots\discord\run-main.cmd` (combined Discord and dashboard runtime)
- `scripts\bots\discord\run-main.cmd dev` (combined watch mode)
- Existing explicit headless mode: `scripts\bots\discord\run-main.cmd start-headless`
- Dashboard entrypoint: `scripts\run-dashboard.cmd start`

The dashboard launcher prompts for the current user or another Windows account. This keeps the token in the selected dashboard user's environment and only exposes it to processes running under that user.
