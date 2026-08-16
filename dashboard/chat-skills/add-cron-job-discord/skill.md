# Add Cron Job Discord

Create or update a Discord scheduled automation.

## Inputs
- Discord destination channel ID.
- Job name.
- Action source (`template`, `jokes-file`, `ollama`, `image`, or `model-3d`).
- Cron expression (or interval values).

## Behavior
- Build a payload for `/api/scheduled-automations` with:
  - `targetMessenger: "discord"`
  - `guildId`, `channelId`, `name`, `source`
  - `triggerMode` + `cron` or interval fields.
- Keep payload keys aligned with dashboard automation API expectations.

## Output
- Return a short Discord cron job summary plus ready-to-send JSON payload.