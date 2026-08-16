# Add Cron Job Telegram

Create or update a Telegram scheduled automation.

## Inputs
- Telegram destination chat ID.
- Job name.
- Action source (`template`, `jokes-file`, `ollama`, or `image`).
- Cron expression (or interval values).

## Behavior
- Build a payload for `/api/scheduled-automations` with:
  - `targetMessenger: "telegram"`
  - `guildId`, `channelId`, `name`, `source`
  - `triggerMode` + `cron` or interval fields.
- Never set `source: "model-3d"` for Telegram scheduled automations.

## Output
- Return a concise Telegram cron job summary plus ready-to-send JSON payload.